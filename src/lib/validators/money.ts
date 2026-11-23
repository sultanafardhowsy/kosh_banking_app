import { z } from "zod";
import { pinSchema } from "./auth";
import { LOAN_PRODUCTS } from "../loan-products";

/**
 * Amounts travel as integer paisa — a digit string ("125050") or a safe integer.
 * Never a float. Max ৳1,00,00,00,000 to keep inputs sane.
 */
export const paisaSchema = z
  .union([z.string().regex(/^\d{1,15}$/, "Amount must be whole paisa"), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)])
  .transform((v) => BigInt(v))
  .refine((v) => v > BigInt(0), "Amount must be greater than zero")
  .refine((v) => v <= BigInt("10000000000"), "Amount is too large");

export const accountNumberSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{12}$/, "Account number must be 12 digits"));

export const idempotencyKeySchema = z.string().min(8).max(100);

/**
 * POST /api/transfers. Note what is NOT here: balance, fee, receiver id.
 * Zod strips unknown keys, so a tampered `fee` in the body is ignored.
 */
/** Proof of the emailed two-factor code. */
export const otpProofSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const transferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountNumber: accountNumberSchema,
  amount: paisaSchema,
  description: z.string().trim().max(140).optional().default(""),
  pin: pinSchema,
  idempotencyKey: idempotencyKeySchema,
  otp: otpProofSchema.optional(),
});
export type TransferInput = z.infer<typeof transferSchema>;

export const transferPreviewSchema = transferSchema.pick({
  fromAccountId: true,
  toAccountNumber: true,
  amount: true,
});

export const setPinSchema = z
  .object({
    currentPin: pinSchema.optional(),
    newPin: pinSchema,
    confirmPin: pinSchema,
  })
  .refine((d) => d.newPin === d.confirmPin, { path: ["confirmPin"], message: "PINs don't match" })
  .refine((d) => !/^(\d)\1+$/.test(d.newPin), { path: ["newPin"], message: "Avoid repeated digits" });

export const createRequestSchema = z.object({
  accountId: z.string().min(1),
  type: z.enum(["DEPOSIT", "WITHDRAWAL"]),
  amount: paisaSchema,
  description: z.string().trim().max(200).optional().default(""),
});

export const reviewRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), note: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("reject"), note: z.string().trim().min(3, "Give a reason").max(300) }),
]);

export const flagSchema = z.object({ reason: z.string().trim().min(3, "Give a reason").max(300) });
export const reverseSchema = z.object({ reason: z.string().trim().min(3, "Give a reason").max(300) });

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
});

// ── Loans ─────────────────────────────────────────────

export const loanApplySchema = z
  .object({
    loanType: z.enum(["PERSONAL", "HOME", "AUTO", "EDUCATION", "BUSINESS"]),
    accountId: z.string().min(1),
    principal: paisaSchema,
    durationMonths: z.coerce.number().int(),
    monthlyIncome: paisaSchema,
    employmentStatus: z.enum(["SALARIED", "SELF_EMPLOYED", "BUSINESS_OWNER", "STUDENT", "UNEMPLOYED", "RETIRED"]),
    description: z.string().trim().min(5, "Tell us what the loan is for").max(300),
  })
  .superRefine((d, ctx) => {
    const p = LOAN_PRODUCTS[d.loanType];
    const min = BigInt(p.minTaka) * BigInt(100);
    const max = BigInt(p.maxTaka) * BigInt(100);
    if (d.principal < min || d.principal > max) {
      ctx.addIssue({ code: "custom", path: ["principal"], message: `${p.label} loans are ৳${p.minTaka.toLocaleString("en-IN")}–৳${p.maxTaka.toLocaleString("en-IN")}` });
    }
    if (d.durationMonths < p.minMonths || d.durationMonths > p.maxMonths) {
      ctx.addIssue({ code: "custom", path: ["durationMonths"], message: `Choose ${p.minMonths}–${p.maxMonths} months` });
    }
  });

export const loanNoteSchema = z.object({ note: z.string().trim().min(3).max(1000) });

export const loanDecisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(5, "Give the customer a reason").max(300) }),
]);

export const loanRepaySchema = z.object({ pin: pinSchema, idempotencyKey: idempotencyKeySchema });

// ── Staff / admin management ─────────────────────────
export const registerCustomerSchema = z.object({
  name: z.string().trim().min(2, "Enter the full name").max(80),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  phone: z.string().trim().regex(/^\+?\d{10,14}$/, "Phone like +8801712345678"),
  address: z.string().trim().min(5, "Enter an address").max(200),
  nid: z.string().trim().min(5, "Enter the (demo) NID").max(30),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  openAccount: z.enum(["NONE", "SAVINGS", "CURRENT", "BUSINESS"]).default("SAVINGS"),
});

/** A customer completing their own KYC details (self-signup / Google sign-in). */
export const kycProfileSchema = registerCustomerSchema.pick({ phone: true, address: true, nid: true, dateOfBirth: true });

export const openAccountSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(["SAVINGS", "CURRENT", "BUSINESS"]),
  nickname: z.string().trim().max(40).optional(),
});

export const userStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]),
  reason: z.string().trim().min(3, "Give a reason").max(300),
});

const optionalLimit = z.union([paisaSchema, z.literal(null)]).optional();
export const accountAdminSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("freeze"), reason: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("unfreeze"), reason: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("close"), reason: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("limits"), dailyTransferLimit: optionalLimit, maxSingleTxn: optionalLimit }),
]);

export const settingsSchema = z
  .object({
    dailyTransferLimit: paisaSchema,
    maxSingleTransaction: paisaSchema,
    minimumBalance: z.union([z.string().regex(/^\d{1,15}$/), z.number().int().nonnegative()]).transform((v) => BigInt(v)),
    transferFeeFlat: z.union([z.string().regex(/^\d{1,15}$/), z.number().int().nonnegative()]).transform((v) => BigInt(v)),
    transferFeePercentBps: z.coerce.number().int().min(0).max(500, "At most 5%"),
    transferFeeMax: z.union([paisaSchema, z.literal(null)]),
    otpThreshold: z.union([paisaSchema, z.literal(null)]).default(null),
  })
  .refine((s) => s.maxSingleTransaction <= s.dailyTransferLimit, { path: ["maxSingleTransaction"], message: "Can't exceed the daily limit" });

export const resolveFlagSchema = z.object({ note: z.string().trim().min(3, "Add a short note").max(300) });

// ── Virtual cards (simulated) ─────────────────────────
export const requestCardSchema = z.object({
  accountId: z.string().min(1),
  network: z.enum(["VISA", "MASTERCARD"]).default("VISA"),
});
export const cardUpdateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("freeze") }),
  z.object({ action: z.literal("unfreeze") }),
  z.object({ action: z.literal("limit"), dailySpendLimit: paisaSchema }),
]);
export const cardPaySchema = z.object({
  merchant: z.string().trim().min(2).max(60),
  amount: paisaSchema,
  pin: pinSchema,
  idempotencyKey: idempotencyKeySchema,
});
export const cardReviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(3).max(300) }),
]);
