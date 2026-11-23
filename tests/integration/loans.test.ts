import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  addLoanNote, applyForLoan, approveLoan, forwardLoan, getOwnLoan, rejectLoan, repayNextInstallment,
} from "@/server/services/loan.service";
import { loanApplySchema } from "@/lib/validators/money";
import { balanceOf, codeOf, hasTestDb, key, ledgerMismatches, makeAccount, makeUser, PIN, resetDb, tk } from "../helpers/factory";

const application = (accountId: string, overrides: Record<string, unknown> = {}) =>
  loanApplySchema.parse({
    loanType: "PERSONAL",
    accountId,
    principal: String(tk(60_000)),
    durationMonths: 6,
    monthlyIncome: String(tk(50_000)),
    employmentStatus: "SALARIED",
    description: "Laptop and course fees",
    ...overrides,
  });

describe.skipIf(!hasTestDb)("loans (integration)", () => {
  beforeEach(resetDb);

  async function setup(balance = 5_000) {
    const cust = await makeUser();
    const staff = await makeUser("STAFF");
    const admin = await makeUser("ADMIN");
    const acc = await makeAccount(cust.id, balance);
    return { cust, staff, admin, acc };
  }

  it("validates product limits and lets the server pick the rate", async () => {
    const { cust, acc } = await setup();
    expect(loanApplySchema.safeParse({ ...application(acc.id), principal: String(tk(100)) }).success).toBe(false);
    expect(loanApplySchema.safeParse({ ...application(acc.id), durationMonths: 99 }).success).toBe(false);
    const loan = await applyForLoan(cust, { ...application(acc.id), interestRateBps: 1 } as never);
    expect(loan.status).toBe("PENDING");
    expect(loan.interestRateBps).toBe(1200);
  });

  it("only one open application at a time; unverified customers can't apply", async () => {
    const { cust, acc } = await setup();
    await applyForLoan(cust, application(acc.id));
    expect(await codeOf(applyForLoan(cust, application(acc.id)))).toBe("INVALID_STATE");
    expect(await codeOf(applyForLoan({ ...cust, isVerified: false }, application(acc.id)))).toBe("FORBIDDEN");
  });

  it("staff note → forward → admin approve disburses and creates the schedule atomically", async () => {
    const { cust, staff, admin, acc } = await setup();
    const loan = await applyForLoan(cust, application(acc.id));

    expect(await codeOf(forwardLoan(staff, loan.id))).toBe("VALIDATION_ERROR"); // needs a note first
    await addLoanNote(staff, loan.id, "Income verified");
    const fwd = await forwardLoan(staff, loan.id);
    expect(fwd.status).toBe("UNDER_REVIEW");

    const { loan: approved, transaction } = await approveLoan(admin, loan.id);
    expect(approved.status).toBe("ACTIVE");
    expect(transaction.type).toBe("LOAN_DISBURSEMENT");
    expect(await balanceOf(acc.id)).toBe(tk(65_000));
    const inst = await db.loanInstallment.findMany({ where: { loanId: loan.id } });
    expect(inst).toHaveLength(6);
    expect(inst.reduce((s, i) => s + i.principalPart, BigInt(0))).toBe(tk(60_000));
    expect(approved.remainingBalance).toBe(approved.totalPayable);
    expect(await ledgerMismatches()).toHaveLength(0);

    expect(await codeOf(approveLoan(admin, loan.id))).toBe("INVALID_STATE"); // no double disbursement
  });

  it("approval rolls back completely if the account is frozen", async () => {
    const { cust, admin, acc } = await setup();
    const loan = await applyForLoan(cust, application(acc.id));
    await db.account.update({ where: { id: acc.id }, data: { status: "FROZEN" } });
    expect(await codeOf(approveLoan(admin, loan.id))).toBe("ACCOUNT_FROZEN");
    expect(await db.loanInstallment.count()).toBe(0);
    expect(await db.transaction.count({ where: { type: "LOAN_DISBURSEMENT" } })).toBe(0);
    expect((await db.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).toBe("PENDING");
  });

  it("staff/admin can't act on their own loan; staff can't approve", async () => {
    const staff = await makeUser("STAFF");
    const admin = await makeUser("ADMIN");
    const acc = await makeAccount(staff.id, 5_000);
    const loan = await db.loan.create({
      data: { userId: staff.id, accountId: acc.id, loanType: "PERSONAL", principal: tk(20_000), interestRateBps: 1200, durationMonths: 6, monthlyIncome: tk(40_000), employmentStatus: "SALARIED" },
    });
    expect(await codeOf(addLoanNote(staff, loan.id, "looks fine"))).toBe("SELF_ACTION_NOT_ALLOWED");
    expect(await codeOf(forwardLoan(staff, loan.id))).toBe("SELF_ACTION_NOT_ALLOWED");
    const adminAcc = await makeAccount(admin.id, 5_000);
    const adminLoan = await db.loan.create({
      data: { userId: admin.id, accountId: adminAcc.id, loanType: "PERSONAL", principal: tk(20_000), interestRateBps: 1200, durationMonths: 6, monthlyIncome: tk(40_000), employmentStatus: "SALARIED" },
    });
    expect(await codeOf(approveLoan(admin, adminLoan.id))).toBe("SELF_ACTION_NOT_ALLOWED");
  });

  it("reject records the reason; customer view hides internal notes", async () => {
    const { cust, staff, admin, acc } = await setup();
    const loan = await applyForLoan(cust, application(acc.id));
    await addLoanNote(staff, loan.id, "Internal: employer unreachable");
    await rejectLoan(admin, loan.id, "Could not verify employment");
    const view = await getOwnLoan(cust.id, loan.id);
    expect(view.status).toBe("REJECTED");
    expect(view.rejectionReason).toBe("Could not verify employment");
    expect(JSON.stringify(view, (_, v) => (typeof v === "bigint" ? v.toString() : v))).not.toContain("employer unreachable");
  });

  it("repays installments in order, needs the PIN, and completes the loan at zero", async () => {
    const { cust, admin, acc } = await setup(50_000);
    const loan = await applyForLoan(cust, application(acc.id, { durationMonths: 6 }));
    const { loan: active } = await approveLoan(admin, loan.id);

    expect(await codeOf(repayNextInstallment(cust, loan.id, "0000", key()))).toBe("INVALID_PIN");

    const k = key();
    const first = await repayNextInstallment(cust, loan.id, PIN, k);
    const replay = await repayNextInstallment(cust, loan.id, PIN, k);
    expect(replay.replayed).toBe(true);
    expect(replay.transaction.id).toBe(first.transaction.id);

    for (let i = 0; i < 5; i++) await repayNextInstallment(cust, loan.id, PIN, key());
    const done = await db.loan.findUniqueOrThrow({ where: { id: loan.id } });
    expect(done.status).toBe("COMPLETED");
    expect(done.remainingBalance).toBe(BigInt(0));
    expect(await db.loanInstallment.count({ where: { loanId: loan.id, status: "PAID" } })).toBe(6);
    expect(await balanceOf(acc.id)).toBe(tk(50_000) + tk(60_000) - active.totalPayable!);
    expect(await codeOf(repayNextInstallment(cust, loan.id, PIN, key()))).toBe("INVALID_STATE");
    expect(await ledgerMismatches()).toHaveLength(0);
  });

  it("repayment respects the minimum balance", async () => {
    const { cust, admin, acc } = await setup(0);
    const loan = await applyForLoan(cust, application(acc.id, { principal: String(tk(10_000)), durationMonths: 6 }));
    await approveLoan(admin, loan.id);
    // drain to just above the minimum via a withdrawal-like adjustment
    await db.account.update({ where: { id: acc.id }, data: { balance: tk(600) } });
    await db.ledgerEntry.create({ data: { transactionId: (await db.transaction.findFirstOrThrow({ where: { type: "LOAN_DISBURSEMENT" } })).id, accountId: acc.id, direction: "DEBIT", amount: tk(9_400), balanceAfter: tk(600) } });
    expect(await codeOf(repayNextInstallment(cust, loan.id, PIN, key()))).toBe("INSUFFICIENT_FUNDS");
  });

  it("another customer can't see or repay someone's loan", async () => {
    const { cust, admin, acc } = await setup(50_000);
    const other = await makeUser();
    const loan = await applyForLoan(cust, application(acc.id));
    await approveLoan(admin, loan.id);
    expect(await codeOf(getOwnLoan(other.id, loan.id))).toBe("NOT_FOUND");
    expect(await codeOf(repayNextInstallment(other, loan.id, PIN, key()))).toBe("NOT_FOUND");
  });
});
