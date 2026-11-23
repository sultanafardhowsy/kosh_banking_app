import { z } from "zod";
import { handler, ok, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { listQuerySchema } from "@/lib/validators/money";
import { listRequests } from "@/server/services/request.service";

const query = listQuerySchema.extend({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional() });

/** GET /api/staff/requests — review queue (staff + admin). */
export const GET = handler(async (req) => {
  await requireRole("STAFF", "ADMIN");
  const q = parseQuery(req, query);
  return ok(await listRequests(q));
});
