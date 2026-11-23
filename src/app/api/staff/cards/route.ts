import { z } from "zod";
import { handler, ok, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { listCardsForReview } from "@/server/services/card.service";

const query = z.object({
  status: z.enum(["REQUESTED", "ACTIVE", "FROZEN", "BLOCKED", "REJECTED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** GET /api/staff/cards — card requests and issued cards (staff + admin). */
export const GET = handler(async (req) => {
  await requireRole("STAFF", "ADMIN");
  return ok(await listCardsForReview(parseQuery(req, query)));
});
