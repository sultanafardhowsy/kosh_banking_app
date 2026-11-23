import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { transferSchema } from "@/lib/validators/money";
import { executeTransfer } from "@/server/services/transfer.service";

/** POST /api/transfers — customers only. Body has no balance and no fee. */
export const POST = handler(async (req) => {
  const user = await requireRole("CUSTOMER");
  const input = await parseBody(req, transferSchema);
  const result = await executeTransfer(user.id, input);
  return ok(result, { status: result.replayed ? 200 : 201 });
});
