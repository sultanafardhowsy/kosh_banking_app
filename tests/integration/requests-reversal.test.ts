import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { approveRequest, createRequest, rejectRequest } from "@/server/services/request.service";
import { reverseTransaction, flagTransaction } from "@/server/services/transaction-admin.service";
import { executeTransfer } from "@/server/services/transfer.service";
import { setPin } from "@/server/services/pin.service";
import { computeTransferFee } from "@/lib/fees";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { balanceOf, codeOf, hasTestDb, key, ledgerMismatches, makeAccount, makeUser, PIN, resetDb, tk } from "../helpers/factory";

describe.skipIf(!hasTestDb)("deposit / withdrawal requests (integration)", () => {
  beforeEach(resetDb);

  it("approving a deposit credits the account with a transaction, ledger row and audit log", async () => {
    const cust = await makeUser();
    const staff = await makeUser("STAFF");
    const a = await makeAccount(cust.id, 1_000);

    const req = await createRequest(cust, { accountId: a.id, type: "DEPOSIT", amount: tk(2_500) });
    expect(req.status).toBe("PENDING");
    expect(await balanceOf(a.id)).toBe(tk(1_000)); // nothing moves until approval

    const res = await approveRequest(staff, req.id);
    expect(res.request.status).toBe("APPROVED");
    expect(await balanceOf(a.id)).toBe(tk(3_500));
    expect(await db.auditLog.count({ where: { action: "DEPOSIT_APPROVED", entityId: req.id } })).toBe(1);
    expect(await ledgerMismatches()).toHaveLength(0);
  });

  it("re-checks the balance at approval time for withdrawals", async () => {
    const cust = await makeUser();
    const staff = await makeUser("STAFF");
    const a = await makeAccount(cust.id, 5_000);
    const b = await makeAccount((await makeUser()).id, 0);

    const req = await createRequest(cust, { accountId: a.id, type: "WITHDRAWAL", amount: tk(4_000) }); // fine now
    await executeTransfer(cust.id, { fromAccountId: a.id, toAccountNumber: b.accountNumber, amount: tk(3_000), description: "", pin: PIN, idempotencyKey: key() });

    expect(await codeOf(approveRequest(staff, req.id))).toBe("INSUFFICIENT_FUNDS");
    expect((await db.depositWithdrawalRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("PENDING");
  });

  it("staff can't approve or reject their own request", async () => {
    const staff = await makeUser("STAFF");
    const a = await makeAccount(staff.id, 5_000); // staff member who also banks here
    const req = await db.depositWithdrawalRequest.create({
      data: { accountId: a.id, type: "DEPOSIT", amount: tk(100), requestedById: staff.id },
    });
    expect(await codeOf(approveRequest(staff, req.id))).toBe("SELF_ACTION_NOT_ALLOWED");
    expect(await codeOf(rejectRequest(staff, req.id, "nope"))).toBe("SELF_ACTION_NOT_ALLOWED");
  });

  it("a request can only be decided once, even when two reviewers click at the same time", async () => {
    const cust = await makeUser();
    const s1 = await makeUser("STAFF");
    const s2 = await makeUser("STAFF");
    const a = await makeAccount(cust.id, 1_000);
    const req = await createRequest(cust, { accountId: a.id, type: "DEPOSIT", amount: tk(1_000) });

    const codes = await Promise.all([codeOf(approveRequest(s1, req.id)), codeOf(approveRequest(s2, req.id))]);
    expect(codes.sort()).toEqual(["INVALID_STATE", "OK"]);
    expect(await balanceOf(a.id)).toBe(tk(2_000));
    expect(await codeOf(rejectRequest(s1, req.id, "late"))).toBe("INVALID_STATE");
  });

  it("rejecting records the note and notifies the customer", async () => {
    const cust = await makeUser();
    const staff = await makeUser("STAFF");
    const a = await makeAccount(cust.id, 1_000);
    const req = await createRequest(cust, { accountId: a.id, type: "DEPOSIT", amount: tk(1_000) });
    const res = await rejectRequest(staff, req.id, "Slip unreadable");
    expect(res.request.status).toBe("REJECTED");
    expect(res.request.reviewNote).toBe("Slip unreadable");
    expect(await db.notification.count({ where: { userId: cust.id, type: "REQUEST_REJECTED" } })).toBe(1);
  });

  it("can't request on someone else's account", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const a = await makeAccount(owner.id, 1_000);
    expect(await codeOf(createRequest(other, { accountId: a.id, type: "DEPOSIT", amount: tk(10) }))).toBe("NOT_FOUND");
  });
});

describe.skipIf(!hasTestDb)("reversal & flagging (integration)", () => {
  beforeEach(resetDb);

  it("reversal creates a compensating transaction, refunds the fee and keeps the original", async () => {
    const admin = await makeUser("ADMIN");
    const alice = await makeUser();
    const a = await makeAccount(alice.id, 10_000);
    const b = await makeAccount((await makeUser()).id, 1_000);
    const t = await executeTransfer(alice.id, { fromAccountId: a.id, toAccountNumber: b.accountNumber, amount: tk(2_000), description: "", pin: PIN, idempotencyKey: key() });

    const { reversal, original } = await reverseTransaction(admin, t.transaction.id, "Customer dispute upheld");

    expect(original.status).toBe("REVERSED");
    expect(reversal.type).toBe("REVERSAL");
    expect(reversal.reversedTxnId).toBe(t.transaction.id);
    expect(await balanceOf(a.id)).toBe(tk(10_000)); // amount + fee back
    expect(await balanceOf(b.id)).toBe(tk(1_000));
    const stored = await db.transaction.findUniqueOrThrow({ where: { id: t.transaction.id } });
    expect(stored.amount).toBe(tk(2_000)); // history intact
    expect(stored.fee).toBe(computeTransferFee(tk(2_000), DEFAULT_SETTINGS));
    expect(await db.ledgerEntry.count({ where: { transactionId: t.transaction.id } })).toBe(2);
    expect(await db.auditLog.count({ where: { action: "TRANSACTION_REVERSED" } })).toBe(1);
    expect(await ledgerMismatches()).toHaveLength(0);

    expect(await codeOf(reverseTransaction(admin, t.transaction.id, "again"))).toBe("INVALID_STATE");
  });

  it("refuses to reverse when the receiver has already spent the money", async () => {
    const admin = await makeUser("ADMIN");
    const alice = await makeUser();
    const bob = await makeUser();
    const a = await makeAccount(alice.id, 10_000);
    const b = await makeAccount(bob.id, 500);
    const c = await makeAccount((await makeUser()).id, 0);
    const t = await executeTransfer(alice.id, { fromAccountId: a.id, toAccountNumber: b.accountNumber, amount: tk(5_000), description: "", pin: PIN, idempotencyKey: key() });
    await executeTransfer(bob.id, { fromAccountId: b.id, toAccountNumber: c.accountNumber, amount: tk(4_900), description: "", pin: PIN, idempotencyKey: key() });

    expect(await codeOf(reverseTransaction(admin, t.transaction.id, "too late"))).toBe("INSUFFICIENT_FUNDS");
    expect((await db.transaction.findUniqueOrThrow({ where: { id: t.transaction.id } })).status).toBe("COMPLETED");
  });

  it("staff can manually flag a transaction", async () => {
    const staff = await makeUser("STAFF");
    const alice = await makeUser();
    const a = await makeAccount(alice.id, 10_000);
    const b = await makeAccount((await makeUser()).id, 0);
    const t = await executeTransfer(alice.id, { fromAccountId: a.id, toAccountNumber: b.accountNumber, amount: tk(100), description: "", pin: PIN, idempotencyKey: key() });
    const flagged = await flagTransaction(staff, t.transaction.id, "Odd pattern");
    expect(flagged.isFlagged).toBe(true);
    expect(flagged.flaggedById).toBe(staff.id);
    expect(await codeOf(flagTransaction(staff, t.transaction.id, "again"))).toBe("INVALID_STATE");
  });
});

describe.skipIf(!hasTestDb)("transaction PIN (integration)", () => {
  beforeEach(resetDb);

  it("sets a first PIN, then requires the current PIN to change it", async () => {
    const u = await makeUser();
    const a = await makeAccount(u.id, 1_000, { pin: null });
    await setPin({ userId: u.id, accountId: a.id, newPin: "4826" });
    expect(await codeOf(setPin({ userId: u.id, accountId: a.id, newPin: "5937" }))).toBe("VALIDATION_ERROR");
    expect(await codeOf(setPin({ userId: u.id, accountId: a.id, currentPin: "0000", newPin: "5937" }))).toBe("INVALID_PIN");
    expect(await codeOf(setPin({ userId: u.id, accountId: a.id, currentPin: "4826", newPin: "5937" }))).toBe("OK");
  });

  it("transfers from an account without a PIN are refused", async () => {
    const u = await makeUser();
    const a = await makeAccount(u.id, 5_000, { pin: null });
    const b = await makeAccount((await makeUser()).id, 0);
    expect(await codeOf(executeTransfer(u.id, { fromAccountId: a.id, toAccountNumber: b.accountNumber, amount: tk(10), description: "", pin: "1234", idempotencyKey: key() }))).toBe("PIN_NOT_SET");
  });
});
