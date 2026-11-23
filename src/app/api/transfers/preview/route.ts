import { handler, ok, parseBody } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { transferPreviewSchema } from "@/lib/validators/money";
import { previewTransfer } from "@/server/services/transfer.service";

/** POST /api/transfers/preview — the review step: fee, total, remaining daily limit. No side effects. */
export const POST = handler(async (req) => {
  const user = await requireRole("CUSTOMER");
  const input = await parseBody(req, transferPreviewSchema);
  return ok(await previewTransfer(user.id, input));
});
