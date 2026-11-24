import Link from "next/link";
import { cn } from "@/lib/format";

/** Kosh wordmark: brand-blue tile with a teal "k" stroke. Original mark for this fictional bank. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#0F4C81" />
      <path d="M11 8v16" stroke="#2DD4BF" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M21.5 9.5 13.5 17l8.5 7" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ href = "/", className, compact }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)} aria-label="Kosh home">
      <LogoMark />
      {!compact && <span className="font-display text-xl font-semibold tracking-tight">Kosh</span>}
    </Link>
  );
}
