import { minBig, percentOf } from "./money";

export type FeeSettings = {
  transferFeeFlat: bigint;
  transferFeePercentBps: number;
  transferFeeMax: bigint | null;
};

/**
 * Transfer fee = flat + percentage (bps), capped at transferFeeMax.
 * Always computed on the server — the client never sends a fee.
 */
export function computeTransferFee(amount: bigint, s: FeeSettings): bigint {
  const raw = s.transferFeeFlat + percentOf(amount, s.transferFeePercentBps);
  return s.transferFeeMax != null ? minBig(raw, s.transferFeeMax) : raw;
}

export type LimitSettings = {
  dailyTransferLimit: bigint;
  maxSingleTransaction: bigint;
};

/** Account-level overrides win over bank-wide settings. */
export function effectiveLimits(
  account: { dailyTransferLimit: bigint | null; maxSingleTxn: bigint | null },
  s: LimitSettings,
) {
  return {
    daily: account.dailyTransferLimit ?? s.dailyTransferLimit,
    maxSingle: account.maxSingleTxn ?? s.maxSingleTransaction,
  };
}
