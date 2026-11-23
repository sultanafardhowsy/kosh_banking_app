import { z } from "zod";
import { handler, ok, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { listAudit } from "@/server/services/management.service";

const query = z.object({
  entity: z.string().max(40).optional(),
  action: z.string().max(40).optional(),
  actorId: z.string().max(40).optional(),
  q: z.string().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** GET /api/admin/audit — every staff/admin action. */
export const GET = handler(async (req) => {
  await requireRole("ADMIN");
  const q = parseQuery(req, query);
  return ok(await listAudit({ ...q, entity: q.entity || undefined, action: q.action || undefined, actorId: q.actorId || undefined, q: q.q || undefined }));
});
