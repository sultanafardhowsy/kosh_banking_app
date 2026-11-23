import { isRejectedWithValue, type Middleware } from "@reduxjs/toolkit";
import { toast } from "@heroui/react";
import { isApiErrorBody, messageForError } from "@/lib/error-messages";

/**
 * Centralized API error handling: any rejected RTK Query call → toast.
 * Endpoints whose errors are shown inline in their form are listed here instead.
 */
const SILENT_ENDPOINTS = new Set(["previewTransfer", "transfer", "createRequest", "applyLoan", "repayLoan", "setPin", "payWithCard", "requestCard", "requestOtp"]);

export const rtkQueryErrorLogger: Middleware = () => (next) => (action) => {
  if (isRejectedWithValue(action)) {
    const meta = action.meta as { arg?: { type?: string; endpointName?: string } } & {
      baseQueryMeta?: unknown;
    };
    const payload = action.payload as { status?: number | string; data?: unknown } | undefined;

    // Queries that 401 are handled by the layout redirect; don't spam toasts.
    const isQuery = meta.arg?.type === "query";
    // Two-factor errors (wrong/expired code) are shown inside the code dialog instead.
    const isOtpError = isApiErrorBody(payload?.data) && payload.data.error.code.startsWith("OTP_");
    const silent = isOtpError || SILENT_ENDPOINTS.has(meta.arg?.endpointName ?? "");
    if (!silent && !(isQuery && payload?.status === 401) && typeof window !== "undefined") {
      const status = payload?.status;
      const msg =
        status === "FETCH_ERROR"
          ? "Network error — check your connection."
          : messageForError(payload?.data);
      toast.danger(msg);
    }
  }
  return next(action);
};
