export const APP_NAME = "Kosh";
export const SIMULATION_NOTICE = "Simulated bank — no real money.";

export const ROLES = ["ADMIN", "STAFF", "CUSTOMER"] as const;
export type AppRole = (typeof ROLES)[number];

/** Where each role lands after login. */
export const ROLE_HOME: Record<AppRole, string> = {
  ADMIN: "/admin/overview",
  STAFF: "/staff/overview",
  CUSTOMER: "/dashboard",
};

/** Security policy (kept here so services + tests share one source). */
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;

/** Default bank settings (paisa). Seeded into BankSettings row id=1. */
export const DEFAULT_SETTINGS = {
  dailyTransferLimit: BigInt(500_000_00), // ৳5,00,000
  maxSingleTransaction: BigInt(200_000_00), // ৳2,00,000
  minimumBalance: BigInt(500_00), // ৳500
  transferFeeFlat: BigInt(5_00), // ৳5
  transferFeePercentBps: 25, // 0.25%
  transferFeeMax: BigInt(250_00), // cap ৳250
} as const;

/** Two-factor: transfers at or above this need the emailed code (seed default; admin can change or clear it). */
export const DEFAULT_OTP_THRESHOLD = BigInt(25_000_00); // ৳25,000

/** Virtual cards (simulated). */
export const CARD_DEFAULT_DAILY_LIMIT = BigInt(25_000_00); // ৳25,000
export const CARD_VALID_YEARS = 3;
