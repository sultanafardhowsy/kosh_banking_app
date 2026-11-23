import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { getKycProfile, submitKycProfile } from "@/server/services/management.service";
import { kycProfileSchema } from "@/lib/validators/money";

/** GET /api/me/profile — the customer's own KYC details. */
export const GET = handler(async () => {
  const user = await requireRole("CUSTOMER");
  return ok(await getKycProfile(user.id));
});

/** PATCH /api/me/profile — fill in / correct KYC details; locked once staff verify. */
export const PATCH = handler(async (req) => {
  const user = await requireRole("CUSTOMER");
  const input = await parseBody(req, kycProfileSchema);
  return ok(await submitKycProfile(user, input));
});
