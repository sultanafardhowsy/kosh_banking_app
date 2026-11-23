import { handler, ok } from "@/server/http";
import { requireUser } from "@/server/auth/guards";
import { markAllNotificationsRead } from "@/server/services/customer-query.service";

/** POST /api/notifications/read-all */
export const POST = handler(async () => {
  const user = await requireUser();
  return ok(await markAllNotificationsRead(user.id));
});
