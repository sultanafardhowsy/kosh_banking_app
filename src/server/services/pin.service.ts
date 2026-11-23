import "server-only";
import bcrypt from "bcryptjs";
import type { Account } from "@prisma/client";
import { db, type Tx } from "@/server/db";
import { AppError } from "@/server/errors";
import { PIN_LOCK_MINUTES, PIN_MAX_ATTEMPTS } from "@/lib/constants";
import { notify } from "./notification.service";
import { lockAccounts, MONEY_TX_OPTIONS } from "./locks";

export type PinCheck =
  | { ok: true }
  | { ok: false; code: "INVALID_PIN" | "PIN_LOCKED"; attemptsLeft: number; lockedUntil: Date | null };

/**
 * Verify the PIN of an already-locked account row and persist the outcome.
 *
 * Important: this does NOT throw on a wrong PIN. The caller commits the
 * transaction (so the attempt counter + SecurityEvent are saved — a thrown
 * error would roll them back and make brute force free) and throws afterwards.
 */
export async function verifyPinInTx(tx: Tx, account: Account, pin: string, userId: string, now = new Date()): Promise<PinCheck> {
  if (!account.transactionPinHash) throw new AppError("PIN_NOT_SET", "Set a transaction PIN for this account first");

  if (account.pinLockedUntil && account.pinLockedUntil > now) {
    return { ok: false, code: "PIN_LOCKED", attemptsLeft: 0, lockedUntil: account.pinLockedUntil };
  }

  const valid = await bcrypt.compare(pin, account.transactionPinHash);
  if (valid) {
    if (account.pinAttempts > 0 || account.pinLockedUntil) {
      await tx.account.update({ where: { id: account.id }, data: { pinAttempts: 0, pinLockedUntil: null } });
    }
    return { ok: true };
  }

  const attempts = account.pinAttempts + 1;
  const lock = attempts >= PIN_MAX_ATTEMPTS;
  const lockedUntil = lock ? new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000) : null;

  await tx.account.update({
    where: { id: account.id },
    data: lock ? { pinAttempts: 0, pinLockedUntil: lockedUntil } : { pinAttempts: attempts },
  });
  await tx.securityEvent.create({ data: { userId, accountId: account.id, type: "PIN_FAILED", createdAt: now } });
  if (lock) {
    await tx.securityEvent.create({ data: { userId, accountId: account.id, type: "PIN_LOCKED", createdAt: now } });
  }

  return lock
    ? { ok: false, code: "PIN_LOCKED", attemptsLeft: 0, lockedUntil }
    : { ok: false, code: "INVALID_PIN", attemptsLeft: PIN_MAX_ATTEMPTS - attempts, lockedUntil: null };
}

/** Turn a failed PinCheck into the typed error (called after commit). */
export async function throwPinError(check: Extract<PinCheck, { ok: false }>, userId: string): Promise<never> {
  if (check.code === "PIN_LOCKED") {
    if (check.lockedUntil) {
      await notify([
        {
          userId,
          type: "SECURITY",
          title: "Transaction PIN locked",
          body: `Too many wrong PIN attempts. Transfers from this account are paused until ${check.lockedUntil.toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" })}.`,
          link: "/profile",
        },
      ]);
    }
    throw new AppError("PIN_LOCKED", `PIN locked after too many attempts. Try again in ${PIN_LOCK_MINUTES} minutes.`, {
      lockedUntil: check.lockedUntil,
    });
  }
  throw new AppError(
    "INVALID_PIN",
    `Incorrect PIN. ${check.attemptsLeft} attempt${check.attemptsLeft === 1 ? "" : "s"} left before it locks.`,
    { attemptsLeft: check.attemptsLeft },
  );
}

/** Set (first time) or change the PIN. Changing requires the current PIN. */
export async function setPin(args: { userId: string; accountId: string; currentPin?: string; newPin: string }) {
  const newHash = await bcrypt.hash(args.newPin, 10);

  const result = await db.$transaction(async (tx) => {
    await lockAccounts(tx, [args.accountId]);
    const account = await tx.account.findFirst({ where: { id: args.accountId, userId: args.userId } });
    if (!account) throw new AppError("NOT_FOUND", "Account not found");
    if (account.status === "CLOSED") throw new AppError("INVALID_STATE", "This account is closed");

    if (account.transactionPinHash) {
      if (!args.currentPin) throw new AppError("VALIDATION_ERROR", "Enter your current PIN");
      const check = await verifyPinInTx(tx, account, args.currentPin, args.userId);
      if (!check.ok) return check;
    }

    await tx.account.update({
      where: { id: account.id },
      data: { transactionPinHash: newHash, pinAttempts: 0, pinLockedUntil: null },
    });
    await tx.securityEvent.create({ data: { userId: args.userId, accountId: account.id, type: "PIN_CHANGED" } });
    return { ok: true as const, changed: Boolean(account.transactionPinHash) };
  }, MONEY_TX_OPTIONS);

  if (!result.ok) await throwPinError(result, args.userId);

  await notify([
    {
      userId: args.userId,
      type: "SECURITY",
      title: "changed" in result && result.changed ? "Transaction PIN changed" : "Transaction PIN set",
      body: "If this wasn't you, contact the bank immediately.",
      link: "/profile",
    },
  ]);
  return { ok: true };
}
