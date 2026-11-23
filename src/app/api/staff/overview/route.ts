import { handler, ok } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { staffOverview } from "@/server/services/stats.service";

/** GET /api/staff/overview — the staff work queue summary (limited analytics). */
export const GET = handler(async () => {
  await requireRole("STAFF", "ADMIN");
  return ok(await staffOverview());
});
