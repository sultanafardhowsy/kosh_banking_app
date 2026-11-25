import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock3, Landmark, MessageCircle, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get help with accounts, cards, loans and simulated banking support.",
};

const SUPPORT_OPTIONS = [
  {
    icon: Landmark,
    title: "Account support",
    description: "For account status, KYC verification, statements and PIN help.",
    action: "Sign in to your account",
    href: "/login",
  },
  {
    icon: MessageCircle,
    title: "Questions and feedback",
    description: "Review the FAQ first for answers about transfers, cards and loans.",
    action: "Browse FAQs",
    href: "/faq",
  },
  {
    icon: ShieldCheck,
    title: "Demo project notice",
    description: "Kosh is a simulated bank. Do not send real financial or identity information.",
    action: "View FAQ",
    href: "/faq#simulation",
  },
] as const;

export default function ContactPage() {
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

      <main>
        <section className="px-5 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-kosh-accent">Kosh support</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">How can we help?</h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-kosh-muted">
                Find guidance for your demo account or learn where to get help for account, card and loan issues.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {SUPPORT_OPTIONS.map(({ icon: Icon, title, description, action, href }) => (
                <article key={title} className="rounded-[24px] border border-kosh-border bg-kosh-surface p-6">
                  <span className="grid size-11 place-items-center rounded-2xl bg-kosh-subtle text-kosh-primary">
                    <Icon className="size-5" />
                  </span>
                  <h2 className="mt-5 text-lg font-semibold">{title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-kosh-muted">{description}</p>
                  <Link href={href} className="mt-5 inline-flex text-sm font-semibold text-kosh-primary hover:underline">
                    {action}
                  </Link>
                </article>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="rounded-[24px] bg-kosh-navy p-6 text-kosh-navy-fg">
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10">
                    <Clock3 className="size-5 text-kosh-brand-accent" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold">Support availability</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
                      Staff actions in this assessment app are simulated. Account changes, approvals and reversals are handled through the in-app staff and admin workflows.
                    </p>
                  </div>
                </div>
              </div>
              <Link
                href="/faq"
                className="inline-flex items-center justify-center rounded-[24px] bg-kosh-accent px-6 py-5 text-sm font-semibold text-kosh-accent-fg hover:brightness-105"
              >
                Open FAQ
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
