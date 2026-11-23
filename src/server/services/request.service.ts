import "server-only";
import type { Prisma, RequestStatus } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { assertNotSelf, type SessionUser } from "@/server/auth/guards";
import { writeAudit } from "@/server/audit";
import { formatMoney } from "@/lib/money";
import { generateTxnReference } from "@/lib/reference";
import { maskAccountNumber } from "@/lib/format";
import { getSettings } from "./settings.service";
import { lockAccounts, lockRequest, MONEY_TX_OPTIONS } from "./locks";
import { notify, notifyRoles } from "./notification.service";

/** Customer: create a PENDING deposit or withdrawal request. No money moves yet. */
export async function createRequest(
  user: SessionUser,
  input: { accountId: string; type: "DEPOSIT" | "WITHDRAWAL"; amount: bigint; description?: string },
) {
  const account = await db.account.findFirst({ where: { id: input.accountId, userId: user.id } });
  if (!account) throw new AppError("NOT_FOUND", "Account not found");
  if (account.status !== "ACTIVE") throw new AppError("ACCOUNT_FROZEN", "This account can't accept requests right now");

  if (input.type === "WITHDRAWAL") {
    // Early, friendly check. The binding check happens again at approval time.
    const settings = await getSettings();
    if (account.balance - input.amount < settings.minimumBalance) {
      throw new AppError(
        "INSUFFICIENT_FUNDS",
        `You can withdraw up to ${formatMoney(account.balance - settings.minimumBalance)} (minimum balance ${formatMoney(settings.minimumBalance)}).`,
      );
    }
  }

  const pendingCount = await db.depositWithdrawalRequest.count({ where: { requestedById: user.id, status: "PENDING" } });
  if (pendingCount >= 5) throw new AppError("LIMIT_EXCEEDED", "You already have 5 pending requests. Wait for them to be reviewed.");

  const created = await db.depositWithdrawalRequest.create({
    data: {
      accountId: account.id,
      type: input.type,
      amount: input.amount,
      description: input.description || null,
      requestedById: user.id,
    },
  });
  await notifyRoles(
    ["STAFF"],
    { type: "REVIEW_QUEUE", title: `New ${input.type === "DEPOSIT" ? "deposit" : "withdrawal"} request`, body: `${user.name} · ${formatMoney(input.amount)} on ${maskAccountNumber(account.accountNumber)}`, link: "/staff/requests" },
    user.id,
  );
  return created;
}

export async function listOwnRequests(userId: string, page: number, pageSize: number) {
  const where = { requestedById: userId };
  const [items, total] = await Promise.all([
    db.depositWithdrawalRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { account: { select: { accountNumber: true, type: true, nickname: true } } },
    }),
    db.depositWithdrawalRequest.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

/** Staff/Admin queue. */
export async function listRequests(args: { status?: RequestStatus; page: number; pageSize: number }) {
  const where: Prisma.DepositWithdrawalRequestWhereInput = args.status ? { status: args.status } : {};
  const [items, total] = await Promise.all([
    db.depositWithdrawalRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (args.page - 1) * args.pageSize,
      take: args.pageSize,
      include: {
        account: { select: { accountNumber: true, type: true, balance: true, status: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    }),
    db.depositWithdrawalRequest.count({ where }),
  ]);
  return { items, total, page: args.page, pageSize: args.pageSize };
}

/**
 * Staff/Admin approves: ONE transaction —
 * lock request + account → still PENDING? → reviewer ≠ requester →
 * re-check balance (withdrawal) → move money → Transaction + LedgerEntry → audit.
 */
export async function approveRequest(reviewer: SessionUser, requestId: string, note?: string) {
  const result = await db.$transaction(async (tx) => {
    await lockRequest(tx, requestId);
    const req = await tx.depositWithdrawalRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new AppError("NOT_FOUND", "Request not found");
    if (req.status !== "PENDING") throw new AppError("INVALID_STATE", `This request was already ${req.status.toLowerCase()}`);
    assertNotSelf(reviewer.id, req.requestedById);

    await lockAccounts(tx, [req.accountId]);
    const account = await tx.account.findUniqueOrThrow({ where: { id: req.accountId } });
    assertNotSelf(reviewer.id, account.userId);
    if (account.status !== "ACTIVE") throw new AppError("ACCOUNT_FROZEN", "The account is not active");

    const settings = await getSettings(tx);
    const isDeposit = req.type === "DEPOSIT";
    const balanceAfter = isDeposit ? account.balance + req.amount : account.balance - req.amount;
    if (!isDeposit && balanceAfter < settings.minimumBalance) {
      throw new AppError(
        "INSUFFICIENT_FUNDS",
        `The balance changed since this was requested. Withdrawing would leave less than ${formatMoney(settings.minimumBalance)}.`,
      );
    }

    await tx.account.update({ where: { id: account.id }, data: { balance: balanceAfter } });
    const txn = await tx.transaction.create({
      data: {
        reference: generateTxnReference(isDeposit ? "DEP" : "WDR"),
        type: isDeposit ? "DEPOSIT" : "WITHDRAWAL",
        amount: req.amount,
        status: "COMPLETED",
        senderAccountId: isDeposit ? null : account.id,
        receiverAccountId: isDeposit ? account.id : null,
        description: req.description ?? (isDeposit ? "Cash deposit" : "Cash withdrawal"),
        initiatedById: req.requestedById,
        ledgerEntries: {
          create: { accountId: account.id, direction: isDeposit ? "CREDIT" : "DEBIT", amount: req.amount, balanceAfter },
        },
      },
    });
    const updated = await tx.depositWithdrawalRequest.update({
      where: { id: req.id },
      data: { status: "APPROVED", reviewedById: reviewer.id, reviewNote: note || null, reviewedAt: new Date(), transactionId: txn.id },
    });
    await writeAudit(
      {
        actorId: reviewer.id,
        action: isDeposit ? "DEPOSIT_APPROVED" : "WITHDRAWAL_APPROVED",
        entity: "DepositWithdrawalRequest",
        entityId: req.id,
        metadata: { amount: req.amount.toString(), transactionId: txn.id, accountId: account.id },
      },
      tx,
    );
    return { request: updated, transaction: txn, accountNumber: account.accountNumber, ownerId: account.userId, balanceAfter };
  }, MONEY_TX_OPTIONS);

  await notify([
    {
      userId: result.ownerId,
      type: "REQUEST_APPROVED",
      title: `${result.request.type === "DEPOSIT" ? "Deposit" : "Withdrawal"} approved`,
      body: `${formatMoney(result.request.amount)} on ${maskAccountNumber(result.accountNumber)}. Ref ${result.transaction.reference}.`,
      link: `/transactions/${result.transaction.id}`,
    },
  ]);
  return result;
}

export async function rejectRequest(reviewer: SessionUser, requestId: string, note: string) {
  const result = await db.$transaction(async (tx) => {
    await lockRequest(tx, requestId);
    const req = await tx.depositWithdrawalRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new AppError("NOT_FOUND", "Request not found");
    if (req.status !== "PENDING") throw new AppError("INVALID_STATE", `This request was already ${req.status.toLowerCase()}`);
    assertNotSelf(reviewer.id, req.requestedById);

    const updated = await tx.depositWithdrawalRequest.update({
      where: { id: req.id },
      data: { status: "REJECTED", reviewedById: reviewer.id, reviewNote: note, reviewedAt: new Date() },
    });
    await writeAudit(
      { actorId: reviewer.id, action: `${req.type}_REJECTED`, entity: "DepositWithdrawalRequest", entityId: req.id, metadata: { note } },
      tx,
    );
    return updated;
  }, MONEY_TX_OPTIONS);

  await notify([
    {
      userId: result.requestedById,
      type: "REQUEST_REJECTED",
      title: `${result.type === "DEPOSIT" ? "Deposit" : "Withdrawal"} request rejected`,
      body: `${formatMoney(result.amount)} — ${note}`,
      link: "/requests",
    },
  ]);
  return { request: result };
}
