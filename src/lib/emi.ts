/**
 * EMI maths in exact integer arithmetic (BigInt fixed-point, 18 decimals).
 *   EMI = P × r × (1+r)^n / ((1+r)^n − 1),  r = annual rate / 12
 * All money in paisa; results rounded half-up to the paisa.
 */
const SCALE = BigInt(10) ** BigInt(18);
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

/** monthly rate as fixed-point (SCALE = 1.0) */
function monthlyRate(annualBps: number) {
  return (BigInt(annualBps) * SCALE) / BigInt(10000 * 12);
}

function divRound(n: bigint, d: bigint) {
  return (n + d / TWO) / d;
}

export function calculateEmi(principal: bigint, annualBps: number, months: number): bigint {
  if (months <= 0) throw new Error("months must be > 0");
  if (principal <= ZERO) throw new Error("principal must be > 0");
  if (annualBps === 0) return (principal + BigInt(months) - ONE) / BigInt(months); // ceil

  const r = monthlyRate(annualBps);
  let pow = SCALE; // (1+r)^n
  for (let i = 0; i < months; i++) pow = (pow * (SCALE + r)) / SCALE;

  return divRound(principal * r * pow, (pow - SCALE) * SCALE);
}

export type ScheduleRow = {
  installmentNo: number;
  dueDate: Date;
  amountDue: bigint;
  principalPart: bigint;
  interestPart: bigint;
};

/** Monthly due date: same day-of-month as the start, clamped to month end. */
function addMonths(d: Date, m: number) {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + m);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

/**
 * Reducing-balance amortisation. The last row absorbs rounding so the
 * principal parts always sum exactly to the principal.
 */
export function buildSchedule(principal: bigint, annualBps: number, months: number, start: Date) {
  const emi = calculateEmi(principal, annualBps, months);
  const r = annualBps === 0 ? ZERO : monthlyRate(annualBps);
  const rows: ScheduleRow[] = [];
  let remaining = principal;

  for (let i = 1; i <= months; i++) {
    const interest = annualBps === 0 ? ZERO : divRound(remaining * r, SCALE);
    let principalPart = emi - interest;
    if (i === months || principalPart > remaining) principalPart = remaining;
    remaining -= principalPart;
    rows.push({
      installmentNo: i,
      dueDate: addMonths(start, i),
      amountDue: principalPart + interest,
      principalPart,
      interestPart: interest,
    });
  }

  const totalPayable = rows.reduce((s, x) => s + x.amountDue, ZERO);
  return { emi, totalPayable, rows };
}
