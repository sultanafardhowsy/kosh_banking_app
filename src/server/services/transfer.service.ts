import "server-only";
import { consumeOtp, verifyOtp } from "./otp.service";
import { otpPayload, transferNeedsOtp } from "./otp-payload";
import type { Account, BankSettings, Transaction } from "@prisma/client";
import { db, type Tx } from "@/server/db";
import { AppError } from "@/server/errors";
import { computeTransferFee, effectiveLimits } from "@/lib/fees";
import { formatMoney } from "@/lib/money";
import { generateTxnReference } from "@/lib/reference";
import { startOfDhakaDay } from "@/lib/time";
import { maskAccountNumber } from "@/lib/format";
import type { TransferInput } from "@/lib/validators/money";
import { getSettings } from "./settings.service";
import { collectFraudStats, evaluateFraud } from "./fraud.service";
import { throwPinError, verifyPinInTx, type PinCheck } from "./pin.service";
import { isUniqueViolation, lockAccounts, MONEY_TX_OPTIONS } from "./locks";
import { notify, notifyAdmins } from "./notification.service";

type AccountWithOwner = Account & { user: { id: string; name: string; status: string } };

/** "Rafiul Karim" → "Rafiul K." — enough to confirm a recipient without exposing them. */
export function maskName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1]![0]}.` : first!;
}

export async function usedTodayFor(client: Tx | typeof db, accountId: string, now: Date) {
  const agg = await client.transaction.aggregate({
    where: {
      senderAccountId: accountId,
      type: { in: ["TRANSFER", "CARD_PAYMENT"] },
      status: "COMPLETED",
      createdAt: { gte: startOfDhakaDay(now) },
    },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? BigInt(0);
}

/** Status checks — run BEFORE the PIN so a frozen account doesn't burn PIN attempts. */
export function checkAccountStates(sender: AccountWithOwner, receiver: AccountWithOwner) {
  if (sender.id === receiver.id) throw new AppError("SAME_ACCOUNT", "You can't transfer to the same account");
  if (sender.status !== "ACTIVE") {
    throw new AppError("ACCOUNT_FROZEN", sender.status === "CLOSED" ? "This account is closed" : "This account is frozen");
  }
  if (receiver.status === "CLOSED") throw new AppError("RECIPIENT_NOT_FOUND", "No active account with that number");
  if (receiver.status !== "ACTIVE" || receiver.user.status !== "ACTIVE") {
    throw new AppError("ACCOUNT_FROZEN", "The recipient's account can't receive transfers right now");
  }
}

/**
 * Every business rule except ownership + PIN, shared by preview and execute.
 * Throws a typed AppError on the first violation.
 */
export function checkTransferRules(args: {
  sender: AccountWithOwner;
  receiver: AccountWithOwner;
  amount: bigint;
  settings: BankSettings;
  usedToday: bigint;
}) {
  const { sender, receiver, amount, settings, usedToday } = args;
  checkAccountStates(sender, receiver);

  const limits = effectiveLimits(sender, settings);
  if (amount > limits.maxSingle) {
    throw new AppError("LIMIT_EXCEEDED", `The most you can send in one transfer is ${formatMoney(limits.maxSingle)}`, {
      maxSingle: limits.maxSingle.toString(),
    });
  }
  const remainingDaily = limits.daily - usedToday;
  if (amount > remainingDaily) {
    throw new AppError(
      "LIMIT_EXCEEDED",
      `This exceeds your daily limit. You can send ${formatMoney(remainingDaily > BigInt(0) ? remainingDaily : BigInt(0))} more today.`,
      { remainingDaily: remainingDaily.toString() },
    );
  }

  const fee = computeTransferFee(amount, settings);
  const total = amount + fee;
  const balanceAfter = sender.balance - total;
  if (balanceAfter < settings.minimumBalance) {
    throw new AppError(
      "INSUFFICIENT_FUNDS",
      `Insufficient balance. Amount + fee (${formatMoney(total)}) must leave at least ${formatMoney(settings.minimumBalance)} in the account.`,
      { available: (sender.balance - settings.minimumBalance).toString() },
    );
  }

  return { fee, total, balanceAfter, limits, remainingDailyAfter: remainingDaily - amount };
}

async function findReceiverId(accountNumber: string) {
  const r = await db.account.findUnique({ where: { accountNumber }, select: { id: true } });
  if (!r) throw new AppError("RECIPIENT_NOT_FOUND", "No active account with that number");
  return r.id;
}

/** Review step: fee, total and remaining limit, with no side effects. */
export async function previewTransfer(userId: string, input: Pick<TransferInput, "fromAccountId" | "toAccountNumber" | "amount">, now = new Date()) {
  const sender = await db.account.findFirst({
    where: { id: input.fromAccountId, userId },
    include: { user: { select: { id: true, name: true, status: true } } },
  });
  if (!sender) throw new AppError("NOT_FOUND", "Account not found");
  const receiverId = await findReceiverId(input.toAccountNumber);
  const receiver = await db.account.findUniqueOrThrow({
    where: { id: receiverId },
    include: { user: { select: { id: true, name: true, status: true } } },
  });
  const [settings, usedToday] = await Promise.all([getSettings(), usedTodayFor(db, sender.id, now)]);
  const r = checkTransferRules({ sender, receiver, amount: input.amount, settings, usedToday });

  return {
    amount: input.amount,
    fee: r.fee,
    total: r.total,
    balanceAfter: r.balanceAfter,
    remainingDailyLimit: r.remainingDailyAfter,
    otpRequired: transferNeedsOtp(input.amount, settings.otpThreshold),
    recipient: {
      name: maskName(receiver.user.name),
      accountNumber: maskAccountNumber(receiver.accountNumber),
      type: receiver.type,
    },
  };
}

type Outcome =
  | { kind: "done"; txn: Transaction; senderBalanceAfter: bigint; senderUserId: string; receiverUserId: string; receiverName: string; senderName: string; receiverNumber: string; senderNumber: string }
  | { kind: "replay"; txn: Transaction }
  | { kind: "pin"; check: Extract<PinCheck, { ok: false }> };

/**
 * POST /api/transfers — the whole transfer is ONE database transaction:
 * lock both rows → idempotency → ownership/status → PIN → limits → balance →
 * debit + credit → Transaction + 2 LedgerEntry rows → fraud flags → commit.
 * Any thrown error rolls everything back; money never moves on one side only.
 */
export async function executeTransfer(userId: string, input: TransferInput, now = new Date()) {
  // Fast path: a retried request with the same key returns the original result.
  const prior = await db.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (prior) return replay(prior, userId);

  const receiverId = await findReceiverId(input.toAccountNumber);

  // Two-factor for large transfers: check the emailed code first (a wrong code is counted
  // even though nothing else happens); it's used up inside the transaction below.
  const otpId = transferNeedsOtp(input.amount, (await getSettings()).otpThreshold)
    ? await verifyOtp(userId, "TRANSFER", otpPayload.transfer(input), input.otp)
    : null;

  let outcome: Outcome;
  try {
    outcome = await db.$transaction(async (tx): Promise<Outcome> => {
      await lockAccounts(tx, [input.fromAccountId, receiverId]);

      // Re-check after acquiring the lock: a concurrent duplicate may have just committed.
      const existing = await tx.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return { kind: "replay", txn: existing };

      const include = { user: { select: { id: true, name: true, status: true } } } as const;
      const sender = await tx.account.findFirst({ where: { id: input.fromAccountId, userId }, include });
      if (!sender) throw new AppError("NOT_FOUND", "Account not found");
      const receiver = await tx.account.findUniqueOrThrow({ where: { id: receiverId }, include });
      checkAccountStates(sender, receiver);

      const pin = await verifyPinInTx(tx, sender, input.pin, userId, now);
      if (!pin.ok) return { kind: "pin", check: pin }; // commit the failed attempt, then throw outside
      if (otpId) await consumeOtp(otpId, tx); // rolled back with the transfer if anything below fails

      const [settings, usedToday] = await Promise.all([getSettings(tx), usedTodayFor(tx, sender.id, now)]);
      const { fee, total, balanceAfter } = checkTransferRules({ sender, receiver, amount: input.amount, settings, usedToday });

      const fraud = evaluateFraud(
        await collectFraudStats(tx, { accountId: sender.id, amount: input.amount, balanceBefore: sender.balance, now }),
      );
      const receiverAfter = receiver.balance + input.amount;

      await tx.account.update({ where: { id: sender.id }, data: { balance: balanceAfter } });
      await tx.account.update({ where: { id: receiver.id }, data: { balance: receiverAfter } });

      const txn = await tx.transaction.create({
        data: {
          reference: generateTxnReference("TXN", now),
          type: "TRANSFER",
          amount: input.amount,
          fee,
          status: "COMPLETED",
          senderAccountId: sender.id,
          receiverAccountId: receiver.id,
          description: input.description || null,
          idempotencyKey: input.idempotencyKey,
          isFlagged: fraud.length > 0,
          flagReason: fraud.length ? fraud.join("; ") : null,
          flaggedAt: fraud.length ? now : null,
          initiatedById: userId,
          createdAt: now,
          ledgerEntries: {
            create: [
              { accountId: sender.id, direction: "DEBIT", amount: total, balanceAfter, createdAt: now },
              { accountId: receiver.id, direction: "CREDIT", amount: input.amount, balanceAfter: receiverAfter, createdAt: now },
            ],
          },
        },
      });

      return {
        kind: "done",
        txn,
        senderBalanceAfter: balanceAfter,
        senderUserId: sender.userId,
        receiverUserId: receiver.userId,
        receiverName: receiver.user.name,
        senderName: sender.user.name,
        receiverNumber: receiver.accountNumber,
        senderNumber: sender.accountNumber,
      };
    }, MONEY_TX_OPTIONS);
  } catch (err) {
    // Two identical requests raced past both checks: the unique index decided — return the winner.
    if (isUniqueViolation(err, "idempotencyKey")) {
      const winner = await db.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (winner) return replay(winner, userId);
    }
    throw err;
  }

  if (outcome.kind === "pin") return throwPinError(outcome.check, userId);
  if (outcome.kind === "replay") return replay(outcome.txn, userId);

  const { txn } = outcome;
  const link = `/transactions/${txn.id}`;
  await notify([
    {
      userId: outcome.senderUserId,
      type: "TRANSFER_SENT",
      title: `Sent ${formatMoney(txn.amount)}`,
      body: `To ${maskName(outcome.receiverName)} (${maskAccountNumber(outcome.receiverNumber)}). Fee ${formatMoney(txn.fee)}. Ref ${txn.reference}.`,
      link,
    },
    {
      userId: outcome.receiverUserId,
      type: "TRANSFER_RECEIVED",
      title: `Received ${formatMoney(txn.amount)}`,
      body: `From ${maskName(outcome.senderName)} (${maskAccountNumber(outcome.senderNumber)}). Ref ${txn.reference}.`,
      link,
    },
  ]);
  if (txn.isFlagged) {
    await notifyAdmins({
      type: "SECURITY",
      title: "Transaction flagged for review",
      body: `${txn.reference} · ${formatMoney(txn.amount)} — ${txn.flagReason}`,
      link: "/admin/flagged",
    });
  }

  return {
    replayed: false,
    transaction: txn,
    balanceAfter: outcome.senderBalanceAfter,
    recipient: { name: maskName(outcome.receiverName), accountNumber: maskAccountNumber(outcome.receiverNumber) },
  };
}

async function replay(txn: Transaction, userId: string) {
  if (txn.initiatedById !== userId) throw new AppError("DUPLICATE_REQUEST", "This request was already processed");
  const sender = txn.senderAccountId
    ? await db.account.findUnique({ where: { id: txn.senderAccountId }, select: { balance: true } })
    : null;
  const receiver = txn.receiverAccountId
    ? await db.account.findUnique({
        where: { id: txn.receiverAccountId },
        select: { accountNumber: true, user: { select: { name: true } } },
      })
    : null;
  return {
    replayed: true,
    transaction: txn,
    balanceAfter: sender?.balance ?? null,
    recipient: receiver ? { name: maskName(receiver.user.name), accountNumber: maskAccountNumber(receiver.accountNumber) } : null,
  };
}
