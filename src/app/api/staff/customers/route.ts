import { z } from "zod";
import { handler, ok, parseBody, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { registerCustomerSchema } from "@/lib/validators/money";
import { listCustomers, registerCustomer } from "@/server/services/management.service";

const query = z.object({
  q: z.string().trim().max(60).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
  verified: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** GET /api/staff/customers — search customers. POST — register a customer (staff + admin). */
export const GET = handler(async (req) => {
  await requireRole("STAFF", "ADMIN");
  const q = parseQuery(req, query);
  return ok(await listCustomers({ ...q, q: q.q || undefined, verified: q.verified === undefined ? undefined : q.verified === "true" }));
});

export const POST = handler(async (req) => {
  const actor = await requireRole("STAFF", "ADMIN");
  const input = await parseBody(req, registerCustomerSchema);
  return ok(await registerCustomer(actor, input), { status: 201 });
});
