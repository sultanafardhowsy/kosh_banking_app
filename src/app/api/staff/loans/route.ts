import { z } from "zod";
import { handler, ok, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { listLoansForReview } from "@/server/services/loan.service";

const query = z.object({
  status: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "ACTIVE", "COMPLETED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** GET /api/staff/loans — all applications/loans (staff + admin). */
export const GET = handler(async (req) => {
  await requireRole("STAFF", "ADMIN");
  return ok(await listLoansForReview(parseQuery(req, query)));
});
