import { z } from "zod";
import { handler, ok, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { listAllTransactions } from "@/server/services/management.service";

const query = z.object({
  state: z.enum(["open", "resolved"]).default("open"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** GET /api/admin/flagged?state=open|resolved */
export const GET = handler(async (req) => {
  await requireRole("ADMIN");
  const q = parseQuery(req, query);
  return ok(await listAllTransactions({ flagged: q.state, page: q.page, pageSize: q.pageSize }));
});
