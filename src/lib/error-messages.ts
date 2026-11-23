/** Friendly copy for API error codes (used by the RTK Query error toaster and forms). */
export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You don't have permission to do that.",
  USER_BLOCKED: "Your profile is not active. Contact the bank.",
  SELF_ACTION_NOT_ALLOWED: "You can't review your own request.",
  NOT_FOUND: "We couldn't find that.",
  VALIDATION_ERROR: "Please check the highlighted fields.",
  INSUFFICIENT_FUNDS: "Insufficient balance after fees and minimum balance.",
  INVALID_PIN: "Incorrect transaction PIN.",
  PIN_LOCKED: "PIN locked after too many attempts. Try again in 15 minutes.",
  PIN_NOT_SET: "Set a transaction PIN for this account first.",
  LIMIT_EXCEEDED: "This exceeds your transfer limit.",
  ACCOUNT_FROZEN: "This account is frozen.",
  CARD_INACTIVE: "This card can't be used right now.",
  RECIPIENT_NOT_FOUND: "No active account with that number.",
  SAME_ACCOUNT: "You can't transfer to the same account.",
  DUPLICATE_REQUEST: "This request was already processed.",
  ALREADY_EXISTS: "That already exists.",
  INVALID_STATE: "This item can't be changed in its current state.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
  OTP_REQUIRED: "Enter the code we emailed you.",
  OTP_INVALID: "That code isn't right.",
  OTP_EXPIRED: "This code has expired. Ask for a new one.",
  OTP_LOCKED: "Too many wrong codes. Ask for a new one.",
  RATE_LIMITED: "Too many attempts. Please wait a moment.",
};

export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };

export function isApiErrorBody(x: unknown): x is ApiErrorBody {
  return (
    typeof x === "object" &&
    x !== null &&
    "error" in x &&
    typeof (x as ApiErrorBody).error?.code === "string"
  );
}

/** Prefer the server's message when it's specific, otherwise the friendly default. */
export function messageForError(body: unknown, fallback = ERROR_MESSAGES.INTERNAL_ERROR): string {
  if (!isApiErrorBody(body)) return fallback;
  const { code, message } = body.error;
  if (message && message !== code) return message;
  return ERROR_MESSAGES[code] ?? fallback;
}
