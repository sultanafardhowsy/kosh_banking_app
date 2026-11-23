import { handler, ok } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { getCustomer } from "@/server/services/management.service";

/** GET /api/staff/customers/:id — profile, accounts, loans, recent activity, audit. */
export const GET = handler<{ id: string }>(async (_req, { params }) => {
  await requireRole("STAFF", "ADMIN");
  const { id } = await params;
  return ok(await getCustomer(id));
});
