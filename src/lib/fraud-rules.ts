/** Pure fraud rules — shared by the transfer service, the seed and the tests. */
/** Fraud thresholds (plan §3.5). */
export const FRAUD_RULES = {
  shareOfBalancePct: 80, // single txn ≥ 80% of balance before the txn
  burstCount: 5, // more than 5 transfers…
  burstWindowMin: 10, // …within 10 minutes
  averageMultiplier: 5, // amount ≥ 5× the 30-day average
  averageMinSamples: 3, // need some history before the average rule applies
  failedPinCount: 3, // ≥ 3 failed PINs…
  failedPinWindowMin: 60, // …within 1 hour
} as const;

export type FraudStats = {
  amount: bigint;
  balanceBefore: bigint;
  /** completed outgoing transfers in the burst window, INCLUDING this one */
  recentTransferCount: number;
  /** 30-day stats of previous outgoing transfers (excluding this one) */
  avgAmount30d: bigint | null;
  sampleCount30d: number;
  failedPinsLastHour: number;
};

/** Pure rule evaluation — unit-testable without a database. */
export function evaluateFraud(s: FraudStats): string[] {
  const reasons: string[] = [];
  if (s.balanceBefore > BigInt(0) && s.amount * BigInt(100) >= s.balanceBefore * BigInt(FRAUD_RULES.shareOfBalancePct)) {
    reasons.push(`Transfer is ≥${FRAUD_RULES.shareOfBalancePct}% of the account balance`);
  }
  if (s.recentTransferCount > FRAUD_RULES.burstCount) {
    reasons.push(`More than ${FRAUD_RULES.burstCount} transfers within ${FRAUD_RULES.burstWindowMin} minutes`);
  }
  if (
    s.avgAmount30d != null &&
    s.sampleCount30d >= FRAUD_RULES.averageMinSamples &&
    s.avgAmount30d > BigInt(0) &&
    s.amount >= s.avgAmount30d * BigInt(FRAUD_RULES.averageMultiplier)
  ) {
    reasons.push(`Amount is ≥${FRAUD_RULES.averageMultiplier}× the 30-day average`);
  }
  if (s.failedPinsLastHour >= FRAUD_RULES.failedPinCount) {
    reasons.push(`${s.failedPinsLastHour} failed PIN attempts in the last hour`);
  }
  return reasons;
}
