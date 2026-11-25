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

const GRADIENT = "bg-[linear-gradient(135deg,#0A3A63_0%,#0F4C81_50%,#007A78_100%)]";

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
                "relative overflow-hidden rounded-2xl px-5 py-4 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-kosh-info",
                on ? GRADIENT : "hover:bg-kosh-surface/60",
              )}
            >
              {on && <div aria-hidden className="absolute -right-6 -top-6 size-24 rounded-full bg-[#2DD4BF]/20 blur-xl" />}
              <span className={cn("relative font-display text-xl font-semibold sm:text-2xl", on ? "text-white" : "text-kosh-muted")}>{f.title}</span>
              <span className={cn("relative mt-1.5 block max-w-md text-[15px] leading-relaxed", on ? "text-white/70" : "text-kosh-muted", !on && "hidden lg:block lg:opacity-0 lg:h-0 lg:mt-0 lg:overflow-hidden")}>
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
        <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-[#6BA6E0]/30 blur-3xl" />
        <div aria-hidden className="absolute -bottom-28 -left-16 size-72 rounded-full bg-[#2DD4BF]/20 blur-3xl" />
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A] shadow-2xl">
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
