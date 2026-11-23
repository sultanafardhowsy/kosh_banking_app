"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "./index";
import { setUser } from "./slices/authSlice";
import type { Me } from "@/types/api";

/**
 * Creates the store once per mounted tree. When a role layout passes the
 * server-side session user, auth state is hydrated before first render.
 */
export default function StoreProvider({ user, children }: { user?: Me | null; children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore(user ? { auth: { user } } : undefined);
  }

  // Keep auth in sync if the server user changes (e.g. after router.refresh()).
  useEffect(() => {
    if (user !== undefined) storeRef.current?.dispatch(setUser(user));
  }, [user]);

  return <Provider store={storeRef.current}>{children}</Provider>;
}
