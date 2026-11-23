import type { ReactNode } from "react";
import type { Role } from "@prisma/client";
import { requirePageRole } from "@/server/auth/page-guards";
import StoreProvider from "@/store/StoreProvider";
import { AppShell } from "./AppShell";

/**
 * Server component used by each role's layout. Checks the session + role on
 * the server (wrong role → redirected to its own home), then hands the user
 * to a fresh Redux store for that area.
 */
export async function RoleLayout({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = await requirePageRole(...roles);
  return (
    <StoreProvider user={user}>
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}
