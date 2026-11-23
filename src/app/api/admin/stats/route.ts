import { handler, ok } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { adminStats } from "@/server/services/stats.service";

/** GET /api/admin/stats — KPIs + chart series. Admin only. */
export const GET = handler(async () => {
  await requireRole("ADMIN");
  return ok(await adminStats());
});
