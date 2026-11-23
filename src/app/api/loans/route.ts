import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { loanApplySchema } from "@/lib/validators/money";
import { applyForLoan, listOwnLoans } from "@/server/services/loan.service";

/** GET /api/loans — own loans. POST — apply (rate decided server-side). */
export const GET = handler(async () => {
  const user = await requireRole("CUSTOMER");
  return ok(await listOwnLoans(user.id));
});

export const POST = handler(async (req) => {
  const user = await requireRole("CUSTOMER");
  const input = await parseBody(req, loanApplySchema);
  return ok(await applyForLoan(user, input), { status: 201 });
});
