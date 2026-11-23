import "server-only";
import { after } from "next/server";
import type { NotificationType, Role } from "@prisma/client";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/email.service";
import { renderEmail } from "@/server/email/templates";

export type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  /** Override the default email policy for this one notification. */
  email?: boolean;
};

/**
 * Types that also go out by email (when the user hasn't turned email off).
 * Left out on purpose: routine card payments (CARD_UPDATE), loan progress
 * updates (LOAN_UPDATE) and staff queue alerts (REVIEW_QUEUE) — the bell covers them.
 */
const EMAIL_BY_DEFAULT = new Set<NotificationType>([
  "TRANSFER_SENT",
  "TRANSFER_RECEIVED",
  "REQUEST_APPROVED",
  "REQUEST_REJECTED",
  "LOAN_APPROVED",
  "LOAN_REJECTED",
  "INSTALLMENT_DUE",
  "ACCOUNT_UPDATE",
  "SECURITY",
  "SYSTEM",
]);

const CTA_LABEL: Partial<Record<NotificationType, string>> = {
  TRANSFER_SENT: "View receipt",
  TRANSFER_RECEIVED: "View transaction",
  REQUEST_APPROVED: "View transaction",
  REQUEST_REJECTED: "See your requests",
  LOAN_APPROVED: "See your loan",
  LOAN_REJECTED: "See your application",
  INSTALLMENT_DUE: "Pay EMI",
  SECURITY: "Review security",
};

export const wantsEmail = (n: NotificationInput) => n.email ?? EMAIL_BY_DEFAULT.has(n.type);

/**
 * Run work after the HTTP response is sent (Next.js `after`). Outside a request
 * (seed, tests) there is no request scope, so the work runs immediately instead.
 */
async function afterResponse(work: () => Promise<unknown>) {
  try {
    after(work);
  } catch {
    await work();
  }
}

async function deliverEmails(items: NotificationInput[]) {
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.userId))] } },
    select: { id: true, name: true, email: true, emailNotifications: true, status: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  for (const n of items) {
    const u = byId.get(n.userId);
    if (!u || !u.emailNotifications) continue;
    // Blocked/inactive users only get security emails
    if (u.status !== "ACTIVE" && n.type !== "SECURITY") continue;
    const { html, text } = renderEmail({ name: u.name, title: n.title, body: n.body, ctaPath: n.link ?? null, ctaLabel: CTA_LABEL[n.type] });
    await sendEmail({ userId: u.id, to: u.email, subject: `${n.title} — Kosh`, html, text, notificationType: n.type });
  }
}

/**
 * Notifications are written AFTER the money transaction commits.
 * A failure here must never undo or fail a completed transfer, so errors are logged and swallowed.
 */
export async function notify(items: NotificationInput[]) {
  if (!items.length) return;
  try {
    await db.notification.createMany({ data: items.map((n) => ({ userId: n.userId, type: n.type, title: n.title, body: n.body, link: n.link })) });
  } catch (err) {
    console.error("[notify] failed", err);
    return;
  }
  const emailItems = items.filter(wantsEmail);
  if (emailItems.length) {
    await afterResponse(() => deliverEmails(emailItems).catch((e) => console.error("[notify] email failed", e)));
  }
}

/** Notify every active user with one of these roles (staff queue alerts, admin escalations). */
export async function notifyRoles(roles: Role[], item: Omit<NotificationInput, "userId">, exceptUserId?: string) {
  try {
    const users = await db.user.findMany({ where: { role: { in: roles }, status: "ACTIVE", ...(exceptUserId ? { id: { not: exceptUserId } } : {}) }, select: { id: true } });
    await notify(users.map((u) => ({ ...item, userId: u.id })));
  } catch (err) {
    console.error("[notifyRoles] failed", err);
  }
}

/** Notify every active admin (e.g. a transaction was auto-flagged). */
export async function notifyAdmins(item: Omit<NotificationInput, "userId">) {
  await notifyRoles(["ADMIN"], item);
}
