import { z } from "zod";
import { handler, ok, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { listAllTransactions } from "@/server/services/management.service";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const query = z.object({
  q: z.string().trim().max(60).optional(),
  type: z.enum(["DEPOSIT", "WITHDRAWAL", "TRANSFER", "LOAN_DISBURSEMENT", "LOAN_REPAYMENT", "CARD_PAYMENT", "REVERSAL"]).optional(),
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "REVERSED"]).optional(),
  flagged: z.enum(["open", "resolved", "any"]).optional(),
  from: date,
  to: date,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** GET /api/staff/transactions — every transaction in the bank (staff + admin). */
export const GET = handler(async (req) => {
  await requireRole("STAFF", "ADMIN");
  const q = parseQuery(req, query);
  return ok(await listAllTransactions({ ...q, q: q.q || undefined }));
});
