import type { Metadata } from "next";

/** Gives this client-rendered section a browser-tab title ("Loans · Kosh"). */
export const metadata: Metadata = { title: "Loans" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
