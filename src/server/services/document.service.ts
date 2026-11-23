import "server-only";
import type { Role, TransactionType } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { maskAccountNumber, titleCase } from "@/lib/format";
import { formatAmount } from "@/lib/money";
import type { ReceiptData, StatementData, StatementLine } from "@/server/pdf/documents";

const TYPE_LABEL: Record<TransactionType, string> = {
  DEPOSIT: "Cash deposit",
  WITHDRAWAL: "Cash withdrawal",
  TRANSFER: "Fund transfer",
  LOAN_DISBURSEMENT: "Loan disbursement",
  LOAN_REPAYMENT: "Loan repayment",
  CARD_PAYMENT: "Card payment",
  REVERSAL: "Reversal",
};

/** Receipt data. Customers only for transactions touching their accounts (404 otherwise); staff/admin any. */
export async function receiptData(user: { id: string; role: Role }, id: string): Promise<ReceiptData> {
  const party = { select: { accountNumber: true, userId: true, user: { select: { name: true } } } } as const;
  const t = await db.transaction.findUnique({
    where: { id },
    include: { senderAccount: party, receiverAccount: party, reversal: { select: { reference: true } }, reversedTxn: { select: { reference: true } } },
  });
  if (!t) throw new AppError("NOT_FOUND", "Transaction not found");
  if (user.role === "CUSTOMER" && t.senderAccount?.userId !== user.id && t.receiverAccount?.userId !== user.id) {
    throw new AppError("NOT_FOUND", "Transaction not found");
  }
  const isCustomer = user.role === "CUSTOMER";
  // Customers see the counterparty masked; staff see names
  const show = (p: typeof t.senderAccount) => {
    if (!p) return null;
    const own = p.userId === user.id;
    const name = !isCustomer || own ? p.user.name : `${p.user.name.split(" ")[0]} ${(p.user.name.split(" ").pop() ?? "")[0] ?? ""}.`;
    return `${name} (${maskAccountNumber(p.accountNumber)})`;
  };
  const cashLabel = (side: "from" | "to") =>
    t.type === "DEPOSIT" && side === "from" ? "Cash at branch"
    : t.type === "WITHDRAWAL" && side === "to" ? "Cash at branch"
    : t.type === "LOAN_DISBURSEMENT" && side === "from" ? "Kosh Loans"
    : t.type === "LOAN_REPAYMENT" && side === "to" ? "Kosh Loans"
    : t.type === "CARD_PAYMENT" && side === "to" ? (t.merchant ?? "Merchant")
    : "—";

  return {
    reference: t.reference,
    typeLabel: TYPE_LABEL[t.type],
    status: titleCase(t.status),
    amount: t.amount,
    fee: t.fee,
    createdAt: t.createdAt,
    from: show(t.senderAccount) ?? cashLabel("from"),
    to: show(t.receiverAccount) ?? cashLabel("to"),
    description: t.description,
    reversalNote: t.reversal ? `Reversed by ${t.reversal.reference}` : t.reversedTxn ? `Reverses ${t.reversedTxn.reference}` : null,
  };
}

/** Statement for one of the customer's accounts between two Dhaka dates (inclusive). */
export async function statementData(userId: string, accountId: string, fromDay: string, toDay: string): Promise<StatementData> {
  const account = await db.account.findFirst({ where: { id: accountId, userId }, include: { user: { select: { name: true } } } });
  if (!account) throw new AppError("NOT_FOUND", "Account not found");
  const from = new Date(`${fromDay}T00:00:00+06:00`);
  const to = new Date(`${toDay}T23:59:59.999+06:00`);
  if (from > to) throw new AppError("VALIDATION_ERROR", "Start date must be before end date");
  if (to.getTime() - from.getTime() > 400 * 86_400_000) throw new AppError("VALIDATION_ERROR", "Choose a period of at most one year");

  const [before, entries] = await Promise.all([
    db.ledgerEntry.findFirst({ where: { accountId, createdAt: { lt: from } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { balanceAfter: true } }),
    db.ledgerEntry.findMany({
      where: { accountId, createdAt: { gte: from, lte: to } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 2000,
      include: { transaction: { select: { reference: true, type: true, description: true } } },
    }),
  ]);
  const opening = before?.balanceAfter ?? BigInt(0);
  const lines: StatementLine[] = entries.map((e) => ({
    date: e.createdAt,
    reference: e.transaction.reference,
    description: e.transaction.description || TYPE_LABEL[e.transaction.type],
    debit: e.direction === "DEBIT" ? e.amount : null,
    credit: e.direction === "CREDIT" ? e.amount : null,
    balance: e.balanceAfter,
  }));
  const sum = (d: "debit" | "credit") => lines.reduce((s, l) => s + (l[d] ?? BigInt(0)), BigInt(0));
  return {
    holder: account.user.name,
    accountNumber: account.accountNumber,
    accountType: titleCase(account.type),
    from,
    to,
    opening,
    closing: lines.length ? lines[lines.length - 1]!.balance : opening,
    totalCredits: sum("credit"),
    totalDebits: sum("debit"),
    lines,
  };
}

/** RFC 4180 CSV — amounts as plain decimals so spreadsheets can sum them. */
export function statementCsv(d: StatementData) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const fmt = (v: bigint | null) => (v == null ? "" : formatAmount(v).replace(/,/g, ""));
  const date = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", dateStyle: "short", timeStyle: "short", hour12: false }).format(x);
  const rows = [
    ["Kosh statement (simulated bank - no real money)"],
    ["Account", d.accountNumber, d.accountType, d.holder],
    ["Opening balance (BDT)", fmt(d.opening)],
    [],
    ["Date (Asia/Dhaka)", "Reference", "Description", "Debit (BDT)", "Credit (BDT)", "Balance (BDT)"],
    ...d.lines.map((l) => [date(l.date), l.reference, l.description, fmt(l.debit), fmt(l.credit), fmt(l.balance)]),
    [],
    ["Closing balance (BDT)", fmt(d.closing)],
  ];
  return "﻿" + rows.map((r) => r.map((c) => esc(String(c))).join(",")).join("\r\n");
}
