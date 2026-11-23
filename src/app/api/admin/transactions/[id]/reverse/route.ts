import { handler, ok, parseBody, readOtp } from "@/server/http";
import { withOtp } from "@/server/services/otp.service";
import { otpPayload } from "@/server/services/otp-payload";
import { requireRole } from "@/server/auth/guards";
import { reverseSchema } from "@/lib/validators/money";
import { reverseTransaction } from "@/server/services/transaction-admin.service";

/** POST /api/admin/transactions/:id/reverse — admin only; compensating transaction, original kept. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  const otp = await readOtp(req);
  const { reason } = await parseBody(req, reverseSchema);
  const result = await withOtp(admin, "REVERSAL", otpPayload.reversal(id), otp, () => reverseTransaction(admin, id, reason));
  return ok(result, { status: 201 });
});
