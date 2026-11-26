import type { Metadata } from "next";

/** Gives this client-rendered section a browser-tab title ("Accounts · Kosh"). */
export const metadata: Metadata = { title: "Accounts" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
