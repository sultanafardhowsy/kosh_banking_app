"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/format";

const FEATURES = [
  {
    id: "transfer",
    title: "Send money in four steps",
    body: "Enter the account number, review the fee and your remaining daily limit, confirm with your PIN, get a receipt.",
    image: "/landing/transfer.png",
    alt: "Kosh transfer review step showing amount, fee, total and remaining daily limit",
  },
  {
    id: "history",
    title: "See every taka move",
    body: "Search and filter your history, open any transaction to see both ledger lines, download a PDF receipt or statement.",
    image: "/landing/transactions.png",
    alt: "Kosh transaction history with filters and a list of transfers and deposits",
  },
  {
    id: "loans",
    title: "Borrow with the EMI in view",
    body: "Pick a loan, see the exact monthly payment before you apply, then follow the review and repay from the schedule.",
    image: "/landing/loan.png",
    alt: "Kosh loan page with remaining balance, progress and repayment schedule",
  },
  {
    id: "cards",
    title: "A virtual card per account",
    body: "Request a card, freeze it with one switch, set your own daily limit and pay merchants with your PIN.",
    image: "/landing/cards.png",
    alt: "Kosh virtual cards page with a glass-style card, spend meter and recent card payments",
  },
] as const;

/** Clickable list on the left; the navy panel on the right swaps to that part of the real app. */
export function FeatureSwitcher() {
  const [active, setActive] = useState<(typeof FEATURES)[number]["id"]>("transfer");
  const current = FEATURES.find((f) => f.id === active)!;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <div role="tablist" aria-label="Kosh features" aria-orientation="vertical" className="flex flex-col gap-2">
        {FEATURES.map((f) => {
          const on = f.id === active;
          return (
            <button
              key={f.id}
              role="tab"
              id={`tab-${f.id}`}
              aria-selected={on}
              aria-controls="feature-panel"
              onClick={() => setActive(f.id)}
              className={cn(
                "rounded-2xl px-5 py-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-kosh-info",
                on ? "bg-kosh-surface shadow-[0_1px_0_var(--kosh-border),0_12px_30px_-18px_rgba(11,21,51,0.35)]" : "hover:bg-kosh-surface/60",
              )}
            >
              <span className={cn("font-display text-xl font-semibold sm:text-2xl", on ? "text-kosh-text" : "text-kosh-muted")}>{f.title}</span>
              <span className={cn("mt-1.5 block max-w-md text-[15px] leading-relaxed text-kosh-muted", !on && "hidden lg:block lg:opacity-0 lg:h-0 lg:mt-0 lg:overflow-hidden")}>
                {f.body}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id="feature-panel"
        role="tabpanel"
        aria-labelledby={`tab-${current.id}`}
        className="relative overflow-hidden rounded-[28px] bg-kosh-navy p-4 sm:p-8"
      >
        <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-[#3557F5]/40 blur-3xl" />
        <div aria-hidden className="absolute -bottom-28 -left-16 size-72 rounded-full bg-[#22B8C8]/25 blur-3xl" />
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A0F1E] shadow-2xl">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-white/20" />
            <span className="size-2.5 rounded-full bg-white/20" />
            <span className="size-2.5 rounded-full bg-white/20" />
          </div>
          <Image key={current.image} src={current.image} alt={current.alt} width={1280} height={800} className="h-auto w-full" priority={current.id === "transfer"} />
        </div>
      </div>
    </div>
  );
}
