import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { cardUpdateSchema } from "@/lib/validators/money";
import { updateOwnCard } from "@/server/services/card.service";

/** PATCH /api/cards/:id — freeze | unfreeze | limit (own card only). */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireRole("CUSTOMER");
  const { id } = await params;
  return ok(await updateOwnCard(user.id, id, await parseBody(req, cardUpdateSchema)));
});
