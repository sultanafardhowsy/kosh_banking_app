import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about Kosh accounts, transfers, cards and loans.",
};

const FAQS = [
  {
    id: "simulation",
    question: "Is Kosh a real bank?",
    answer: "No. Kosh is an assessment project with simulated accounts, cards and money. No real financial services or card networks are connected.",
  },
  {
    id: "accounts",
    question: "How do I open an account?",
    answer: "Register for a customer profile, complete your KYC details and ask a Kosh staff member to open an account. Staff must verify and approve the account workflow.",
  },
  {
    id: "transfers",
    question: "Why did a transfer fail?",
    answer: "Transfers can fail when the account balance is too low, a daily or single-transfer limit is exceeded, the PIN is incorrect or the account is frozen or inactive.",
  },
  {
    id: "pins",
    question: "What happens after incorrect PIN attempts?",
    answer: "Five incorrect PIN attempts lock the account PIN for 15 minutes. The lock resets automatically after the cooldown period.",
  },
  {
    id: "cards",
    question: "Can I freeze or set limits on a virtual card?",
    answer: "Yes. Active cards can be frozen or unfrozen, and customers can request a daily spending limit. The limit is checked by the server before each card payment.",
  },
  {
    id: "loans",
    question: "How are loans approved?",
    answer: "Customers submit a loan request through the app. Eligible requests require staff review and a second admin decision before the loan is approved.",
  },
  {
    id: "mistakes",
    question: "Can a transaction be corrected?",
    answer: "The system does not rewrite the original transaction. Approved reversals create a matching opposite transaction, keeping the original entry in the history.",
  },
  {
    id: "data",
    question: "What information should I enter?",
    answer: "Use demo names and details only. Do not enter real passwords, PINs, identity numbers or financial information in this simulated environment.",
  },
] as const;

export default function FAQPage() {
  return (
    <div className="min-h-dvh bg-kosh-bg">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium hover:bg-kosh-subtle">
            <ArrowLeft className="size-4" /> Home
          </Link>
        </div>
      </header>

      <main className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-kosh-accent">Help center</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">Frequently asked questions</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-kosh-muted">
            Quick answers about accounts, transfers, cards, loans and the Kosh demo.
          </p>

          <div className="mt-10 divide-y divide-kosh-border rounded-[24px] border border-kosh-border bg-kosh-surface px-5 sm:px-6">
            {FAQS.map((faq) => (
              <details id={faq.id} key={faq.id} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  <span>{faq.question}</span>
                  <ChevronDown className="size-5 shrink-0 text-kosh-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 max-w-2xl pr-8 text-sm leading-relaxed text-kosh-muted">{faq.answer}</p>
              </details>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-[24px] bg-kosh-navy p-6 text-kosh-navy-fg sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold">Still need help?</h2>
              <p className="mt-1 text-sm text-white/70">See the available support options for this demo.</p>
            </div>
            <Link href="/contact" className="rounded-full bg-kosh-brand-accent px-5 py-2.5 text-sm font-semibold text-kosh-brand-accent-fg">
              Contact Kosh
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
