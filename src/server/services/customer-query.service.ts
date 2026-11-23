import "server-only";
import type { Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { maskAccountNumber } from "@/lib/format";
import { maskName } from "./transfer.service";

/**
 * Read models for the customer area. Every query is scoped to the session
 * user's own accounts — an account id that isn't theirs is a 404.
 */

async function ownAccountIds(userId: string) {
  const rows = await db.account.findMany({ where: { userId }, select: { id: true } });
  return rows.map((r) => r.id);
}

export async function listOwnAccounts(userId: string) {
  const accounts = await db.account.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, accountNumber: true, type: true, balance: true, status: true, nickname: true, createdAt: true,
      transactionPinHash: true, pinLockedUntil: true, dailyTransferLimit: true, maxSingleTxn: true,
    },
  });
  return accounts.map(({ transactionPinHash, pinLockedUntil, ...a }) => ({
    ...a,
    hasPin: Boolean(transactionPinHash),
    pinLocked: Boolean(pinLockedUntil && pinLockedUntil > new Date()),
  }));
}

/** Account + its ledger (the statement), newest first. */
export async function getAccountStatement(userId: string, accountId: string, page: number, pageSize: number) {
  const account = await db.account.findFirst({
    where: { id: accountId, userId },
    select: { id: true, accountNumber: true, type: true, balance: true, status: true, nickname: true, createdAt: true, transactionPinHash: true },
  });
  if (!account) throw new AppError("NOT_FOUND", "Account not found");

  const [entries, total, totals] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { accountId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { transaction: { select: { id: true, reference: true, type: true, description: true, status: true, fee: true } } },
    }),
    db.ledgerEntry.count({ where: { accountId } }),
    db.ledgerEntry.groupBy({ by: ["direction"], where: { accountId }, _sum: { amount: true } }),
  ]);
  const { transactionPinHash, ...acc } = account;
  return {
    account: { ...acc, hasPin: Boolean(transactionPinHash) },
    totals: {
      credits: totals.find((t) => t.direction === "CREDIT")?._sum.amount ?? BigInt(0),
      debits: totals.find((t) => t.direction === "DEBIT")?._sum.amount ?? BigInt(0),
    },
    items: entries.map((e) => ({
      id: e.id,
      direction: e.direction,
      amount: e.amount,
      balanceAfter: e.balanceAfter,
      createdAt: e.createdAt,
      transaction: e.transaction,
    })),
    total,
    page,
    pageSize,
  };
}

const txnInclude = {
  senderAccount: { select: { id: true, accountNumber: true, userId: true, user: { select: { name: true } } } },
  receiverAccount: { select: { id: true, accountNumber: true, userId: true, user: { select: { name: true } } } },
} satisfies Prisma.TransactionInclude;

type TxnWithParties = Prisma.TransactionGetPayload<{ include: typeof txnInclude }>;

/** Present a transaction from the customer's point of view. */
function toCustomerView(t: TxnWithParties, ownIds: Set<string>, scopeAccountId?: string) {
  const senderOwn = t.senderAccountId ? ownIds.has(t.senderAccountId) : false;
  const receiverOwn = t.receiverAccountId ? ownIds.has(t.receiverAccountId) : false;

  let direction: "in" | "out" | "internal";
  if (scopeAccountId) direction = t.senderAccountId === scopeAccountId ? "out" : "in";
  else if (senderOwn && receiverOwn) direction = "internal";
  else direction = senderOwn ? "out" : "in";

  const counterpartyAccount = direction === "out" ? t.receiverAccount : direction === "in" ? t.senderAccount : t.receiverAccount;
  let counterparty: string;
  switch (t.type) {
    case "DEPOSIT": counterparty = "Cash deposit"; break;
    case "WITHDRAWAL": counterparty = "Cash withdrawal"; break;
    case "LOAN_DISBURSEMENT": counterparty = "Kosh Loans"; break;
    case "LOAN_REPAYMENT": counterparty = "Kosh Loans · EMI"; break;
    case "CARD_PAYMENT": counterparty = t.merchant ?? "Card payment"; break;
    default:
      counterparty = counterpartyAccount
        ? direction === "internal"
          ? `Own account ${maskAccountNumber(counterpartyAccount.accountNumber)}`
          : maskName(counterpartyAccount.user.name)
        : "Kosh";
  }

  // What the customer's balance actually moved by
  const net = direction === "out" ? t.amount + t.fee : t.amount;

  return {
    id: t.id,
    reference: t.reference,
    type: t.type,
    status: t.status,
    amount: t.amount,
    fee: direction === "in" ? BigInt(0) : t.fee,
    net,
    direction,
    description: t.description,
    counterparty,
    counterpartyAccount: counterpartyAccount ? maskAccountNumber(counterpartyAccount.accountNumber) : null,
    fromAccountId: senderOwn ? t.senderAccountId : null,
    toAccountId: receiverOwn ? t.receiverAccountId : null,
    reversedTxnId: t.reversedTxnId,
    createdAt: t.createdAt,
  };
}

export type CustomerTxnFilters = {
  accountId?: string;
  q?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  from?: string; // YYYY-MM-DD (Dhaka)
  to?: string;
  page: number;
  pageSize: number;
};

export async function listOwnTransactions(userId: string, f: CustomerTxnFilters) {
  const ids = await ownAccountIds(userId);
  if (f.accountId && !ids.includes(f.accountId)) throw new AppError("NOT_FOUND", "Account not found");
  const scope = f.accountId ? [f.accountId] : ids;

  const where: Prisma.TransactionWhereInput = {
    AND: [
      { OR: [{ senderAccountId: { in: scope } }, { receiverAccountId: { in: scope } }] },
      f.type ? { type: f.type } : {},
      f.status ? { status: f.status } : {},
      f.from ? { createdAt: { gte: new Date(`${f.from}T00:00:00+06:00`) } } : {},
      f.to ? { createdAt: { lte: new Date(`${f.to}T23:59:59.999+06:00`) } } : {},
      f.q
        ? { OR: [{ reference: { contains: f.q, mode: "insensitive" } }, { description: { contains: f.q, mode: "insensitive" } }] }
        : {},
    ],
  };

  const [rows, total] = await Promise.all([
    db.transaction.findMany({
      where,
      include: txnInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
    }),
    db.transaction.count({ where }),
  ]);
  const own = new Set(ids);
  return { items: rows.map((t) => toCustomerView(t, own, f.accountId)), total, page: f.page, pageSize: f.pageSize };
}

export async function getOwnTransaction(userId: string, id: string) {
  const ids = await ownAccountIds(userId);
  const t = await db.transaction.findFirst({
    where: { id, OR: [{ senderAccountId: { in: ids } }, { receiverAccountId: { in: ids } }] },
    include: { ...txnInclude, ledgerEntries: { where: { accountId: { in: ids } } }, reversal: { select: { id: true, reference: true } }, reversedTxn: { select: { id: true, reference: true } } },
  });
  if (!t) throw new AppError("NOT_FOUND", "Transaction not found");
  return {
    ...toCustomerView(t, new Set(ids)),
    ledger: t.ledgerEntries.map((e) => ({ accountId: e.accountId, direction: e.direction, amount: e.amount, balanceAfter: e.balanceAfter })),
    reversal: t.reversal,
    reversalOf: t.reversedTxn,
  };
}

// ── Notifications ─────────────────────────────────────────
export async function listNotifications(userId: string, page: number, pageSize: number, unreadOnly = false) {
  const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };
  const [items, total, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { items, total, unread, page, pageSize };
}

export async function markNotificationRead(userId: string, id: string) {
  const r = await db.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  if (!r.count) throw new AppError("NOT_FOUND", "Notification not found");
  return { ok: true };
}

export async function markAllNotificationsRead(userId: string) {
  const r = await db.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  return { updated: r.count };
}
