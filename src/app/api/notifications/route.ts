import { z } from "zod";
import { handler, ok, parseQuery } from "@/server/http";
import { requireUser } from "@/server/auth/guards";
import { listNotifications } from "@/server/services/customer-query.service";

const query = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  unread: z.enum(["1", "0"]).optional(),
});

/** GET /api/notifications — any signed-in user's own notifications + unread count. */
export const GET = handler(async (req) => {
  const user = await requireUser();
  const q = parseQuery(req, query);
  return ok(await listNotifications(user.id, q.page, q.pageSize, q.unread === "1"));
});
