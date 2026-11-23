import { handler, ok } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { getLoanForReview } from "@/server/services/loan.service";

/** GET /api/staff/loans/:id — full review view incl. internal notes and affordability. */
export const GET = handler<{ id: string }>(async (_req, { params }) => {
  await requireRole("STAFF", "ADMIN");
  const { id } = await params;
  return ok(await getLoanForReview(id));
});
