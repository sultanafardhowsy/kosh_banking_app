import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { loanDecisionSchema } from "@/lib/validators/money";
import { approveLoan, rejectLoan } from "@/server/services/loan.service";

/** PATCH /api/admin/loans/:id — { action: "approve" } or { action: "reject", reason }. Admin only. */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  const body = await parseBody(req, loanDecisionSchema);
  return ok(body.action === "approve" ? await approveLoan(admin, id) : await rejectLoan(admin, id, body.reason));
});
