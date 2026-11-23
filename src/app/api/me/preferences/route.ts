import { z } from "zod";
import { handler, ok, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { emailConfig } from "@/server/email/email.service";

/** GET/PATCH /api/me/preferences — notification preferences for the signed-in user (any role). */
export const GET = handler(async () => {
  const user = await requireUser();
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailNotifications: true, email: true } });
  return ok({ ...u, emailProvider: emailConfig().provider });
});

export const PATCH = handler(async (req) => {
  const user = await requireUser();
  const { emailNotifications } = await parseBody(req, z.object({ emailNotifications: z.boolean() }));
  const u = await db.user.update({ where: { id: user.id }, data: { emailNotifications }, select: { emailNotifications: true, email: true } });
  return ok({ ...u, emailProvider: emailConfig().provider });
});
