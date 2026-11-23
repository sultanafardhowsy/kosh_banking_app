import "server-only";
import { headers } from "next/headers";
import type { Role } from "@prisma/client";
import { auth } from "./auth";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  isVerified: boolean;
};

/**
 * Reads the session from the request cookies (DB-backed, no cookie cache —
 * so a role/status change takes effect on the very next request).
 * Returns null when signed out.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & Partial<SessionUser>;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: (u.role ?? "CUSTOMER") as Role,
    status: (u.status ?? "ACTIVE") as SessionUser["status"],
    isVerified: Boolean(u.isVerified),
  };
}

/** Throws 401 if signed out, 403 if blocked/inactive. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  if (user.status !== "ACTIVE") throw new AppError("USER_BLOCKED", "Your account is not active");
  return user;
}

/**
 * First line of every protected route handler.
 *   const user = await requireRole("ADMIN", "STAFF");
 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (roles.length && !roles.includes(user.role)) {
    throw new AppError("FORBIDDEN", "You don't have permission to do that");
  }
  return user;
}

/**
 * Ensures the bank account belongs to the user. Responds 404 (not 403) so a
 * customer can't probe which account ids exist.
 * Pass a transaction client to run inside `db.$transaction`.
 */
export async function assertAccountOwner(
  userId: string,
  accountId: string,
  client: Pick<typeof db, "account"> = db,
) {
  const account = await client.account.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) throw new AppError("NOT_FOUND", "Account not found");
  return account;
}

/**
 * Staff/Admin cannot act on their own requests, loans or accounts
 * (four-eyes principle).
 */
export function assertNotSelf(actorId: string, ownerId: string) {
  if (actorId === ownerId) {
    throw new AppError("SELF_ACTION_NOT_ALLOWED", "You can't review your own request");
  }
}
