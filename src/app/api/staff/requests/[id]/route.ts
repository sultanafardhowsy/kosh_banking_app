import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { reviewRequestSchema } from "@/lib/validators/money";
import { approveRequest, rejectRequest } from "@/server/services/request.service";

/** PATCH /api/staff/requests/:id — { action: "approve" | "reject", note }. Reviewer ≠ requester. */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const reviewer = await requireRole("STAFF", "ADMIN");
  const { id } = await params;
  const body = await parseBody(req, reviewRequestSchema);
  const result = body.action === "approve" ? await approveRequest(reviewer, id, body.note) : await rejectRequest(reviewer, id, body.note);
  return ok(result);
});
