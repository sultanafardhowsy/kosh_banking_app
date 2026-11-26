import type { Metadata } from "next";

/** Gives this client-rendered section a browser-tab title ("Profile & PIN · Kosh"). */
export const metadata: Metadata = { title: "Profile & PIN" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
