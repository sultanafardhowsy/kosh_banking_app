import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type { NotificationType } from "@prisma/client";
import { db } from "@/server/db";

/**
 * Email delivery — provider chosen by environment variables:
 *   1. SMTP_HOST set       → Nodemailer over SMTP (Gmail app password, Mailtrap, Brevo, …)
 *   2. RESEND_API_KEY set  → Resend HTTP API
 *   3. neither             → kept in the in-app email log only (status LOGGED) — the demo still shows it
 * EMAIL_DEMO_RECIPIENT redirects every email to one real inbox, because the seeded
 * demo users have fake @kosh.demo addresses.
 * Never throws: an email problem must not break the banking action that triggered it.
 */
export type OutgoingEmail = {
  userId?: string | null;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** What the email log stores instead of `html` (e.g. with a security code blanked out). */
  logHtml?: string;
  notificationType?: NotificationType;
};

export type EmailProvider = "smtp" | "resend" | "log";

export function emailConfig() {
  const smtpUser = process.env.SMTP_USER || null;
  return {
    provider: (process.env.SMTP_HOST ? "smtp" : process.env.RESEND_API_KEY ? "resend" : "log") as EmailProvider,
    smtp: {
      host: process.env.SMTP_HOST || "",
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : Number(process.env.SMTP_PORT || 587) === 465,
      user: smtpUser,
      pass: process.env.SMTP_PASS || null,
    },
    resendKey: process.env.RESEND_API_KEY || null,
    from: process.env.EMAIL_FROM || (smtpUser ? `Kosh <${smtpUser}>` : "Kosh <onboarding@resend.dev>"),
    redirectTo: process.env.EMAIL_DEMO_RECIPIENT || null,
  };
}

// One pooled SMTP connection per server instance
const globalForMail = globalThis as unknown as { koshMailer?: Transporter; koshMailerKey?: string };
function smtpTransport(cfg: ReturnType<typeof emailConfig>["smtp"]) {
  const key = `${cfg.host}:${cfg.port}:${cfg.user}`;
  if (!globalForMail.koshMailer || globalForMail.koshMailerKey !== key) {
    globalForMail.koshMailer = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    globalForMail.koshMailerKey = key;
  }
  return globalForMail.koshMailer;
}

async function deliver(cfg: ReturnType<typeof emailConfig>, to: string, subject: string, mail: OutgoingEmail) {
  if (cfg.provider === "smtp") {
    const info = await smtpTransport(cfg.smtp).sendMail({ from: cfg.from, to, subject, html: mail.html, text: mail.text });
    if (info.rejected?.length) throw new Error(`Rejected by SMTP server: ${info.rejected.join(", ")}`);
    return info.messageId ?? null;
  }
  if (cfg.provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: cfg.from, to: [to], subject, html: mail.html, text: mail.text }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok) throw new Error(`${res.status} ${body.name ?? ""} ${body.message ?? ""}`.trim());
    return body.id ?? null;
  }
  return null;
}

export async function sendEmail(mail: OutgoingEmail) {
  const cfg = emailConfig();
  const toAddress = cfg.redirectTo ?? mail.to;
  const subject = cfg.redirectTo && cfg.redirectTo !== mail.to ? `${mail.subject} [for ${mail.to}]` : mail.subject;

  let status: "SENT" | "FAILED" | "LOGGED" = cfg.provider === "log" ? "LOGGED" : "SENT";
  let providerId: string | null = null;
  let error: string | null = null;
  if (cfg.provider !== "log") {
    try {
      providerId = await deliver(cfg, toAddress, subject, mail);
    } catch (e) {
      status = "FAILED";
      error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      console.error(`[email:${cfg.provider}] delivery failed:`, error);
    }
  }

  try {
    await db.emailLog.create({
      data: { userId: mail.userId ?? null, toAddress, originalTo: mail.to, subject, html: mail.logHtml ?? mail.html, notificationType: mail.notificationType, status, provider: cfg.provider, providerId, error },
    });
  } catch (e) {
    console.error("[email] could not write email log", e);
  }
  return { status, toAddress, provider: cfg.provider };
}
