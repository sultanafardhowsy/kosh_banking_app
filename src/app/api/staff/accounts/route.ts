import { z } from "zod";
import { handler, ok, parseBody, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { openAccountSchema } from "@/lib/validators/money";
import { listAllAccounts, openAccount } from "@/server/services/management.service";

const query = z.object({
  q: z.string().trim().max(60).optional(),
  status: z.enum(["ACTIVE", "FROZEN", "CLOSED"]).optional(),
  type: z.enum(["SAVINGS", "CURRENT", "BUSINESS"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** GET /api/staff/accounts — all accounts. POST — open an account for a verified customer. */
export const GET = handler(async (req) => {
  await requireRole("STAFF", "ADMIN");
  const q = parseQuery(req, query);
  return ok(await listAllAccounts({ ...q, q: q.q || undefined }));
});

export const POST = handler(async (req) => {
  const actor = await requireRole("STAFF", "ADMIN");
  const input = await parseBody(req, openAccountSchema);
  return ok(await openAccount(actor, input), { status: 201 });
});
