/**
 * Money helpers. All amounts are integers in paisa (1 ৳ = 100 paisa).
 * On the server they are `bigint`; over the wire they arrive as strings
 * (see `serialize` in server/http.ts). Never use floats for money math.
 */

export type MoneyInput = bigint | string | number;

export const PAISA_PER_TAKA = BigInt(100);

export function toBigInt(v: MoneyInput): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") {
    if (!Number.isInteger(v)) throw new Error("Money in paisa must be an integer");
    return BigInt(v);
  }
  return BigInt(v);
}

/**
 * "1,250.50" or "1250.5" (taka, as typed by a user) → 125050n paisa.
 * Rejects more than 2 decimal places. Parses as a string — no float rounding.
 */
export function takaToPaisa(input: string | number): bigint {
  const s = String(input).replace(/[,\s৳]/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error("Invalid amount");
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * PAISA_PER_TAKA + BigInt(frac.padEnd(2, "0"));
}

/** 125050n → "1,250.50" using South-Asian grouping (1,23,45,678.00). */
export function formatAmount(paisa: MoneyInput, opts: { decimals?: boolean } = {}): string {
  const v = toBigInt(paisa);
  const negative = v < BigInt(0);
  const abs = negative ? -v : v;
  const whole = abs / PAISA_PER_TAKA;
  const frac = (abs % PAISA_PER_TAKA).toString().padStart(2, "0");
  const grouped = groupIndian(whole.toString());
  const body = opts.decimals === false ? grouped : `${grouped}.${frac}`;
  return negative ? `-${body}` : body;
}

/** 125050n → "৳1,250.50" */
export function formatMoney(paisa: MoneyInput, opts: { decimals?: boolean; sign?: boolean } = {}) {
  const v = toBigInt(paisa);
  const sign = opts.sign ? (v > BigInt(0) ? "+" : v < BigInt(0) ? "−" : "") : v < BigInt(0) ? "−" : "";
  const abs = v < BigInt(0) ? -v : v;
  return `${sign}৳${formatAmount(abs, opts)}`;
}

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/** basis points: 1250 → "12.50%" */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * percentage of an amount in basis points, rounded half-up to the nearest paisa.
 * percentOf(100000n, 50) → 500n  (0.5% of ৳1,000 = ৳5)
 */
export function percentOf(amount: bigint, bps: number): bigint {
  const n = amount * BigInt(bps);
  const d = BigInt(10000);
  return (n + d / BigInt(2)) / d;
}

export const minBig = (a: bigint, b: bigint) => (a < b ? a : b);
export const maxBig = (a: bigint, b: bigint) => (a > b ? a : b);
