import { handler, ok, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { listQuerySchema } from "@/lib/validators/money";
import { getAccountStatement } from "@/server/services/customer-query.service";

/** GET /api/accounts/:id?page= — account detail + ledger statement (ownership enforced). */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireRole("CUSTOMER");
  const { id } = await params;
  const q = parseQuery(req, listQuerySchema);
  return ok(await getAccountStatement(user.id, id, q.page, q.pageSize));
});
