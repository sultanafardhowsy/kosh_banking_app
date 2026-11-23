import { handler, ok, parseBody, readOtp } from "@/server/http";
import { db } from "@/server/db";
import { withOtp } from "@/server/services/otp.service";
import { otpPayload } from "@/server/services/otp-payload";
import { requireRole } from "@/server/auth/guards";
import { setPinSchema } from "@/lib/validators/money";
import { setPin } from "@/server/services/pin.service";

/** POST /api/accounts/:id/pin — set or change the transaction PIN (ownership checked in the service). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireRole("CUSTOMER");
  const { id } = await params;
  const otp = await readOtp(req);
  const body = await parseBody(req, setPinSchema);
  const run = () => setPin({ userId: user.id, accountId: id, currentPin: body.currentPin, newPin: body.newPin });
  // Setting the first PIN needs no code; CHANGING an existing PIN does (the server decides, not the client).
  const acc = await db.account.findFirst({ where: { id, userId: user.id }, select: { transactionPinHash: true } });
  return ok(acc?.transactionPinHash ? await withOtp(user, "PIN_CHANGE", otpPayload.pinChange(id), otp, run) : await run());
});
