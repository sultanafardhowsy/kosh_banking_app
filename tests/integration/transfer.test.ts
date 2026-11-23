import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { executeTransfer, previewTransfer } from "@/server/services/transfer.service";
import { transferSchema, type TransferInput } from "@/lib/validators/money";
import { computeTransferFee } from "@/lib/fees";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { balanceOf, codeOf, hasTestDb, key, ledgerMismatches, makeAccount, makeUser, PIN, resetDb, tk } from "../helpers/factory";

const fee = (amount: bigint) => computeTransferFee(amount, DEFAULT_SETTINGS);

function input(fromAccountId: string, toAccountNumber: string, amountTaka: number, extra: Partial<TransferInput> = {}): TransferInput {
  return { fromAccountId, toAccountNumber, amount: tk(amountTaka), description: "", pin: PIN, idempotencyKey: key(), ...extra };
}

describe.skipIf(!hasTestDb)("fund transfer (integration)", () => {
  beforeEach(resetDb);

  it("moves money atomically with a server-computed fee and two ledger entries", async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const a = await makeAccount(alice.id, 10_000);
    const b = await makeAccount(bob.id, 1_000);

    const res = await executeTransfer(alice.id, input(a.id, b.accountNumber, 2_000));

    const f = fee(tk(2_000));
    expect(res.transaction.fee).toBe(f);
    expect(await balanceOf(a.id)).toBe(tk(10_000) - tk(2_000) - f);
    expect(await balanceOf(b.id)).toBe(tk(3_000));
    const entries = await db.ledgerEntry.findMany({ where: { transactionId: res.transaction.id }, orderBy: { direction: "asc" } });
    expect(entries.map((e) => [e.direction, e.amount])).toEqual([
      ["DEBIT", tk(2_000) + f], // enum order: DEBIT, CREDIT
      ["CREDIT", tk(2_000)],
    ]);
    expect(await db.notification.count()).toBe(2); // sent + received
    expect(await ledgerMismatches()).toHaveLength(0);
  });

  it("rejects a transfer larger than the balance and changes nothing", async () => {
    const alice = await makeUser();
    const a = await makeAccount(alice.id, 1_000);
    const b = await makeAccount((await makeUser()).id, 0);

    expect(await codeOf(executeTransfer(alice.id, input(a.id, b.accountNumber, 5_000)))).toBe("INSUFFICIENT_FUNDS");
    expect(await balanceOf(a.id)).toBe(tk(1_000));
    expect(await balanceOf(b.id)).toBe(BigInt(0));
    expect(await db.transaction.count({ where: { type: "TRANSFER" } })).toBe(0);
  });

  it("enforces the minimum balance (amount + fee must leave ৳500)", async () => {
    const alice = await makeUser();
    const a = await makeAccount(alice.id, 1_000);
    const b = await makeAccount((await makeUser()).id, 0);
    // ৳500 + fee leaves less than ৳500 → rejected; ৳480 + ৳6.20 fee leaves ৳513.80 → ok
    expect(await codeOf(executeTransfer(alice.id, input(a.id, b.accountNumber, 500)))).toBe("INSUFFICIENT_FUNDS");
    expect(await codeOf(executeTransfer(alice.id, input(a.id, b.accountNumber, 480)))).toBe("OK");
  });

  it("two simultaneous transfers draining one account: only the valid ones succeed", async () => {
    const alice = await makeUser();
    const a = await makeAccount(alice.id, 10_000);
    const b = await makeAccount((await makeUser()).id, 0);

    // ৳10,000 can cover two ৳4,000 transfers (+fees) but not a third.
    const results = await Promise.all(Array.from({ length: 5 }, () => codeOf(executeTransfer(alice.id, input(a.id, b.accountNumber, 4_000)))));

    expect(results.filter((r) => r === "OK")).toHaveLength(2);
    expect(results.filter((r) => r === "INSUFFICIENT_FUNDS")).toHaveLength(3);
    expect(await balanceOf(a.id)).toBe(tk(10_000) - BigInt(2) * (tk(4_000) + fee(tk(4_000))));
    expect(await balanceOf(b.id)).toBe(tk(8_000));
    expect(await ledgerMismatches()).toHaveLength(0);
  });

  it("opposite-direction transfers in parallel don't deadlock and conserve money", async () => {
    const u1 = await makeUser();
    const u2 = await makeUser();
    const a = await makeAccount(u1.id, 50_000);
    const b = await makeAccount(u2.id, 50_000);

    const jobs = Array.from({ length: 10 }, (_, i) =>
      i % 2 === 0 ? executeTransfer(u1.id, input(a.id, b.accountNumber, 1_000)) : executeTransfer(u2.id, input(b.id, a.accountNumber, 1_000)),
    );
    const settled = await Promise.allSettled(jobs);
    expect(settled.every((s) => s.status === "fulfilled")).toBe(true);

    const fees = BigInt(10) * fee(tk(1_000));
    expect((await balanceOf(a.id)) + (await balanceOf(b.id))).toBe(tk(100_000) - fees);
    expect(await ledgerMismatches()).toHaveLength(0);
  });

  it("same idempotency key twice → one transaction (sequential and concurrent)", async () => {
    const alice = await makeUser();
    const a = await makeAccount(alice.id, 20_000);
    const b = await makeAccount((await makeUser()).id, 0);

    const body = input(a.id, b.accountNumber, 1_000);
    const first = await executeTransfer(alice.id, body);
    const second = await executeTransfer(alice.id, body);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.transaction.id).toBe(first.transaction.id);

    const concurrent = input(a.id, b.accountNumber, 500);
    const all = await Promise.all(Array.from({ length: 5 }, () => executeTransfer(alice.id, concurrent)));
    expect(new Set(all.map((r) => r.transaction.id)).size).toBe(1);

    expect(await db.transaction.count({ where: { type: "TRANSFER" } })).toBe(2);
    expect(await balanceOf(b.id)).toBe(tk(1_500));
  });

  it("another user replaying someone's idempotency key gets DUPLICATE_REQUEST", async () => {
    const alice = await makeUser();
    const mallory = await makeUser();
    const a = await makeAccount(alice.id, 5_000);
    const m = await makeAccount(mallory.id, 5_000);
    const body = input(a.id, m.accountNumber, 100);
    await executeTransfer(alice.id, body);
    expect(await codeOf(executeTransfer(mallory.id, { ...body, fromAccountId: m.id }))).toBe("DUPLICATE_REQUEST");
  });

  it("wrong PIN 5 times locks the PIN; attempts survive the rollback", async () => {
    const alice = await makeUser();
    const a = await makeAccount(alice.id, 5_000);
    const b = await makeAccount((await makeUser()).id, 0);

    const codes: string[] = [];
    for (let i = 0; i < 5; i++) codes.push(await codeOf(executeTransfer(alice.id, input(a.id, b.accountNumber, 100, { pin: "9999" }))));
    expect(codes).toEqual(["INVALID_PIN", "INVALID_PIN", "INVALID_PIN", "INVALID_PIN", "PIN_LOCKED"]);

    // Even the right PIN is refused while locked
    expect(await codeOf(executeTransfer(alice.id, input(a.id, b.accountNumber, 100)))).toBe("PIN_LOCKED");
    const acc = await db.account.findUniqueOrThrow({ where: { id: a.id } });
    expect(acc.pinLockedUntil!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    expect(await db.securityEvent.count({ where: { accountId: a.id, type: "PIN_FAILED" } })).toBe(5);
    expect(await balanceOf(a.id)).toBe(tk(5_000));
  });

  it("a correct PIN resets the failure counter", async () => {
    const alice = await makeUser();
    const a = await makeAccount(alice.id, 5_000);
    const b = await makeAccount((await makeUser()).id, 0);
    await codeOf(executeTransfer(alice.id, input(a.id, b.accountNumber, 100, { pin: "0000" })));
    await executeTransfer(alice.id, input(a.id, b.accountNumber, 100));
    expect((await db.account.findUniqueOrThrow({ where: { id: a.id } })).pinAttempts).toBe(0);
  });

  it("frozen sender, frozen receiver and blocked recipient are all rejected (no PIN attempt used)", async () => {
    const alice = await makeUser();
    const frozen = await makeAccount(alice.id, 5_000, { status: "FROZEN" });
    const ok = await makeAccount(alice.id, 5_000);
    const frozenTo = await makeAccount((await makeUser()).id, 0, { status: "FROZEN" });
    const blockedUser = await makeUser("CUSTOMER", "BLOCKED");
    const blockedTo = await makeAccount(blockedUser.id, 0);
    const fine = await makeAccount((await makeUser()).id, 0);

    expect(await codeOf(executeTransfer(alice.id, input(frozen.id, fine.accountNumber, 100, { pin: "9999" })))).toBe("ACCOUNT_FROZEN");
    expect((await db.account.findUniqueOrThrow({ where: { id: frozen.id } })).pinAttempts).toBe(0);
    expect(await codeOf(executeTransfer(alice.id, input(ok.id, frozenTo.accountNumber, 100)))).toBe("ACCOUNT_FROZEN");
    expect(await codeOf(executeTransfer(alice.id, input(ok.id, blockedTo.accountNumber, 100)))).toBe("ACCOUNT_FROZEN");
  });

  it("enforces max single transaction and the daily limit", async () => {
    const alice = await makeUser();
    const a = await makeAccount(alice.id, 100_000, { maxSingle: tk(10_000), dailyLimit: tk(15_000) });
    const b = await makeAccount((await makeUser()).id, 0);

    expect(await codeOf(executeTransfer(alice.id, input(a.id, b.accountNumber, 12_000)))).toBe("LIMIT_EXCEEDED");
    expect(await codeOf(executeTransfer(alice.id, input(a.id, b.accountNumber, 9_000)))).toBe("OK");
    expect(await codeOf(executeTransfer(alice.id, input(a.id, b.accountNumber, 7_000)))).toBe("LIMIT_EXCEEDED"); // 9k + 7k > 15k
    expect(await codeOf(executeTransfer(alice.id, input(a.id, b.accountNumber, 6_000)))).toBe("OK"); // exactly 15k

    const preview = await previewTransfer(alice.id, { fromAccountId: a.id, toAccountNumber: b.accountNumber, amount: tk(1) }).catch((e) => e);
    expect(preview.code).toBe("LIMIT_EXCEEDED");
  });

  it("customer can't send from another customer's account (404, not 403)", async () => {
    const alice = await makeUser();
    const mallory = await makeUser();
    const a = await makeAccount(alice.id, 5_000);
    const m = await makeAccount(mallory.id, 0);
    expect(await codeOf(executeTransfer(mallory.id, input(a.id, m.accountNumber, 100)))).toBe("NOT_FOUND");
    expect(await balanceOf(a.id)).toBe(tk(5_000));
  });

  it("same account and unknown recipient are rejected", async () => {
    const alice = await makeUser();
    const a = await makeAccount(alice.id, 5_000);
    expect(await codeOf(executeTransfer(alice.id, input(a.id, a.accountNumber, 100)))).toBe("SAME_ACCOUNT");
    expect(await codeOf(executeTransfer(alice.id, input(a.id, "101000000000", 100)))).toBe("RECIPIENT_NOT_FOUND");
  });

  it("ignores a tampered fee/balance in the request body", async () => {
    const alice = await makeUser();
    const a = await makeAccount(alice.id, 5_000);
    const b = await makeAccount((await makeUser()).id, 0);
    const tampered = transferSchema.parse({
      fromAccountId: a.id,
      toAccountNumber: b.accountNumber,
      amount: "100000",
      pin: PIN,
      idempotencyKey: key(),
      fee: "0",
      balance: "99999999",
    });
    expect(tampered).not.toHaveProperty("fee");
    const res = await executeTransfer(alice.id, tampered);
    expect(res.transaction.fee).toBe(fee(tk(1_000)));
  });

  it("flags a transfer of ≥80% of the balance", async () => {
    const alice = await makeUser();
    const a = await makeAccount(alice.id, 10_000);
    const b = await makeAccount((await makeUser()).id, 0);
    const res = await executeTransfer(alice.id, input(a.id, b.accountNumber, 8_500));
    expect(res.transaction.isFlagged).toBe(true);
    expect(res.transaction.flagReason).toMatch(/80%/);
  });

  it("flags more than 5 transfers in 10 minutes", async () => {
    const alice = await makeUser();
    const a = await makeAccount(alice.id, 100_000);
    const b = await makeAccount((await makeUser()).id, 0);
    let last;
    for (let i = 0; i < 6; i++) last = await executeTransfer(alice.id, input(a.id, b.accountNumber, 100));
    expect(last!.transaction.isFlagged).toBe(true);
    expect(last!.transaction.flagReason).toMatch(/More than 5 transfers/);
  });
});
