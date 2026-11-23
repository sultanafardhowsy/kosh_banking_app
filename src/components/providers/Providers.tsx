"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { Toast } from "@heroui/react";

/**
 * App-wide client providers. The Redux store is NOT created here — each role
 * area (customer / staff / admin) mounts its own StoreProvider hydrated with
 * the server session user, so public pages stay light.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
      <Toast.Provider placement="top end" />
    </ThemeProvider>
  );
}
