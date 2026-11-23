import { describe, expect, it } from "vitest";
import { buildSchedule, calculateEmi } from "@/lib/emi";
import { computeTransferFee, effectiveLimits } from "@/lib/fees";
import { evaluateFraud } from "@/lib/fraud-rules";
import { startOfDhakaDay } from "@/lib/time";
import { paisaSchema, transferSchema } from "@/lib/validators/money";
import { DEFAULT_SETTINGS } from "@/lib/constants";

const b = (n: number) => BigInt(n);

describe("EMI", () => {
  it("matches the standard formula (৳1,00,000 · 12% · 12 months = ৳8,884.88)", () => {
    expect(calculateEmi(b(10_000_000), 1200, 12)).toBe(b(888_488));
  });
  it("schedule principal parts sum exactly to the principal", () => {
    const s = buildSchedule(b(30_000_000), 1100, 24, new Date("2026-01-31T00:00:00Z"));
    expect(s.rows).toHaveLength(24);
    expect(s.rows.reduce((t, r) => t + r.principalPart, b(0))).toBe(b(30_000_000));
    expect(s.rows[0]!.dueDate.toISOString().slice(0, 10)).toBe("2026-02-28"); // month-end clamp
  });
  it("handles a zero interest rate", () => {
    expect(calculateEmi(b(1000), 0, 3)).toBe(b(334));
    expect(buildSchedule(b(1000), 0, 3, new Date()).totalPayable).toBe(b(1000));
  });
});

describe("fees & limits", () => {
  it("flat + percentage, capped", () => {
    expect(computeTransferFee(b(100_000), DEFAULT_SETTINGS)).toBe(b(750)); // ৳5 + 0.25% of ৳1,000
    expect(computeTransferFee(b(1_000_000_000), DEFAULT_SETTINGS)).toBe(DEFAULT_SETTINGS.transferFeeMax);
  });
  it("account overrides beat bank settings", () => {
    expect(effectiveLimits({ dailyTransferLimit: b(5), maxSingleTxn: null }, DEFAULT_SETTINGS)).toEqual({
      daily: b(5),
      maxSingle: DEFAULT_SETTINGS.maxSingleTransaction,
    });
  });
});

describe("fraud rules", () => {
  const base = { amount: b(100), balanceBefore: b(10_000), recentTransferCount: 1, avgAmount30d: b(100), sampleCount30d: 10, failedPinsLastHour: 0 };
  it("clean transfer has no reasons", () => expect(evaluateFraud(base)).toEqual([]));
  it("≥80% of balance", () => expect(evaluateFraud({ ...base, amount: b(8_000) })[0]).toMatch(/80%/));
  it(">5 in 10 minutes", () => expect(evaluateFraud({ ...base, recentTransferCount: 6 })[0]).toMatch(/More than 5/));
  it("≥5× the 30-day average (needs 3 samples)", () => {
    expect(evaluateFraud({ ...base, amount: b(500) })[0]).toMatch(/5×/);
    expect(evaluateFraud({ ...base, amount: b(500), sampleCount30d: 2 })).toEqual([]);
  });
  it("≥3 failed PINs in an hour", () => expect(evaluateFraud({ ...base, failedPinsLastHour: 3 })[0]).toMatch(/failed PIN/));
});

describe("validators", () => {
  it("amounts must be whole positive paisa — no floats", () => {
    expect(paisaSchema.parse("125050")).toBe(b(125050));
    expect(paisaSchema.safeParse("12.5").success).toBe(false);
    expect(paisaSchema.safeParse(12.5).success).toBe(false);
    expect(paisaSchema.safeParse("0").success).toBe(false);
    expect(paisaSchema.safeParse("-5").success).toBe(false);
  });
  it("account numbers accept spaces", () => {
    const r = transferSchema.safeParse({ fromAccountId: "x", toAccountNumber: "1012 3456 7890", amount: "100", pin: "1234", idempotencyKey: "abcdefgh" });
    expect(r.success && r.data.toAccountNumber).toBe("101234567890");
  });
});

describe("time", () => {
  it("daily limits reset at midnight Dhaka time", () => {
    // 2026-11-21 01:30 Dhaka == 2026-11-20 19:30 UTC → day starts 2026-11-20 18:00 UTC
    expect(startOfDhakaDay(new Date("2026-11-20T19:30:00Z")).toISOString()).toBe("2026-11-20T18:00:00.000Z");
    expect(startOfDhakaDay(new Date("2026-11-20T17:59:00Z")).toISOString()).toBe("2026-11-19T18:00:00.000Z");
  });
});

describe("unique-violation detection (idempotency + duplicate email rely on it)", async () => {
  const { Prisma } = await import("@prisma/client");
  const { isUniqueViolation } = await import("@/server/services/locks");
  const mk = (meta: Record<string, unknown>) => new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6", meta });
  it("reads the driver-adapter shape (our runtime)", () => {
    const e = mk({ modelName: "Transaction", driverAdapterError: { cause: { kind: "UniqueConstraintViolation", constraint: { fields: ["idempotencyKey"] } } } });
    expect(isUniqueViolation(e, "idempotencyKey")).toBe(true);
    expect(isUniqueViolation(e, "email")).toBe(false);
  });
  it("reads the classic-engine shape too", () => {
    expect(isUniqueViolation(mk({ target: ["email"] }), "email")).toBe(true);
  });
});
