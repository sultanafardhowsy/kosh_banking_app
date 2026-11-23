import { handler, ok } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { forwardLoan } from "@/server/services/loan.service";

/** POST /api/staff/loans/:id/forward — PENDING → UNDER_REVIEW (needs a note). */
export const POST = handler<{ id: string }>(async (_req, { params }) => {
  const actor = await requireRole("STAFF", "ADMIN");
  const { id } = await params;
  return ok(await forwardLoan(actor, id));
});
