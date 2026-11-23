import "server-only";
import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import type { OtpPurpose } from "@prisma/client";
import { db, type Tx } from "@/server/db";
import { AppError } from "@/server/errors";
import { emailConfig, sendEmail } from "@/server/email/email.service";
import { renderEmail } from "@/server/email/templates";
import type { SessionUser } from "@/server/auth/guards";

/**
 * Two-factor for sensitive operations: a 6-digit code emailed to the user.
 *
 * - Only an HMAC of the code is stored, and the code never appears in the email log.
 * - Each code is bound to ONE exact operation (payloadHash): a code issued for
 *   "৳50,000 to 1234" can't approve "৳90,000 to 9999".
 * - 5 minutes to use it, 5 wrong tries, single use, at most 5 codes per 15 minutes.
 * - Wrong tries are committed even when the operation itself is rolled back.
 */
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30_000;
const OTP_WINDOW_MS = 15 * 60_000;
const OTP_MAX_PER_WINDOW = 5;

export type OtpProof = { challengeId: string; code: string };

/** Stable fingerprint of the operation the code approves. */
export function payloadHash(purpose: OtpPurpose, payload: string) {
  return createHash("sha256").update(`${purpose}\n${payload}`).digest("hex");
}

function secret() {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new AppError("INTERNAL_ERROR", "BETTER_AUTH_SECRET is not set");
  return s;
}
function hashCode(challengeId: string, code: string) {
  return createHmac("sha256", secret())
    .update(`${challengeId}:${code}`)
    .digest("hex");
}

export function maskEmail(email: string) {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 2)}${"•".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

/**
 * Emails a fresh code. In log-only mode (no SMTP/Resend configured) nothing can reach an
 * inbox, so the code is returned as `demoCode` for the UI to show — documented in the README.
 */
export async function requestOtp(
  user: SessionUser,
  purpose: OtpPurpose,
  payload: string,
  summary: string,
) {
  const now = Date.now();
  const recent = await db.otpChallenge.findMany({
    where: {
      userId: user.id,
      createdAt: { gte: new Date(now - OTP_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (
    recent[0] &&
    now - recent[0].createdAt.getTime() < OTP_RESEND_COOLDOWN_MS
  ) {
    const wait = Math.ceil(
      (OTP_RESEND_COOLDOWN_MS - (now - recent[0].createdAt.getTime())) / 1000,
    );
    throw new AppError(
      "RATE_LIMITED",
      `Wait ${wait} s before asking for another code`,
      { retryAfter: wait },
    );
  }
  if (recent.length >= OTP_MAX_PER_WINDOW)
    throw new AppError(
      "RATE_LIMITED",
      "Too many codes requested. Try again in 15 minutes.",
    );

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(now + OTP_TTL_MS);
  const challenge = await db.otpChallenge.create({
    data: {
      userId: user.id,
      purpose,
      payloadHash: payloadHash(purpose, payload),
      codeHash: "pending",
      expiresAt,
    },
  });
  await db.otpChallenge.update({
    where: { id: challenge.id },
    data: { codeHash: hashCode(challenge.id, code) },
  });

  const mail = (c: string) =>
    renderEmail({
      name: user.name,
      title: `Your security code: ${c}`,
      body: `Use it to confirm: ${summary}. It expires in 5 minutes and works once. If you didn't start this, don't share the code and change your password.`,
    });
  const real = mail(code);
  const redacted = mail("••••••"); // the stored log never contains a usable code
  await sendEmail({
    userId: user.id,
    to: user.email,
    subject: "Your Kosh security code",
    html: real.html,
    text: real.text,
    logHtml: redacted.html,
    notificationType: "SECURITY",
  });

  return {
    challengeId: challenge.id,
    expiresAt,
    sentTo: maskEmail(emailConfig().redirectTo ?? user.email),
    demoCode: emailConfig().provider === "log" ? code : undefined,
  };
}

/**
 * Checks a code without using it up. A wrong code costs one attempt (committed now,
 * outside any caller transaction). Throws OTP_REQUIRED / OTP_INVALID / OTP_EXPIRED / OTP_LOCKED.
 */
export async function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  payload: string,
  proof: OtpProof | undefined,
) {
  if (!proof)
    throw new AppError("OTP_REQUIRED", "Enter the code we emailed you", {
      purpose,
    });
  const c = await db.otpChallenge.findFirst({
    where: { id: proof.challengeId, userId },
  });
  if (
    !c ||
    c.purpose !== purpose ||
    c.payloadHash !== payloadHash(purpose, payload)
  ) {
    throw new AppError(
      "OTP_INVALID",
      "This code is for a different request. Ask for a new one.",
    );
  }
  if (c.consumedAt)
    throw new AppError(
      "OTP_INVALID",
      "This code was already used. Ask for a new one.",
    );
  if (c.attempts >= OTP_MAX_ATTEMPTS)
    throw new AppError(
      "OTP_LOCKED",
      "Too many wrong codes. Ask for a new one.",
    );
  if (c.expiresAt.getTime() < Date.now())
    throw new AppError(
      "OTP_EXPIRED",
      "This code has expired. Ask for a new one.",
    );

  const expected = Buffer.from(c.codeHash, "hex");
  const given = Buffer.from(hashCode(c.id, proof.code.trim()), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    const { attempts } = await db.otpChallenge.update({
      where: { id: c.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    const left = OTP_MAX_ATTEMPTS - attempts;
    if (left <= 0)
      throw new AppError(
        "OTP_LOCKED",
        "Too many wrong codes. Ask for a new one.",
      );
    throw new AppError(
      "OTP_INVALID",
      `Wrong code. ${left} ${left === 1 ? "try" : "tries"} left.`,
      { attemptsLeft: left },
    );
  }
  return c.id;
}

/**
 * Uses the code up — atomically, so two concurrent requests can't share it.
 * Pass the money transaction's `tx` so a rolled-back transfer leaves the code usable.
 */
export async function consumeOtp(
  challengeId: string,
  client: Tx | typeof db = db,
) {
  const { count } = await client.otpChallenge.updateMany({
    where: { id: challengeId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (count !== 1)
    throw new AppError(
      "OTP_INVALID",
      "This code was already used. Ask for a new one.",
    );
}

/** verify → run the operation → consume. For non-money admin/PIN operations. */
export async function withOtp<T>(
  user: SessionUser,
  purpose: OtpPurpose,
  payload: string,
  proof: OtpProof | undefined,
  run: () => Promise<T>,
) {
  const id = await verifyOtp(user.id, purpose, payload, proof);
  const result = await run();
  await consumeOtp(id).catch(() => undefined); // a concurrent duplicate already used it; the operation itself is idempotent
  return result;
}
