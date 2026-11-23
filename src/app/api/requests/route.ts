import { handler, ok, parseBody, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { createRequestSchema, listQuerySchema } from "@/lib/validators/money";
import { createRequest, listOwnRequests } from "@/server/services/request.service";

/** GET /api/requests — the customer's own deposit/withdrawal requests. */
export const GET = handler(async (req) => {
  const user = await requireRole("CUSTOMER");
  const q = parseQuery(req, listQuerySchema);
  return ok(await listOwnRequests(user.id, q.page, q.pageSize));
});

/** POST /api/requests — create a PENDING request; staff approval moves the money. */
export const POST = handler(async (req) => {
  const user = await requireRole("CUSTOMER");
  const input = await parseBody(req, createRequestSchema);
  return ok(await createRequest(user, input), { status: 201 });
});
