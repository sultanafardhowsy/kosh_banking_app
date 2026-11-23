import { z } from "zod";
import { handler, ok, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { listOwnTransactions } from "@/server/services/customer-query.service";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const query = z.object({
  accountId: z.string().optional(),
  q: z.string().trim().max(60).optional(),
  type: z.enum(["DEPOSIT", "WITHDRAWAL", "TRANSFER", "LOAN_DISBURSEMENT", "LOAN_REPAYMENT", "CARD_PAYMENT", "REVERSAL"]).optional(),
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "REVERSED"]).optional(),
  from: date,
  to: date,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** GET /api/transactions — own transactions with search, filters and pagination. */
export const GET = handler(async (req) => {
  const user = await requireRole("CUSTOMER");
  const f = parseQuery(req, query);
  return ok(await listOwnTransactions(user.id, { ...f, q: f.q || undefined }));
});
