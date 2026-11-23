import "server-only";
import type { LoanStatus, Prisma } from "@prisma/client";
import { db, type Tx } from "@/server/db";
import { AppError } from "@/server/errors";
import { assertNotSelf, type SessionUser } from "@/server/auth/guards";
import { writeAudit } from "@/server/audit";
import { buildSchedule, calculateEmi } from "@/lib/emi";
import { formatMoney } from "@/lib/money";
import { generateTxnReference } from "@/lib/reference";
import { LOAN_PRODUCTS, type LoanProductKey } from "@/lib/loan-products";
import { getSettings } from "./settings.service";
import { isUniqueViolation, lockAccounts, MONEY_TX_OPTIONS } from "./locks";
import { notify, notifyRoles } from "./notification.service";
import { throwPinError, verifyPinInTx, type PinCheck } from "./pin.service";

async function lockLoan(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM loans WHERE id = ${id} FOR UPDATE`;
}

/** DUE installments whose date has passed become OVERDUE (lazy, on read). */
export async function refreshOverdue(where: Prisma.LoanInstallmentWhereInput = {}) {
  await db.loanInstallment.updateMany({ where: { ...where, status: "DUE", dueDate: { lt: new Date() } }, data: { status: "OVERDUE" } });
}

// ───────────────────────── Customer ─────────────────────────

export async function applyForLoan(
  user: SessionUser,
  input: {
    loanType: LoanProductKey;
    accountId: string;
    principal: bigint;
    durationMonths: number;
    monthlyIncome: bigint;
    employmentStatus: "SALARIED" | "SELF_EMPLOYED" | "BUSINESS_OWNER" | "STUDENT" | "UNEMPLOYED" | "RETIRED";
    description: string;
  },
) {
  if (!user.isVerified) throw new AppError("FORBIDDEN", "Your profile must be verified by the bank before you can apply for a loan");
  const account = await db.account.findFirst({ where: { id: input.accountId, userId: user.id } });
  if (!account) throw new AppError("NOT_FOUND", "Account not found");
  if (account.status !== "ACTIVE") throw new AppError("ACCOUNT_FROZEN", "Choose an active account for the disbursement");

  const open = await db.loan.count({ where: { userId: user.id, status: { in: ["PENDING", "UNDER_REVIEW"] } } });
  if (open > 0) throw new AppError("INVALID_STATE", "You already have an application under review");

  const rateBps = LOAN_PRODUCTS[input.loanType].rateBps;
  const emi = calculateEmi(input.principal, rateBps, input.durationMonths);

  const loan = await db.loan.create({
    data: {
      userId: user.id,
      accountId: account.id,
      loanType: input.loanType,
      principal: input.principal,
      interestRateBps: rateBps,
      durationMonths: input.durationMonths,
      emiAmount: emi, // indicative until approval
      monthlyIncome: input.monthlyIncome,
      employmentStatus: input.employmentStatus,
      description: input.description,
    },
  });
  await notifyRoles(["STAFF"], { type: "REVIEW_QUEUE", title: "New loan application", body: `${user.name} · ${LOAN_PRODUCTS[input.loanType].label} loan of ${formatMoney(input.principal)}`, link: `/staff/loans/${loan.id}` }, user.id);
  await notify([{ userId: user.id, type: "LOAN_UPDATE", title: "Loan application received", body: `${LOAN_PRODUCTS[input.loanType].label} loan of ${formatMoney(input.principal)} — we'll review it shortly.`, link: `/loans/${loan.id}` }]);
  return loan;
}

const loanListSelect = {
  id: true, loanType: true, principal: true, interestRateBps: true, durationMonths: true, emiAmount: true,
  totalPayable: true, remainingBalance: true, status: true, createdAt: true, decidedAt: true, rejectionReason: true,
  account: { select: { id: true, accountNumber: true, type: true, nickname: true } },
} satisfies Prisma.LoanSelect;

export async function listOwnLoans(userId: string) {
  await refreshOverdue({ loan: { userId } });
  const loans = await db.loan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      ...loanListSelect,
      installments: { where: { status: { in: ["DUE", "OVERDUE"] } }, orderBy: { installmentNo: "asc" }, take: 1 },
      _count: { select: { installments: { where: { status: "PAID" } } } },
    },
  });
  return loans.map(({ installments, _count, ...l }) => ({ ...l, nextInstallment: installments[0] ?? null, paidCount: _count.installments }));
}

export async function getOwnLoan(userId: string, id: string) {
  await refreshOverdue({ loanId: id });
  const loan = await db.loan.findFirst({
    where: { id, userId },
    select: {
      ...loanListSelect,
      monthlyIncome: true, employmentStatus: true, description: true,
      installments: { orderBy: { installmentNo: "asc" } },
      disbursementTxn: { select: { id: true, reference: true, createdAt: true } },
    },
  });
  if (!loan) throw new AppError("NOT_FOUND", "Loan not found");
  return loan; // internal staff notes are deliberately NOT included for customers
}

/**
 * Pay the next unpaid installment from the loan's account (PIN required).
 * One transaction: lock loan + account → next installment → PIN → balance check →
 * debit + LOAN_REPAYMENT txn + ledger → installment PAID → remaining reduced → COMPLETED at 0.
 */
export async function repayNextInstallment(user: SessionUser, loanId: string, pin: string, idempotencyKey: string) {
  const prior = await db.transaction.findUnique({ where: { idempotencyKey } });
  if (prior) {
    if (prior.initiatedById !== user.id) throw new AppError("DUPLICATE_REQUEST", "This request was already processed");
    return { replayed: true, transaction: prior };
  }

  type Out =
    | { kind: "pin"; check: Extract<PinCheck, { ok: false }> }
    | { kind: "done"; txn: Prisma.TransactionGetPayload<object>; installmentNo: number; completed: boolean; remaining: bigint };

  let out: Out;
  try {
    out = await db.$transaction(async (tx): Promise<Out> => {
      await lockLoan(tx, loanId);
      const loan = await tx.loan.findFirst({ where: { id: loanId, userId: user.id } });
      if (!loan) throw new AppError("NOT_FOUND", "Loan not found");
      if (loan.status !== "ACTIVE") throw new AppError("INVALID_STATE", "Only active loans can be repaid");

      await lockAccounts(tx, [loan.accountId]);
      const account = await tx.account.findUniqueOrThrow({ where: { id: loan.accountId } });
      if (account.status !== "ACTIVE") throw new AppError("ACCOUNT_FROZEN", "The repayment account is not active");

      const next = await tx.loanInstallment.findFirst({ where: { loanId, status: { in: ["DUE", "OVERDUE"] } }, orderBy: { installmentNo: "asc" } });
      if (!next) throw new AppError("INVALID_STATE", "Nothing left to pay on this loan");

      const pinCheck = await verifyPinInTx(tx, account, pin, user.id);
      if (!pinCheck.ok) return { kind: "pin", check: pinCheck };

      const settings = await getSettings(tx);
      const balanceAfter = account.balance - next.amountDue;
      if (balanceAfter < settings.minimumBalance) {
        throw new AppError("INSUFFICIENT_FUNDS", `You need ${formatMoney(next.amountDue)} plus the ${formatMoney(settings.minimumBalance)} minimum balance in the account.`);
      }

      await tx.account.update({ where: { id: account.id }, data: { balance: balanceAfter } });
      const txn = await tx.transaction.create({
        data: {
          reference: generateTxnReference("LNR"),
          type: "LOAN_REPAYMENT",
          amount: next.amountDue,
          status: "COMPLETED",
          senderAccountId: account.id,
          description: `EMI #${next.installmentNo} · loan ${loan.id.slice(-6).toUpperCase()}`,
          idempotencyKey,
          initiatedById: user.id,
          ledgerEntries: { create: { accountId: account.id, direction: "DEBIT", amount: next.amountDue, balanceAfter } },
        },
      });
      await tx.loanInstallment.update({ where: { id: next.id }, data: { status: "PAID", paidTxnId: txn.id, paidAt: new Date() } });
      const remaining = loan.remainingBalance - next.amountDue;
      const left = await tx.loanInstallment.count({ where: { loanId, status: { in: ["DUE", "OVERDUE"] } } });
      const completed = left === 0;
      await tx.loan.update({
        where: { id: loanId },
        data: { remainingBalance: completed ? BigInt(0) : remaining, status: completed ? "COMPLETED" : "ACTIVE" },
      });
      return { kind: "done", txn, installmentNo: next.installmentNo, completed, remaining: completed ? BigInt(0) : remaining };
    }, MONEY_TX_OPTIONS);
  } catch (err) {
    if (isUniqueViolation(err, "idempotencyKey")) {
      const winner = await db.transaction.findUnique({ where: { idempotencyKey } });
      if (winner) return { replayed: true, transaction: winner };
    }
    throw err;
  }

  if (out.kind === "pin") return throwPinError(out.check, user.id);
  await notify([
    {
      userId: user.id,
      type: "LOAN_UPDATE",
      title: out.completed ? "Loan fully repaid 🎉" : `EMI #${out.installmentNo} paid`,
      body: out.completed ? "Congratulations — your loan is closed." : `${formatMoney(out.txn.amount)} paid. Remaining ${formatMoney(out.remaining)}.`,
      link: `/loans/${loanId}`,
    },
  ]);
  return { replayed: false, transaction: out.txn, completed: out.completed, remaining: out.remaining };
}

// ───────────────────────── Staff / Admin ─────────────────────────

export async function listLoansForReview(args: { status?: LoanStatus; page: number; pageSize: number }) {
  await refreshOverdue();
  const where: Prisma.LoanWhereInput = args.status ? { status: args.status } : {};
  const [items, total, counts] = await Promise.all([
    db.loan.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (args.page - 1) * args.pageSize,
      take: args.pageSize,
      select: {
        ...loanListSelect,
        monthlyIncome: true,
        user: { select: { id: true, name: true, email: true, isVerified: true } },
        forwardedBy: { select: { name: true } },
        _count: { select: { notes: true, installments: { where: { status: "OVERDUE" } } } },
      },
    }),
    db.loan.count({ where }),
    db.loan.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    items: items.map(({ _count, ...l }) => ({ ...l, noteCount: _count.notes, overdueCount: _count.installments })),
    total,
    page: args.page,
    pageSize: args.pageSize,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<LoanStatus, number>>,
  };
}

export async function getLoanForReview(id: string) {
  await refreshOverdue({ loanId: id });
  const loan = await db.loan.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, isVerified: true, status: true, createdAt: true, profile: { select: { phone: true } } } },
      account: { select: { id: true, accountNumber: true, type: true, balance: true, status: true, nickname: true } },
      installments: { orderBy: { installmentNo: "asc" } },
      notes: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, role: true } } } },
      forwardedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      disbursementTxn: { select: { id: true, reference: true } },
    },
  });
  if (!loan) throw new AppError("NOT_FOUND", "Loan not found");

  // Context for the decision: other loans + 90-day inflow of the borrower
  const [otherLoans, inflow] = await Promise.all([
    db.loan.findMany({
      where: { userId: loan.userId, id: { not: loan.id } },
      select: { id: true, loanType: true, principal: true, status: true, remainingBalance: true },
    }),
    db.ledgerEntry.aggregate({
      where: { account: { userId: loan.userId }, direction: "CREDIT", createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) } },
      _sum: { amount: true },
    }),
  ]);
  const emi = loan.emiAmount ?? calculateEmi(loan.principal, loan.interestRateBps, loan.durationMonths);
  return {
    ...loan,
    otherLoans,
    insight: {
      emi,
      emiToIncomePct: loan.monthlyIncome > BigInt(0) ? Number((emi * BigInt(10000)) / loan.monthlyIncome) / 100 : null,
      inflow90d: inflow._sum.amount ?? BigInt(0),
    },
  };
}

export async function addLoanNote(actor: SessionUser, loanId: string, note: string) {
  const loan = await db.loan.findUnique({ where: { id: loanId }, select: { userId: true, status: true } });
  if (!loan) throw new AppError("NOT_FOUND", "Loan not found");
  assertNotSelf(actor.id, loan.userId);
  const created = await db.$transaction(async (tx) => {
    const n = await tx.loanNote.create({ data: { loanId, authorId: actor.id, note }, include: { author: { select: { id: true, name: true, role: true } } } });
    await writeAudit({ actorId: actor.id, action: "LOAN_NOTE_ADDED", entity: "Loan", entityId: loanId }, tx);
    return n;
  });
  return created;
}

/** Staff (or admin) forwards a PENDING application for the admin decision. */
export async function forwardLoan(actor: SessionUser, loanId: string) {
  const loan = await db.$transaction(async (tx) => {
    await lockLoan(tx, loanId);
    const l = await tx.loan.findUnique({ where: { id: loanId } });
    if (!l) throw new AppError("NOT_FOUND", "Loan not found");
    assertNotSelf(actor.id, l.userId);
    if (l.status !== "PENDING") throw new AppError("INVALID_STATE", "Only pending applications can be forwarded");
    const notes = await tx.loanNote.count({ where: { loanId } });
    if (notes === 0) throw new AppError("VALIDATION_ERROR", "Add a review note before forwarding");
    const updated = await tx.loan.update({ where: { id: loanId }, data: { status: "UNDER_REVIEW", forwardedById: actor.id, forwardedAt: new Date() } });
    await writeAudit({ actorId: actor.id, action: "LOAN_FORWARDED", entity: "Loan", entityId: loanId }, tx);
    return updated;
  });
  await notifyRoles(["ADMIN"], { type: "REVIEW_QUEUE", title: "Loan awaiting your decision", body: `${formatMoney(loan.principal)} ${LOAN_PRODUCTS[loan.loanType].label.toLowerCase()} loan forwarded by ${actor.name}.`, link: `/admin/loans/${loan.id}` }, actor.id);
  await notify([{ userId: loan.userId, type: "LOAN_UPDATE", title: "Loan application under review", body: "Your application has passed the first review and is with our credit team.", link: `/loans/${loan.id}` }]);
  return loan;
}

/**
 * Admin approval — ONE transaction: lock loan + account → status check →
 * LOAN_DISBURSEMENT txn credits the account (+ ledger) → EMI schedule rows →
 * status ACTIVE (APPROVED is never left persisted half-way).
 */
export async function approveLoan(admin: SessionUser, loanId: string) {
  const result = await db.$transaction(async (tx) => {
    await lockLoan(tx, loanId);
    const loan = await tx.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new AppError("NOT_FOUND", "Loan not found");
    assertNotSelf(admin.id, loan.userId);
    if (loan.status !== "PENDING" && loan.status !== "UNDER_REVIEW") {
      throw new AppError("INVALID_STATE", `This loan is already ${loan.status.toLowerCase().replace("_", " ")}`);
    }

    await lockAccounts(tx, [loan.accountId]);
    const account = await tx.account.findUniqueOrThrow({ where: { id: loan.accountId } });
    if (account.userId !== loan.userId) throw new AppError("INVALID_STATE", "Disbursement account doesn't belong to the borrower");
    if (account.status !== "ACTIVE") throw new AppError("ACCOUNT_FROZEN", "The disbursement account is not active");

    const now = new Date();
    const schedule = buildSchedule(loan.principal, loan.interestRateBps, loan.durationMonths, now);
    const balanceAfter = account.balance + loan.principal;

    await tx.account.update({ where: { id: account.id }, data: { balance: balanceAfter } });
    const txn = await tx.transaction.create({
      data: {
        reference: generateTxnReference("LND", now),
        type: "LOAN_DISBURSEMENT",
        amount: loan.principal,
        status: "COMPLETED",
        receiverAccountId: account.id,
        description: `${LOAN_PRODUCTS[loan.loanType].label} loan disbursement`,
        initiatedById: admin.id,
        ledgerEntries: { create: { accountId: account.id, direction: "CREDIT", amount: loan.principal, balanceAfter } },
      },
    });
    await tx.loanInstallment.createMany({ data: schedule.rows.map((r) => ({ ...r, loanId })) });
    const updated = await tx.loan.update({
      where: { id: loanId },
      data: {
        status: "ACTIVE",
        approvedById: admin.id,
        decidedAt: now,
        emiAmount: schedule.emi,
        totalPayable: schedule.totalPayable,
        remainingBalance: schedule.totalPayable,
        disbursementTxnId: txn.id,
      },
    });
    await writeAudit({ actorId: admin.id, action: "LOAN_APPROVED", entity: "Loan", entityId: loanId, metadata: { principal: loan.principal.toString(), transactionId: txn.id } }, tx);
    return { loan: updated, transaction: txn, firstDue: schedule.rows[0]!.dueDate };
  }, MONEY_TX_OPTIONS);

  await notify([
    {
      userId: result.loan.userId,
      type: "LOAN_APPROVED",
      title: "Loan approved & disbursed",
      body: `${formatMoney(result.loan.principal)} credited. EMI ${formatMoney(result.loan.emiAmount!)} — first due ${result.firstDue.toISOString().slice(0, 10)}.`,
      link: `/loans/${result.loan.id}`,
    },
  ]);
  return result;
}

export async function rejectLoan(admin: SessionUser, loanId: string, reason: string) {
  const loan = await db.$transaction(async (tx) => {
    await lockLoan(tx, loanId);
    const l = await tx.loan.findUnique({ where: { id: loanId } });
    if (!l) throw new AppError("NOT_FOUND", "Loan not found");
    assertNotSelf(admin.id, l.userId);
    if (l.status !== "PENDING" && l.status !== "UNDER_REVIEW") throw new AppError("INVALID_STATE", "This loan has already been decided");
    const updated = await tx.loan.update({ where: { id: loanId }, data: { status: "REJECTED", rejectionReason: reason, approvedById: admin.id, decidedAt: new Date() } });
    await writeAudit({ actorId: admin.id, action: "LOAN_REJECTED", entity: "Loan", entityId: loanId, metadata: { reason } }, tx);
    return updated;
  });
  await notify([{ userId: loan.userId, type: "LOAN_REJECTED", title: "Loan application rejected", body: reason, link: `/loans/${loan.id}` }]);
  return { loan };
}
