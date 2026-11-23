import { handler, ok, parseBody, readOtp } from "@/server/http";
import { withOtp } from "@/server/services/otp.service";
import { otpPayload } from "@/server/services/otp-payload";
import { requireRole } from "@/server/auth/guards";
import { settingsSchema } from "@/lib/validators/money";
import { getSettingsView, updateSettings } from "@/server/services/management.service";

/** GET/PUT /api/admin/settings — bank-wide limits and fees. Admin only. */
export const GET = handler(async () => {
  await requireRole("ADMIN");
  return ok(await getSettingsView());
});

export const PUT = handler(async (req) => {
  const admin = await requireRole("ADMIN");
  const otp = await readOtp(req);
  const input = await parseBody(req, settingsSchema);
  // two-factor: the emailed code must match these exact values
  return ok(await withOtp(admin, "SETTINGS", otpPayload.settings(input), otp, () => updateSettings(admin, input)));
});
