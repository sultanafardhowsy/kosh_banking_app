import type { Metadata } from "next";

/** Gives this client-rendered section a browser-tab title ("Deposit & withdraw · Kosh"). */
export const metadata: Metadata = { title: "Deposit & withdraw" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
