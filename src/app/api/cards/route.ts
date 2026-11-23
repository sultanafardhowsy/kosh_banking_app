import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { requestCardSchema } from "@/lib/validators/money";
import { listCardTransactions, listOwnCards, requestCard } from "@/server/services/card.service";

/** GET /api/cards — own cards + recent card payments. POST — request a virtual card (simulated). */
export const GET = handler(async () => {
  const user = await requireRole("CUSTOMER");
  const [cards, payments] = await Promise.all([listOwnCards(user.id), listCardTransactions(user.id)]);
  return ok({ cards, payments });
});

export const POST = handler(async (req) => {
  const user = await requireRole("CUSTOMER");
  const input = await parseBody(req, requestCardSchema);
  return ok(await requestCard(user, input), { status: 201 });
});
