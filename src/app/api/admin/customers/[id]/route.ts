import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { userStatusSchema } from "@/lib/validators/money";
import { setUserStatus } from "@/server/services/management.service";

/** PATCH /api/admin/customers/:id — { status: ACTIVE | INACTIVE | BLOCKED, reason }. Admin only. */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  const { status, reason } = await parseBody(req, userStatusSchema);
  return ok(await setUserStatus(admin, id, status, reason));
});
