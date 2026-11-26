import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
// Fallback for the taka sign (৳), which Inter and Space Grotesk don't include. Listed after
// them in the font stacks, so the browser only downloads its Bengali subset when ৳ appears.
import "@fontsource-variable/noto-sans-bengali";
import "./globals.css";
import Providers from "@/components/providers/Providers";

export const metadata: Metadata = {
  title: { default: "Kosh — Digital Banking", template: "%s · Kosh" },
  description: "Kosh is a simulated digital bank. No real money is involved.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-kosh-bg text-kosh-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
