import "server-only";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/guards";
import { writeAudit } from "@/server/audit";
import { formatMoney } from "@/lib/money";
import { generateTxnReference } from "@/lib/reference";
import { lockAccounts, lockTransaction, MONEY_TX_OPTIONS } from "./locks";
import { notify } from "./notification.service";

const REVERSIBLE = ["TRANSFER", "DEPOSIT", "WITHDRAWAL"] as const;

/**
 * Admin reversal — history is never edited or deleted.
 * Creates a compensating REVERSAL transaction that moves the money back
 * (a transfer's fee is refunded too), marks the original REVERSED and links them.
 * Works on frozen accounts (that's often why you reverse), but never drives a balance negative.
 */
export async function reverseTransaction(admin: SessionUser, transactionId: string, reason: string) {
  const result = await db.$transaction(async (tx) => {
    await lockTransaction(tx, transactionId);
    const original = await tx.transaction.findUnique({ where: { id: transactionId }, include: { reversal: true } });
    if (!original) throw new AppError("NOT_FOUND", "Transaction not found");
    if (original.status !== "COMPLETED" || original.reversal) {
      throw new AppError("INVALID_STATE", "Only completed, not-yet-reversed transactions can be reversed");
    }
    if (!(REVERSIBLE as readonly string[]).includes(original.type)) {
      throw new AppError("INVALID_STATE", "Loan transactions are corrected through the loan, not reversed");
    }

    await lockAccounts(tx, [original.senderAccountId, original.receiverAccountId].filter(Boolean) as string[]);

    // Original receiver gives back `amount`; original sender gets back `amount + fee`.
    const entries: { accountId: string; direction: "DEBIT" | "CREDIT"; amount: bigint; balanceAfter: bigint }[] = [];
    const affectedUsers: string[] = [];

    if (original.receiverAccountId) {
      const acc = await tx.account.findUniqueOrThrow({ where: { id: original.receiverAccountId } });
      const after = acc.balance - original.amount;
      if (after < BigInt(0)) {
        throw new AppError("INSUFFICIENT_FUNDS", "The receiving account no longer holds enough to reverse this transaction");
      }
      await tx.account.update({ where: { id: acc.id }, data: { balance: after } });
      entries.push({ accountId: acc.id, direction: "DEBIT", amount: original.amount, balanceAfter: after });
      affectedUsers.push(acc.userId);
    }
    if (original.senderAccountId) {
      const acc = await tx.account.findUniqueOrThrow({ where: { id: original.senderAccountId } });
      const refund = original.amount + original.fee;
      const after = acc.balance + refund;
      await tx.account.update({ where: { id: acc.id }, data: { balance: after } });
      entries.push({ accountId: acc.id, direction: "CREDIT", amount: refund, balanceAfter: after });
      affectedUsers.push(acc.userId);
    }

    const reversal = await tx.transaction.create({
      data: {
        reference: generateTxnReference("REV"),
        type: "REVERSAL",
        amount: original.amount,
        fee: original.fee, // refunded fee, recorded for clarity
        status: "COMPLETED",
        // money flows the opposite way
        senderAccountId: original.receiverAccountId,
        receiverAccountId: original.senderAccountId,
        description: `Reversal of ${original.reference}: ${reason}`,
        reversedTxnId: original.id,
        initiatedById: admin.id,
        ledgerEntries: { create: entries },
      },
    });
    await tx.transaction.update({
      where: { id: original.id },
      data: { status: "REVERSED", flagResolvedAt: original.isFlagged ? new Date() : undefined },
    });
    await writeAudit(
      {
        actorId: admin.id,
        action: "TRANSACTION_REVERSED",
        entity: "Transaction",
        entityId: original.id,
        metadata: { reason, reversalId: reversal.id, amount: original.amount.toString(), fee: original.fee.toString() },
      },
      tx,
    );
    return { original: { ...original, status: "REVERSED" as const }, reversal, affectedUsers };
  }, MONEY_TX_OPTIONS);

  await notify(
    [...new Set(result.affectedUsers)].map((userId) => ({
      userId,
      type: "ACCOUNT_UPDATE" as const,
      title: "Transaction reversed",
      body: `${result.original.reference} (${formatMoney(result.original.amount)}) was reversed by the bank. Ref ${result.reversal.reference}.`,
      link: `/transactions/${result.reversal.id}`,
    })),
  );
  return { original: result.original, reversal: result.reversal };
}

/** Staff/Admin manual flag (fraud rule #5). Flagging doesn't move money. */
export async function flagTransaction(actor: SessionUser, transactionId: string, reason: string) {
  return db.$transaction(async (tx) => {
    const txn = await tx.transaction.findUnique({ where: { id: transactionId } });
    if (!txn) throw new AppError("NOT_FOUND", "Transaction not found");
    if (txn.isFlagged && !txn.flagResolvedAt) throw new AppError("INVALID_STATE", "This transaction is already flagged");

    const updated = await tx.transaction.update({
      where: { id: txn.id },
      data: {
        isFlagged: true,
        flagReason: `Manual flag by ${actor.role.toLowerCase()}: ${reason}`,
        flaggedById: actor.id,
        flaggedAt: new Date(),
        flagResolvedAt: null,
      },
    });
    await writeAudit({ actorId: actor.id, action: "TRANSACTION_FLAGGED", entity: "Transaction", entityId: txn.id, metadata: { reason } }, tx);
    return updated;
  });
}
