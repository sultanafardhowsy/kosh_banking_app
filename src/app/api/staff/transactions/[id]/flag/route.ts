import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { flagSchema } from "@/lib/validators/money";
import { flagTransaction } from "@/server/services/transaction-admin.service";

/** POST /api/staff/transactions/:id/flag — manual fraud flag (staff + admin). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await requireRole("STAFF", "ADMIN");
  const { id } = await params;
  const { reason } = await parseBody(req, flagSchema);
  return ok(await flagTransaction(actor, id, reason));
});
