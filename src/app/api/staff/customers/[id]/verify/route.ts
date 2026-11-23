import { handler, ok } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { verifyCustomer } from "@/server/services/management.service";

/** PATCH /api/staff/customers/:id/verify — mark KYC verified. */
export const PATCH = handler<{ id: string }>(async (_req, { params }) => {
  const actor = await requireRole("STAFF", "ADMIN");
  const { id } = await params;
  return ok(await verifyCustomer(actor, id));
});
