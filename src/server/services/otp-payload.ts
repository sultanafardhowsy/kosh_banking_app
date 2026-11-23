// Pure helpers shared by the OTP service and the operations it protects (no imports → no cycles).

/**
 * One canonical fingerprint per operation, used both when the code is issued and when
 * the operation is submitted. Anything not in the fingerprint can't be changed without
 * a new code.
 */
export const otpPayload = {
  transfer: (i: {
    fromAccountId: string;
    toAccountNumber: string;
    amount: bigint;
  }) => `${i.fromAccountId}|${i.toAccountNumber}|${i.amount}`,
  pinChange: (accountId: string) => accountId,
  reversal: (transactionId: string) => transactionId,
  settings: (s: Record<string, unknown>) =>
    JSON.stringify(
      Object.keys(s)
        .sort()
        .map((k) => [k, s[k] == null ? null : String(s[k])]),
    ),
};

/** Two-factor applies to transfers at or above the admin-set threshold (off when unset). */
export function transferNeedsOtp(amount: bigint, otpThreshold: bigint | null) {
  return otpThreshold != null && amount >= otpThreshold;
}
