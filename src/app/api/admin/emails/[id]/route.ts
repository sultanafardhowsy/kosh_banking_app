import { handler, ok } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

/** GET /api/admin/emails/:id — full email incl. HTML body for the preview. */
export const GET = handler<{ id: string }>(async (_req, { params }) => {
  await requireRole("ADMIN");
  const { id } = await params;
  const email = await db.emailLog.findUnique({ where: { id } });
  if (!email) throw new AppError("NOT_FOUND", "Email not found");
  return ok(email);
});
