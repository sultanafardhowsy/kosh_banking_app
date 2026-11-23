import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { cardPaySchema } from "@/lib/validators/money";
import { payWithCard } from "@/server/services/card.service";

/** POST /api/cards/:id/pay — simulated merchant payment { merchant, amount, pin, idempotencyKey }. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireRole("CUSTOMER");
  const { id } = await params;
  const r = await payWithCard(user, id, await parseBody(req, cardPaySchema));
  return ok(r, { status: r.replayed ? 200 : 201 });
});
