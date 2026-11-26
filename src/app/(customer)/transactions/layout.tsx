import type { Metadata } from "next";

/** Gives this client-rendered section a browser-tab title ("Transactions · Kosh"). */
export const metadata: Metadata = { title: "Transactions" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
