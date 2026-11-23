import { describe, expect, it } from "vitest";
import { formatMoney, percentOf, takaToPaisa } from "@/lib/money";
import { generateAccountNumber, isValidAccountNumber } from "@/lib/reference";

describe("money helpers", () => {
  it("parses taka strings to paisa without float error", () => {
    expect(takaToPaisa("0.1")).toBe(BigInt(10));
    expect(takaToPaisa("1,250.50")).toBe(BigInt(125050));
    expect(takaToPaisa("19.99")).toBe(BigInt(1999));
  });

  it("rejects more than 2 decimals and junk", () => {
    expect(() => takaToPaisa("1.001")).toThrow();
    expect(() => takaToPaisa("-5")).toThrow();
    expect(() => takaToPaisa("abc")).toThrow();
  });

  it("formats with South-Asian grouping", () => {
    expect(formatMoney(BigInt(12345678900))).toBe("৳12,34,56,789.00");
    expect(formatMoney(BigInt(-50))).toBe("−৳0.50");
    expect(formatMoney(BigInt(100), { sign: true })).toBe("+৳1.00");
  });

  it("computes basis-point fees with half-up rounding", () => {
    expect(percentOf(BigInt(100000), 25)).toBe(BigInt(250)); // 0.25% of ৳1,000 = ৳2.50
    expect(percentOf(BigInt(199), 50)).toBe(BigInt(1)); // 0.995 → 1
  });
});

describe("account numbers", () => {
  it("generates valid 12-digit Luhn numbers", () => {
    for (let i = 0; i < 50; i++) {
      const n = generateAccountNumber("SAVINGS");
      expect(n).toMatch(/^101\d{9}$/);
      expect(isValidAccountNumber(n)).toBe(true);
    }
  });
});
