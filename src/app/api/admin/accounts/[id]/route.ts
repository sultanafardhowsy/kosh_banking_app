import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { accountAdminSchema } from "@/lib/validators/money";
import { updateAccountAsAdmin } from "@/server/services/management.service";

/** PATCH /api/admin/accounts/:id — freeze | unfreeze | close | limits. Admin only. */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  const body = await parseBody(req, accountAdminSchema);
  return ok(await updateAccountAsAdmin(admin, id, body));
});
