import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { reverseSchema } from "@/lib/validators/money";
import { blockCard } from "@/server/services/card.service";

/** PATCH /api/admin/cards/:id/block — permanent block { reason }. Admin only. */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  const { reason } = await parseBody(req, reverseSchema);
  return ok(await blockCard(admin, id, reason));
});
