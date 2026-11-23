import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import type { AccountStatus, AccountType, Prisma, TransactionStatus, TransactionType, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { assertNotSelf, type SessionUser } from "@/server/auth/guards";
import { writeAudit } from "@/server/audit";
import { generateAccountNumber } from "@/lib/reference";
import { formatMoney } from "@/lib/money";
import { maskAccountNumber, titleCase } from "@/lib/format";
import { isUniqueViolation } from "./locks";
import { getSettings } from "./settings.service";
import { notifyRoles, notify } from "./notification.service";

// ───────────────────────── Customers ─────────────────────────

export async function listCustomers(f: { q?: string; status?: UserStatus; verified?: boolean; page: number; pageSize: number }) {
  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(f.status ? { status: f.status } : {}),
    ...(f.verified !== undefined ? { isVerified: f.verified } : {}),
    ...(f.q
      ? {
          OR: [
            { name: { contains: f.q, mode: "insensitive" } },
            { email: { contains: f.q, mode: "insensitive" } },
            { profile: { phone: { contains: f.q } } },
            { accounts: { some: { accountNumber: { contains: f.q.replace(/\s+/g, "") } } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: {
        id: true, name: true, email: true, status: true, isVerified: true, createdAt: true,
        profile: { select: { phone: true } },
        accounts: { select: { balance: true, status: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  return {
    items: rows.map(({ accounts, ...u }) => ({
      ...u,
      accountCount: accounts.length,
      totalBalance: accounts.reduce((s, a) => s + a.balance, BigInt(0)),
      frozenCount: accounts.filter((a) => a.status === "FROZEN").length,
    })),
    total,
    page: f.page,
    pageSize: f.pageSize,
  };
}

export async function getCustomer(id: string) {
  const user = await db.user.findFirst({
    where: { id, role: "CUSTOMER" },
    select: {
      id: true, name: true, email: true, status: true, isVerified: true, createdAt: true,
      profile: { include: { verifiedBy: { select: { name: true } } } },
      accounts: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, accountNumber: true, type: true, balance: true, status: true, nickname: true, createdAt: true,
          dailyTransferLimit: true, maxSingleTxn: true, pinLockedUntil: true, transactionPinHash: true,
        },
      },
      loans: { orderBy: { createdAt: "desc" }, select: { id: true, loanType: true, principal: true, status: true, remainingBalance: true, createdAt: true } },
    },
  });
  if (!user) throw new AppError("NOT_FOUND", "Customer not found");
  const ids = user.accounts.map((a) => a.id);
  const [recent, pendingRequests, audit] = await Promise.all([
    db.transaction.findMany({
      where: { OR: [{ senderAccountId: { in: ids } }, { receiverAccountId: { in: ids } }] },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, reference: true, type: true, amount: true, fee: true, status: true, createdAt: true, senderAccountId: true, receiverAccountId: true, isFlagged: true, flagResolvedAt: true },
    }),
    db.depositWithdrawalRequest.count({ where: { requestedById: id, status: "PENDING" } }),
    db.auditLog.findMany({
      where: { OR: [{ entity: "User", entityId: id }, { entity: "Account", entityId: { in: ids } }] },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: { select: { name: true, role: true } } },
    }),
  ]);
  return {
    ...user,
    accounts: user.accounts.map(({ transactionPinHash, pinLockedUntil, ...a }) => ({
      ...a,
      hasPin: Boolean(transactionPinHash),
      pinLocked: Boolean(pinLockedUntil && pinLockedUntil > new Date()),
    })),
    recent,
    pendingRequests,
    audit,
  };
}

/** Readable temporary password, shown to staff once so they can hand it over. */
function tempPassword() {
  const words = ["Lotus", "River", "Mango", "Delta", "Jute", "Monsoon", "Hilsa", "Banyan"];
  return `${words[randomInt(words.length)]}-${randomInt(1000, 9999)}-${words[randomInt(words.length)]}`;
}

async function createAccountRow(tx: Prisma.TransactionClient, data: { userId: string; type: AccountType; nickname?: string; createdById: string }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await tx.account.create({
        data: { accountNumber: generateAccountNumber(data.type), userId: data.userId, type: data.type, nickname: data.nickname || null, createdById: data.createdById },
      });
    } catch (e) {
      if (!isUniqueViolation(e, "accountNumber")) throw e;
    }
  }
  throw new AppError("INTERNAL_ERROR", "Couldn't generate a unique account number");
}

/** Staff/Admin registers a customer (login + KYC profile, optionally a first account). */
export async function registerCustomer(
  actor: SessionUser,
  input: { name: string; email: string; phone: string; address: string; nid: string; dateOfBirth: string; openAccount: "NONE" | AccountType },
) {
  const password = tempPassword();
  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: input.name, email: input.email, role: "CUSTOMER", emailVerified: true } });
      await tx.authAccount.create({ data: { id: `cred_${user.id}`, accountId: user.id, providerId: "credential", userId: user.id, password: hash } });
      await tx.customerProfile.create({
        data: { userId: user.id, phone: input.phone, address: input.address, nid: input.nid, dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00Z`) },
      });
      const account = input.openAccount !== "NONE" ? await createAccountRow(tx, { userId: user.id, type: input.openAccount, createdById: actor.id }) : null;
      await writeAudit({ actorId: actor.id, action: "CUSTOMER_REGISTERED", entity: "User", entityId: user.id, metadata: { email: input.email, openedAccount: account?.id ?? null } }, tx);
      if (account) await writeAudit({ actorId: actor.id, action: "ACCOUNT_CREATED", entity: "Account", entityId: account.id, metadata: { type: account.type } }, tx);
      return { user, account };
    });
    await notify([{ userId: result.user.id, type: "SYSTEM", title: "Welcome to Kosh", body: "Your profile was created by our staff. Set a transaction PIN before your first transfer.", link: "/profile" }]);
    return { customer: { id: result.user.id, name: result.user.name, email: result.user.email }, account: result.account, temporaryPassword: password };
  } catch (e) {
    if (isUniqueViolation(e, "email")) throw new AppError("ALREADY_EXISTS", "A user with this email already exists");
    throw e;
  }
}

const PROFILE_SELECT = { phone: true, address: true, nid: true, dateOfBirth: true, verifiedAt: true } as const;

export async function getKycProfile(userId: string) {
  const profile = await db.customerProfile.findUnique({ where: { userId }, select: PROFILE_SELECT });
  return { profile, complete: Boolean(profile?.phone && profile.nid) };
}

/**
 * Customer submits their own KYC details (needed before staff can verify them).
 * Once verified the details are locked — changes then go through staff.
 */
export async function submitKycProfile(user: SessionUser, input: { phone: string; address: string; nid: string; dateOfBirth: string }) {
  if (user.isVerified) throw new AppError("INVALID_STATE", "Your profile is verified. Ask Kosh staff to change these details.");
  const dob = new Date(`${input.dateOfBirth}T00:00:00Z`);
  const age = (Date.now() - dob.getTime()) / (365.25 * 86_400_000);
  if (!(age >= 18 && age < 120)) throw new AppError("VALIDATION_ERROR", "You must be 18 or older to bank with Kosh");
  const data = { phone: input.phone, address: input.address, nid: input.nid, dateOfBirth: dob };
  const before = await db.customerProfile.findUnique({ where: { userId: user.id }, select: { nid: true } });
  const profile = await db.customerProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data, select: PROFILE_SELECT });
  await writeAudit({ actorId: user.id, action: "PROFILE_SUBMITTED", entity: "User", entityId: user.id });
  if (!before?.nid) {
    await notifyRoles(["STAFF"], { type: "REVIEW_QUEUE", title: "Customer ready for verification", body: `${user.name} submitted their KYC details.`, link: `/staff/customers/${user.id}` });
  }
  return { profile, complete: true };
}

export async function verifyCustomer(actor: SessionUser, userId: string) {
  assertNotSelf(actor.id, userId);
  const user = await db.user.findFirst({ where: { id: userId, role: "CUSTOMER" }, include: { profile: true } });
  if (!user) throw new AppError("NOT_FOUND", "Customer not found");
  if (user.isVerified) throw new AppError("INVALID_STATE", "Already verified");
  if (!user.profile?.nid || !user.profile.phone) throw new AppError("VALIDATION_ERROR", "Profile needs a phone and NID before verification");
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isVerified: true } });
    await tx.customerProfile.update({ where: { userId }, data: { verifiedById: actor.id, verifiedAt: new Date() } });
    await writeAudit({ actorId: actor.id, action: "CUSTOMER_VERIFIED", entity: "User", entityId: userId }, tx);
  });
  await notify([{ userId, type: "ACCOUNT_UPDATE", title: "Profile verified", body: "You can now apply for loans and use every Kosh service.", link: "/profile" }]);
  return { ok: true };
}

export async function openAccount(actor: SessionUser, input: { userId: string; type: AccountType; nickname?: string }) {
  assertNotSelf(actor.id, input.userId);
  const user = await db.user.findFirst({ where: { id: input.userId, role: "CUSTOMER" } });
  if (!user) throw new AppError("NOT_FOUND", "Customer not found");
  if (user.status !== "ACTIVE") throw new AppError("INVALID_STATE", "Customer is not active");
  if (!user.isVerified) throw new AppError("INVALID_STATE", "Verify the customer before opening an account");
  const openCount = await db.account.count({ where: { userId: user.id, status: { not: "CLOSED" } } });
  if (openCount >= 5) throw new AppError("LIMIT_EXCEEDED", "A customer can hold at most 5 open accounts");

  const account = await db.$transaction(async (tx) => {
    const a = await createAccountRow(tx, { userId: user.id, type: input.type, nickname: input.nickname, createdById: actor.id });
    await writeAudit({ actorId: actor.id, action: "ACCOUNT_CREATED", entity: "Account", entityId: a.id, metadata: { type: a.type, userId: user.id } }, tx);
    return a;
  });
  await notify([{ userId: user.id, type: "ACCOUNT_UPDATE", title: `${titleCase(account.type)} account opened`, body: `Account ${maskAccountNumber(account.accountNumber)} is ready. Set its transaction PIN in Profile & PIN.`, link: "/accounts" }]);
  return account;
}

// ───────────────────────── Admin: users & accounts ─────────────────────────

export async function setUserStatus(admin: SessionUser, userId: string, status: UserStatus, reason: string) {
  assertNotSelf(admin.id, userId);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  if (user.role === "ADMIN") throw new AppError("FORBIDDEN", "Admins can't change another admin's status");
  if (user.status === status) throw new AppError("INVALID_STATE", `User is already ${status.toLowerCase()}`);

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status } });
    // Blocked/inactive users are signed out everywhere immediately
    if (status !== "ACTIVE") await tx.session.deleteMany({ where: { userId } });
    const action = status === "ACTIVE" ? "USER_ACTIVATED" : status === "BLOCKED" ? "USER_BLOCKED" : "USER_DEACTIVATED";
    await writeAudit({ actorId: admin.id, action, entity: "User", entityId: userId, metadata: { reason, from: user.status, to: status } }, tx);
  });
  if (status === "ACTIVE") {
    await notify([{ userId, type: "ACCOUNT_UPDATE", title: "Profile reactivated", body: "Welcome back — your Kosh profile is active again.", link: "/dashboard" }]);
  }
  return { ok: true, status };
}

export async function listAllAccounts(f: { q?: string; status?: AccountStatus; type?: AccountType; page: number; pageSize: number }) {
  const q = f.q?.replace(/\s+/g, "");
  const where: Prisma.AccountWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.type ? { type: f.type } : {}),
    ...(f.q ? { OR: [{ accountNumber: { contains: q } }, { user: { name: { contains: f.q, mode: "insensitive" } } }, { nickname: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.account.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: {
        id: true, accountNumber: true, type: true, balance: true, status: true, nickname: true, createdAt: true,
        dailyTransferLimit: true, maxSingleTxn: true,
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    }),
    db.account.count({ where }),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize };
}

export async function updateAccountAsAdmin(
  admin: SessionUser,
  accountId: string,
  input:
    | { action: "freeze" | "unfreeze" | "close"; reason: string }
    | { action: "limits"; dailyTransferLimit?: bigint | null; maxSingleTxn?: bigint | null },
) {
  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("NOT_FOUND", "Account not found");
  assertNotSelf(admin.id, account.userId);

  if (input.action === "limits") {
    const s = await getSettings();
    const daily = input.dailyTransferLimit === undefined ? account.dailyTransferLimit : input.dailyTransferLimit;
    const single = input.maxSingleTxn === undefined ? account.maxSingleTxn : input.maxSingleTxn;
    if (daily != null && daily > s.dailyTransferLimit) throw new AppError("VALIDATION_ERROR", `Daily limit can't exceed the bank-wide ${formatMoney(s.dailyTransferLimit)}`);
    if (single != null && single > s.maxSingleTransaction) throw new AppError("VALIDATION_ERROR", `Single limit can't exceed the bank-wide ${formatMoney(s.maxSingleTransaction)}`);
    if (daily != null && single != null && single > daily) throw new AppError("VALIDATION_ERROR", "Single-transfer limit can't exceed the daily limit");
    const updated = await db.$transaction(async (tx) => {
      const a = await tx.account.update({ where: { id: accountId }, data: { dailyTransferLimit: daily, maxSingleTxn: single } });
      await writeAudit({ actorId: admin.id, action: "ACCOUNT_LIMITS_UPDATED", entity: "Account", entityId: accountId, metadata: { dailyTransferLimit: daily?.toString() ?? null, maxSingleTxn: single?.toString() ?? null } }, tx);
      return a;
    });
    return updated;
  }

  const next: AccountStatus = input.action === "freeze" ? "FROZEN" : input.action === "unfreeze" ? "ACTIVE" : "CLOSED";
  if (account.status === "CLOSED") throw new AppError("INVALID_STATE", "Closed accounts can't be changed");
  if (account.status === next) throw new AppError("INVALID_STATE", `Account is already ${next.toLowerCase()}`);
  if (input.action === "close" && account.balance !== BigInt(0)) throw new AppError("INVALID_STATE", "Only an account with a zero balance can be closed");

  const updated = await db.$transaction(async (tx) => {
    const a = await tx.account.update({ where: { id: accountId }, data: { status: next } });
    await writeAudit({ actorId: admin.id, action: `ACCOUNT_${next === "ACTIVE" ? "UNFROZEN" : next}`, entity: "Account", entityId: accountId, metadata: { reason: input.reason } }, tx);
    return a;
  });
  await notify([
    {
      userId: account.userId,
      type: "ACCOUNT_UPDATE",
      title: next === "FROZEN" ? "Account frozen" : next === "ACTIVE" ? "Account unfrozen" : "Account closed",
      body: `${maskAccountNumber(account.accountNumber)}: ${input.reason}`,
      link: "/accounts",
    },
  ]);
  return updated;
}

// ───────────────────────── Transactions (staff + admin) ─────────────────────────

export async function listAllTransactions(f: {
  q?: string; type?: TransactionType; status?: TransactionStatus; flagged?: "open" | "resolved" | "any";
  from?: string; to?: string; page: number; pageSize: number;
}) {
  const where: Prisma.TransactionWhereInput = {
    AND: [
      f.type ? { type: f.type } : {},
      f.status ? { status: f.status } : {},
      f.flagged === "open" ? { isFlagged: true, flagResolvedAt: null } : f.flagged === "resolved" ? { isFlagged: true, flagResolvedAt: { not: null } } : f.flagged === "any" ? { isFlagged: true } : {},
      f.from ? { createdAt: { gte: new Date(`${f.from}T00:00:00+06:00`) } } : {},
      f.to ? { createdAt: { lte: new Date(`${f.to}T23:59:59.999+06:00`) } } : {},
      f.q
        ? {
            OR: [
              { reference: { contains: f.q, mode: "insensitive" } },
              { description: { contains: f.q, mode: "insensitive" } },
              { senderAccount: { accountNumber: { contains: f.q.replace(/\s+/g, "") } } },
              { receiverAccount: { accountNumber: { contains: f.q.replace(/\s+/g, "") } } },
              { senderAccount: { user: { name: { contains: f.q, mode: "insensitive" } } } },
              { receiverAccount: { user: { name: { contains: f.q, mode: "insensitive" } } } },
            ],
          }
        : {},
    ],
  };
  const party = { select: { id: true, accountNumber: true, user: { select: { id: true, name: true } } } } as const;
  const [items, total] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: {
        senderAccount: party,
        receiverAccount: party,
        flaggedBy: { select: { name: true } },
        reversal: { select: { id: true, reference: true } },
      },
    }),
    db.transaction.count({ where }),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize };
}

export async function resolveFlag(admin: SessionUser, transactionId: string, note: string) {
  const txn = await db.transaction.findUnique({ where: { id: transactionId } });
  if (!txn) throw new AppError("NOT_FOUND", "Transaction not found");
  if (!txn.isFlagged || txn.flagResolvedAt) throw new AppError("INVALID_STATE", "This transaction has no open flag");
  return db.$transaction(async (tx) => {
    const t = await tx.transaction.update({ where: { id: transactionId }, data: { flagResolvedAt: new Date() } });
    await writeAudit({ actorId: admin.id, action: "FLAG_RESOLVED", entity: "Transaction", entityId: transactionId, metadata: { note } }, tx);
    return t;
  });
}

// ───────────────────────── Settings & audit ─────────────────────────

export async function updateSettings(
  admin: SessionUser,
  input: { dailyTransferLimit: bigint; maxSingleTransaction: bigint; minimumBalance: bigint; transferFeeFlat: bigint; transferFeePercentBps: number; transferFeeMax: bigint | null; otpThreshold?: bigint | null },
) {
  const before = await getSettings();
  return db.$transaction(async (tx) => {
    const after = await tx.bankSettings.update({ where: { id: 1 }, data: { ...input, updatedById: admin.id } });
    const changed = Object.fromEntries(
      (Object.keys(input) as (keyof typeof input)[])
        .filter((k) => String(before[k]) !== String(after[k]))
        .map((k) => [k, { from: before[k] == null ? null : String(before[k]), to: after[k] == null ? null : String(after[k]) }]),
    );
    await writeAudit({ actorId: admin.id, action: "SETTINGS_UPDATED", entity: "BankSettings", entityId: "1", metadata: changed }, tx);
    return after;
  });
}

export async function getSettingsView() {
  const s = await getSettings();
  const updatedBy = s.updatedById ? await db.user.findUnique({ where: { id: s.updatedById }, select: { name: true } }) : null;
  return { ...s, updatedBy };
}

export async function listAudit(f: { entity?: string; action?: string; actorId?: string; q?: string; page: number; pageSize: number }) {
  const where: Prisma.AuditLogWhereInput = {
    ...(f.entity ? { entity: f.entity } : {}),
    ...(f.action ? { action: { contains: f.action, mode: "insensitive" } } : {}),
    ...(f.actorId ? { actorId: f.actorId } : {}),
    ...(f.q ? { OR: [{ entityId: { contains: f.q } }, { actor: { name: { contains: f.q, mode: "insensitive" } } }] } : {}),
  };
  const [items, total, actors] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: { actor: { select: { id: true, name: true, role: true } } },
    }),
    db.auditLog.count({ where }),
    db.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize, actors };
}
