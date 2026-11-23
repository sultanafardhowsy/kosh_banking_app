import { cn } from "@/lib/format";
import type { CardRow } from "@/types/api";

/**
 * Glassmorphism card face (indigo → teal). Shows only the masked number.
 * Clearly labelled "Simulated" — never resembles a real issuer's card.
 */
export function VirtualCard({ card, revealed = false, className, compact }: { card: CardRow; revealed?: boolean; className?: string; compact?: boolean }) {
  const inactive = card.status !== "ACTIVE";
  const pending = card.status === "REQUESTED" || card.status === "REJECTED";
  return (
    <div
      className={cn(
        "relative isolate aspect-[1.586] w-full overflow-hidden rounded-[22px] p-5 text-white shadow-[0_20px_50px_-20px_rgba(53,87,245,0.55)]",
        "bg-[linear-gradient(135deg,#3B2FD6_0%,#3557F5_45%,#22B8C8_100%)]",
        compact && "rounded-2xl p-4",
        className,
      )}
    >
      {/* glass sheen + orbs */}
      <div aria-hidden className="absolute -right-10 -top-16 size-48 rounded-full bg-[#5EEAD4]/40 blur-2xl" />
      <div aria-hidden className="absolute -bottom-20 -left-10 size-56 rounded-full bg-[#6D5BFF]/50 blur-3xl" />
      <div aria-hidden className="absolute inset-0 rounded-[inherit] border border-white/25 bg-white/[0.06] backdrop-blur-[2px]" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-semibold tracking-tight">Kosh</span>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">Simulated</span>
          </div>
          {/* chip */}
          <svg viewBox="0 0 40 30" className="h-7 w-9 opacity-90" aria-hidden>
            <rect x="1" y="1" width="38" height="28" rx="6" fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.6)" />
            <path d="M14 1v28M26 1v28M1 11h13M26 11h13M1 19h13M26 19h13" stroke="rgba(255,255,255,0.55)" />
          </svg>
        </div>

        <p className={cn("amount tracking-[0.14em]", compact ? "text-base" : "text-xl sm:text-2xl")}>
          {pending ? "•••• •••• •••• ••••" : card.cardNumberMasked}
        </p>

        <div className="flex items-end justify-between gap-3 text-xs">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Card holder</p>
            <p className="truncate font-medium">{revealed || compact ? card.cardholderName : card.cardholderName.split(" ")[0] + " ••••"}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Expires</p>
            <p className="amount font-medium">{pending ? "--/--" : revealed ? `${String(card.expiryMonth).padStart(2, "0")}/${String(card.expiryYear).slice(-2)}` : "••/••"}</p>
          </div>
          <span className="font-display text-base font-bold italic tracking-tight">{card.network === "VISA" ? "VISA" : "MC"}</span>
        </div>
      </div>

      {inactive && (
        <div className="absolute inset-0 grid place-items-center rounded-[inherit] bg-[#0A0F1E]/55 backdrop-blur-[1px]">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#0B1533]">
            {card.status === "FROZEN" ? "Frozen" : card.status === "BLOCKED" ? "Blocked" : card.status === "REJECTED" ? "Request declined" : "Awaiting approval"}
          </span>
        </div>
      )}
    </div>
  );
}
