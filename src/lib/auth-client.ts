"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/server/auth/auth";

/** Browser auth client. Same origin, so no baseURL needed. */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
