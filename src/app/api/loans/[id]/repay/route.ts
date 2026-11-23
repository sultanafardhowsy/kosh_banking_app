import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { loanRepaySchema } from "@/lib/validators/money";
import { repayNextInstallment } from "@/server/services/loan.service";

/** POST /api/loans/:id/repay — pay the next installment ({ pin, idempotencyKey }). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireRole("CUSTOMER");
  const { id } = await params;
  const { pin, idempotencyKey } = await parseBody(req, loanRepaySchema);
  const result = await repayNextInstallment(user, id, pin, idempotencyKey);
  return ok(result, { status: result.replayed ? 200 : 201 });
});
