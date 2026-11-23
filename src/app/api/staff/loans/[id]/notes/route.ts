import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { loanNoteSchema } from "@/lib/validators/money";
import { addLoanNote } from "@/server/services/loan.service";

/** POST /api/staff/loans/:id/notes — internal review note (not on own loan). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const actor = await requireRole("STAFF", "ADMIN");
  const { id } = await params;
  const { note } = await parseBody(req, loanNoteSchema);
  return ok(await addLoanNote(actor, id, note), { status: 201 });
});
