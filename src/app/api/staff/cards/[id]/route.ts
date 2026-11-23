import { z } from "zod";
import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { reviewCard, setCardFrozenAsStaff } from "@/server/services/card.service";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("freeze") }),
  z.object({ action: z.literal("unfreeze") }),
]);

/** PATCH /api/staff/cards/:id — approve | reject | freeze | unfreeze (not own card). */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const actor = await requireRole("STAFF", "ADMIN");
  const { id } = await params;
  const b = await parseBody(req, body);
  if (b.action === "freeze" || b.action === "unfreeze") return ok(await setCardFrozenAsStaff(actor, id, b.action === "freeze"));
  return ok(await reviewCard(actor, id, b));
});
