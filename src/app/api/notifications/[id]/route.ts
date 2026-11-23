import { handler, ok } from "@/server/http";
import { requireUser } from "@/server/auth/guards";
import { markNotificationRead } from "@/server/services/customer-query.service";

/** PATCH /api/notifications/:id — mark one as read (own only). */
export const PATCH = handler<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  return ok(await markNotificationRead(user.id, id));
});
