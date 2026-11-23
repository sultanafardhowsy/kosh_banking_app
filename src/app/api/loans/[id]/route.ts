import { handler, ok } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { getOwnLoan } from "@/server/services/loan.service";

/** GET /api/loans/:id — own loan with EMI schedule. */
export const GET = handler<{ id: string }>(async (_req, { params }) => {
  const user = await requireRole("CUSTOMER");
  const { id } = await params;
  return ok(await getOwnLoan(user.id, id));
});
