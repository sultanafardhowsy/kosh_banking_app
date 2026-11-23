import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { blockCard, listOwnCards, payWithCard, requestCard, reviewCard, setCardFrozenAsStaff, updateOwnCard } from "@/server/services/card.service";
import { codeOf, hasTestDb, key, ledgerMismatches, makeAccount, makeUser, PIN, resetDb, tk } from "../helpers/factory";

const ser = (x: unknown) => JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() : v));

describe.skipIf(!hasTestDb)("virtual cards (integration)", () => {
  beforeEach(resetDb);

  async function issued(balance = 10_000) {
    const cust = await makeUser();
    const staff = await makeUser("STAFF");
    const admin = await makeUser("ADMIN");
    const acc = await makeAccount(cust.id, balance);
    const req = await requestCard(cust, { accountId: acc.id, network: "VISA" });
    const card = await reviewCard(staff, req.id, { action: "approve" });
    return { cust, staff, admin, acc, card };
  }
  const pay = (u: Awaited<ReturnType<typeof makeUser>>, cardId: string, amountTaka: number, pin = PIN) =>
    payWithCard(u, cardId, { merchant: "Shwapno", amount: tk(amountTaka), pin, idempotencyKey: key() });

  it("request → approve issues a masked, non-real number; one card per account", async () => {
    const { cust, acc, card } = await issued();
    expect(card.status).toBe("ACTIVE");
    expect(card.cardNumberMasked).toMatch(/^4000 •••• •••• \d{4}$/);
    expect(card.expiryYear).toBeGreaterThan(new Date().getUTCFullYear());
    expect(await codeOf(requestCard(cust, { accountId: acc.id, network: "VISA" }))).toBe("INVALID_STATE");
  });

  it("the full card number is never stored or returned", async () => {
    const { cust } = await issued();
    const row = await db.card.findFirstOrThrow({ where: { userId: cust.id } });
    expect(Object.keys(row)).not.toContain("cardNumber");
    expect(ser(await listOwnCards(cust.id))).not.toMatch(/\d{16}/);
    expect(ser(row)).not.toMatch(/\d{16}/);
  });

  it("payment debits the account atomically with a CARD_PAYMENT ledger entry", async () => {
    const { cust, acc, card } = await issued();
    const r = await pay(cust, card.id, 1_200);
    expect(r.transaction.type).toBe("CARD_PAYMENT");
    expect(r.transaction.fee).toBe(BigInt(0));
    expect((await db.account.findUniqueOrThrow({ where: { id: acc.id } })).balance).toBe(tk(8_800));
    expect(await ledgerMismatches()).toHaveLength(0);
  });

  it("payment on a frozen card is rejected; unfreeze restores it", async () => {
    const { cust, card } = await issued();
    await updateOwnCard(cust.id, card.id, { action: "freeze" });
    expect(await codeOf(pay(cust, card.id, 100))).toBe("CARD_INACTIVE");
    await updateOwnCard(cust.id, card.id, { action: "unfreeze" });
    expect(await codeOf(pay(cust, card.id, 100))).toBe("OK");
  });

  it("payment over the card daily limit is rejected", async () => {
    const { cust, card } = await issued(100_000);
    await updateOwnCard(cust.id, card.id, { action: "limit", dailySpendLimit: tk(3_000) });
    expect(await codeOf(pay(cust, card.id, 2_000))).toBe("OK");
    expect(await codeOf(pay(cust, card.id, 1_500))).toBe("LIMIT_EXCEEDED");
  });

  it("wrong PIN, min balance and frozen account all block payments", async () => {
    const { cust, acc, card } = await issued(1_000);
    expect(await codeOf(pay(cust, card.id, 100, "0000"))).toBe("INVALID_PIN");
    expect(await codeOf(pay(cust, card.id, 600))).toBe("INSUFFICIENT_FUNDS");
    await db.account.update({ where: { id: acc.id }, data: { status: "FROZEN" } });
    expect(await codeOf(pay(cust, card.id, 10))).toBe("ACCOUNT_FROZEN");
  });

  it("customer can't freeze or pay with another customer's card", async () => {
    const { card } = await issued();
    const other = await makeUser();
    expect(await codeOf(updateOwnCard(other.id, card.id, { action: "freeze" }))).toBe("NOT_FOUND");
    expect(await codeOf(pay(other, card.id, 10))).toBe("NOT_FOUND");
  });

  it("idempotent payments; staff can't approve their own card; admin block is permanent", async () => {
    const { cust, staff, admin, card } = await issued();
    const k = key();
    const a = await payWithCard(cust, card.id, { merchant: "Daraz", amount: tk(500), pin: PIN, idempotencyKey: k });
    const b = await payWithCard(cust, card.id, { merchant: "Daraz", amount: tk(500), pin: PIN, idempotencyKey: k });
    expect(b.replayed).toBe(true);
    expect(b.transaction.id).toBe(a.transaction.id);

    const staffAcc = await makeAccount(staff.id, 1_000);
    const own = await requestCard(staff, { accountId: staffAcc.id, network: "MASTERCARD" });
    expect(await codeOf(reviewCard(staff, own.id, { action: "approve" }))).toBe("SELF_ACTION_NOT_ALLOWED");

    await setCardFrozenAsStaff(staff, card.id, true);
    await blockCard(admin, card.id, "Reported stolen");
    expect(await codeOf(updateOwnCard(cust.id, card.id, { action: "unfreeze" }))).toBe("INVALID_STATE");
    expect(await codeOf(pay(cust, card.id, 10))).toBe("CARD_INACTIVE");
  });
});
