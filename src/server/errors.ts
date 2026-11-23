/**
 * Typed application errors. Every handler converts these into
 * `{ error: { code, message } }` JSON with the matching HTTP status,
 * and the client maps `code` to a friendly toast.
 */
export const ERROR_CODES = {
  // auth / permissions
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  USER_BLOCKED: 403,
  SELF_ACTION_NOT_ALLOWED: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  // money
  INSUFFICIENT_FUNDS: 422,
  INVALID_PIN: 422,
  PIN_LOCKED: 423,
  PIN_NOT_SET: 422,
  LIMIT_EXCEEDED: 422,
  ACCOUNT_FROZEN: 422,
  CARD_INACTIVE: 422,
  RECIPIENT_NOT_FOUND: 404,
  SAME_ACCOUNT: 422,
  DUPLICATE_REQUEST: 409,
  ALREADY_EXISTS: 409,
  INVALID_STATE: 409,
  // two-factor
  OTP_REQUIRED: 428,
  OTP_INVALID: 422,
  OTP_EXPIRED: 410,
  OTP_LOCKED: 423,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = details;
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
