import "server-only";
import type { Tx } from "@/server/db";
import { minutesAgo, daysAgo } from "@/lib/time";
import { FRAUD_RULES, type FraudStats } from "@/lib/fraud-rules";

export { evaluateFraud, FRAUD_RULES, type FraudStats } from "@/lib/fraud-rules";

/** Gather stats inside the transfer's DB transaction, before the new txn row is written. */
export async function collectFraudStats(
  tx: Tx,
  args: { accountId: string; amount: bigint; balanceBefore: bigint; now: Date },
): Promise<FraudStats> {
  const { accountId, amount, balanceBefore, now } = args;
  const outgoing = { senderAccountId: accountId, type: "TRANSFER" as const, status: "COMPLETED" as const };

  const [recent, agg, failedPins] = await Promise.all([
    tx.transaction.count({ where: { ...outgoing, createdAt: { gte: minutesAgo(FRAUD_RULES.burstWindowMin, now) } } }),
    tx.transaction.aggregate({
      where: { ...outgoing, createdAt: { gte: daysAgo(30, now) } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    tx.securityEvent.count({
      where: { accountId, type: "PIN_FAILED", createdAt: { gte: minutesAgo(FRAUD_RULES.failedPinWindowMin, now) } },
    }),
  ]);

  const n = agg._count._all;
  return {
    amount,
    balanceBefore,
    recentTransferCount: recent + 1,
    avgAmount30d: n > 0 && agg._sum.amount != null ? agg._sum.amount / BigInt(n) : null,
    sampleCount30d: n,
    failedPinsLastHour: failedPins,
  };
}
