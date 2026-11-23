import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";

/**
 * Better Auth — email + password, sessions stored in Postgres.
 *
 * - Passwords are hashed with bcrypt (same lib as transaction PINs, and the seed
 *   script can create users directly).
 * - `role`, `status`, `isVerified` are server-controlled (`input: false`), so a
 *   sign-up request can never choose its own role — self-registration always
 *   creates a CUSTOMER.
 * - BLOCKED / INACTIVE users cannot create a session (sign-in is refused).
 *   Guards also re-check status on every API call.
 */
export function googleEnabled() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export const auth = betterAuth({
  appName: "Kosh",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    password: {
      hash: (password) => bcrypt.hash(password, 10),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },

  // "Continue with Google" — only when both env vars are set. New Google users are
  // created as CUSTOMER (role is input:false) and unverified; blocked users are still
  // refused by the session hook below. Account linking keeps Better Auth's safe default:
  // a Google identity only links to an existing user whose email is already verified.
  socialProviders: googleEnabled()
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          prompt: "select_account",
        },
      }
    : undefined,

  // Our bank `Account` model owns the name "account", so Better Auth's
  // provider-account table is the `AuthAccount` model.
  account: { modelName: "authAccount" },

  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "CUSTOMER", input: false },
      status: { type: "string", required: false, defaultValue: "ACTIVE", input: false },
      isVerified: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { status: true },
          });
          if (!user || user.status !== "ACTIVE") {
            throw new APIError("FORBIDDEN", {
              message:
                user?.status === "BLOCKED"
                  ? "This account has been blocked. Contact the bank."
                  : "This account is inactive. Contact the bank.",
              code: "USER_BLOCKED",
            });
          }
        },
      },
    },
  },

  rateLimit: { enabled: true, window: 60, max: 30 },

  plugins: [nextCookies()], // must stay last
});

export type AuthSession = typeof auth.$Infer.Session;
