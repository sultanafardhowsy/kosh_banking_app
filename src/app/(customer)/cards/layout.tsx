import type { Metadata } from "next";

/** Gives this client-rendered section a browser-tab title ("Cards · Kosh"). */
export const metadata: Metadata = { title: "Cards" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
