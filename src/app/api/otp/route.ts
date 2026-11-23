import { z } from "zod";
import { handler, ok, parseBody } from "@/server/http";
import { requireUser } from "@/server/auth/guards";
import {
  accountNumberSchema,
  paisaSchema,
  settingsSchema,
} from "@/lib/validators/money";
import { issueOtp } from "@/server/services/otp-operations";

const body = z.discriminatedUnion("purpose", [
  z.object({
    purpose: z.literal("TRANSFER"),
    fromAccountId: z.string().min(1),
    toAccountNumber: accountNumberSchema,
    amount: paisaSchema,
  }),
  z.object({ purpose: z.literal("PIN_CHANGE"), accountId: z.string().min(1) }),
  z.object({
    purpose: z.literal("REVERSAL"),
    transactionId: z.string().min(1),
  }),
  z.object({ purpose: z.literal("SETTINGS"), settings: settingsSchema }),
]);

/** POST /api/otp — email a 6-digit code that approves exactly one sensitive operation. */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, body);
  return ok(await issueOtp(user, input), { status: 201 });
});
