import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { resolveFlagSchema } from "@/lib/validators/money";
import { resolveFlag } from "@/server/services/management.service";

/** PATCH /api/admin/flagged/:id — mark a flag as reviewed (no money moves). To undo money, use reverse. */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  const { note } = await parseBody(req, resolveFlagSchema);
  return ok(await resolveFlag(admin, id, note));
});
