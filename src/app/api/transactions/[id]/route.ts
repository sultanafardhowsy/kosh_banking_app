import { handler, ok } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { getOwnTransaction } from "@/server/services/customer-query.service";

/** GET /api/transactions/:id — only if it touches one of the customer's accounts. */
export const GET = handler<{ id: string }>(async (_req, { params }) => {
  const user = await requireRole("CUSTOMER");
  const { id } = await params;
  return ok(await getOwnTransaction(user.id, id));
});
