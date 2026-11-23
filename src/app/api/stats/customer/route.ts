import { z } from "zod";
import { handler, ok, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { customerStats } from "@/server/services/stats.service";

/** GET /api/stats/customer?accountId= — own chart data only. */
export const GET = handler(async (req) => {
  const user = await requireRole("CUSTOMER");
  const { accountId } = parseQuery(req, z.object({ accountId: z.string().optional() }));
  return ok(await customerStats(user.id, accountId || undefined));
});
