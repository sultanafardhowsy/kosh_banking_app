import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getSessionUser, type SessionUser } from "./guards";
import { ROLE_HOME } from "@/lib/constants";

/**
 * For server layouts/pages: redirect instead of throwing.
 * A STAFF user opening /admin/* lands on their own home, etc.
 */
export async function requirePageRole(...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/login?blocked=1");
  if (roles.length && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}
