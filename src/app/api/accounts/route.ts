import { handler, ok } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { listOwnAccounts } from "@/server/services/customer-query.service";

/** GET /api/accounts — the customer's own accounts. */
export const GET = handler(async () => {
  const user = await requireRole("CUSTOMER");
  return ok(await listOwnAccounts(user.id));
});
