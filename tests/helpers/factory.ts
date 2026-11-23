import bcrypt from "bcryptjs";
import type { AccountStatus, AccountType, Role, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import type { SessionUser } from "@/server/auth/guards";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { generateAccountNumber, generateTxnReference } from "@/lib/reference";

export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
export const PIN = "1234";
let pinHash: string | null = null;
let seq = 0;

export const tk = (n: number) => BigInt(Math.round(n * 100)); // taka → paisa

export async function resetDb() {
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE ledger_entries, loan_installments, loan_notes, deposit_withdrawal_requests, loans, transactions,
     cards, security_events, notifications, email_logs, otp_challenges, audit_logs, accounts, customer_profiles, bank_settings, sessions,
     auth_accounts, verifications, users RESTART IDENTITY CASCADE`,
  );
  await db.bankSettings.create({ data: { id: 1, ...DEFAULT_SETTINGS } });
}

export async function makeUser(role: Role = "CUSTOMER", status: UserStatus = "ACTIVE"): Promise<SessionUser> {
  seq += 1;
  const u = await db.user.create({
    data: { name: `Test User${seq} Person`, email: `u${seq}-${Date.now()}@test.local`, role, status, isVerified: true },
  });
  return { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, isVerified: true };
}

/** Opens an account with an opening DEPOSIT + ledger row, like the real system. */
export async function makeAccount(
  userId: string,
  balanceTaka: number,
  opts: { type?: AccountType; status?: AccountStatus; pin?: string | null; dailyLimit?: bigint; maxSingle?: bigint } = {},
) {
  pinHash ??= await bcrypt.hash(PIN, 4);
  const type = opts.type ?? "SAVINGS";
  const balance = tk(balanceTaka);
  const account = await db.account.create({
    data: {
      accountNumber: generateAccountNumber(type),
      userId,
      type,
      balance,
      status: opts.status ?? "ACTIVE",
      transactionPinHash: opts.pin === null ? null : opts.pin ? await bcrypt.hash(opts.pin, 4) : pinHash,
      dailyTransferLimit: opts.dailyLimit,
      maxSingleTxn: opts.maxSingle,
    },
  });
  if (balance > BigInt(0)) {
    await db.transaction.create({
      data: {
        reference: generateTxnReference("DEP"),
        type: "DEPOSIT",
        amount: balance,
        status: "COMPLETED",
        receiverAccountId: account.id,
        initiatedById: userId,
        ledgerEntries: { create: { accountId: account.id, direction: "CREDIT", amount: balance, balanceAfter: balance } },
      },
    });
  }
  return account;
}

export const balanceOf = async (accountId: string) => (await db.account.findUniqueOrThrow({ where: { id: accountId } })).balance;

/** Invariant: every account balance equals the net of its ledger entries. */
export async function ledgerMismatches() {
  return db.$queryRaw<{ id: string }[]>`
    SELECT a.id FROM accounts a
    LEFT JOIN (SELECT "accountId", SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END) net
               FROM ledger_entries GROUP BY "accountId") l ON l."accountId" = a.id
    WHERE a.balance <> COALESCE(l.net, 0)`;
}

let keySeq = 0;
export const key = () => `test-key-${Date.now()}-${++keySeq}`;

/** Runs a promise and returns the AppError code it rejects with (or "OK"). */
export async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "OK";
  } catch (e) {
    return (e as { code?: string }).code ?? `UNEXPECTED: ${String(e)}`;
  }
}
