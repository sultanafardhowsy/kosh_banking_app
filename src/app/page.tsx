import Link from "next/link";
import { BadgeCheck, CalendarClock, KeyRound, ScrollText, Snowflake, Gauge, ShieldCheck, Users } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { NoticeBar } from "@/components/landing/NoticeBar";
import { FeatureSwitcher } from "@/components/landing/FeatureSwitcher";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/demo-accounts";
import { LOAN_PRODUCTS } from "@/lib/loan-products";
import { formatBps, formatMoney } from "@/lib/money";
import { getSettings } from "@/server/services/settings.service";

// Limits and fees below are read live from BankSettings — the page always matches what the app enforces.
export const dynamic = "force-dynamic";

const GRADIENT = "bg-[linear-gradient(135deg,#2A1FB8_0%,#3557F5_48%,#1FB5C4_100%)]";

function GlassCard({ number, holder, expiry, className, tone = "a" }: { number: string; holder: string; expiry: string; className?: string; tone?: "a" | "b" }) {
  return (
    <div
      className={`absolute aspect-[1.586] w-[280px] overflow-hidden rounded-[22px] border border-white/30 p-5 text-white shadow-[0_30px_60px_-25px_rgba(10,15,30,0.6)] backdrop-blur-md sm:w-[340px] ${
        tone === "a" ? "bg-white/15" : "bg-[#0B1533]/35"
      } ${className ?? ""}`}
    >
      <div aria-hidden className="absolute -right-12 -top-12 size-40 rounded-full bg-[#5EEAD4]/35 blur-2xl" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-semibold">Kosh</span>
          <svg viewBox="0 0 40 30" className="h-6 w-8" aria-hidden>
            <rect x="1" y="1" width="38" height="28" rx="6" fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.6)" />
            <path d="M14 1v28M26 1v28M1 11h13M26 11h13M1 19h13M26 19h13" stroke="rgba(255,255,255,0.5)" />
          </svg>
        </div>
        <p className="amount text-lg tracking-[0.14em] sm:text-xl">{number}</p>
        <div className="flex items-end justify-between text-xs">
          <div>
            <p className="text-[10px] text-white/60">Card holder</p>
            <p className="font-medium">{holder}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/60">Expires</p>
            <p className="amount font-medium">{expiry}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const s = await getSettings();
  const plans = [
    { name: "Savings", who: "For everyday money and putting some aside.", points: ["Free to open", "Virtual card on request", "Statements in PDF and CSV"] },
    { name: "Current", who: "For salaries, bills and frequent transfers.", points: ["Instant transfers to any Kosh account", "Per-account limits on request", "Freeze anytime"] },
    { name: "Business", who: "For shops and small companies.", points: ["Supplier and staff payments", "Business loans from 13.5%", "Full ledger exports"] },
  ];

  return (
    <div className="min-h-dvh bg-kosh-bg">
      <NoticeBar />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-7 text-sm font-medium text-kosh-muted md:flex">
          <a href="#features" className="hover:text-kosh-text">Features</a>
          <a href="#cards" className="hover:text-kosh-text">Cards</a>
          <a href="#accounts" className="hover:text-kosh-text">Accounts</a>
          <a href="#security" className="hover:text-kosh-text">Security</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium hover:bg-kosh-subtle">Log in</Link>
          <Link href="/register" className="hidden rounded-full bg-kosh-navy px-4 py-2 text-sm font-medium text-kosh-navy-fg hover:opacity-90 sm:inline-flex">Open account</Link>
        </div>
      </header>

      <main>
        {/* Hero — the one bold moment */}
        <section className="px-3 sm:px-6">
          <div className={`relative mx-auto max-w-7xl overflow-hidden rounded-[32px] ${GRADIENT} px-6 pb-14 pt-14 text-white sm:px-12 sm:pt-20 lg:pb-24`}>
            <div aria-hidden className="absolute -bottom-32 -left-28 size-72 rounded-full border-[18px] border-[#5EEAD4]/40" />
            <div aria-hidden className="absolute -right-32 bottom-[-180px] size-[520px] rounded-full bg-[#22D3C5]/30 blur-2xl" />
            <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
              <div className="max-w-xl">
                <h1 className="text-[44px] font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">Every paisa, accounted for.</h1>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-white/80">
                  Accounts, transfers, loans and virtual cards on one ledger. Every transfer is checked on the server and recorded on both sides, or not at all.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <Link href="/login" className="inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#2A1FB8] shadow-lg hover:bg-white/90">Try the demo</Link>
                  <Link href="/register" className="inline-flex items-center rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">Open an account</Link>
                </div>
              </div>

              <div className="relative mx-auto h-[360px] w-full max-w-[460px] sm:h-[420px]">
                <div className="hero-float">
                  <GlassCard number="4000 •••• •••• 2792" holder="NUSRAT JAHAN" expiry="11/29" className="left-0 top-4 -rotate-[8deg] sm:left-2" />
                  <GlassCard number="5100 •••• •••• 7838" holder="RAFIUL KARIM" expiry="09/28" tone="b" className="bottom-14 right-0 rotate-[6deg] sm:bottom-10" />
                </div>
                {/* The receipt chip: the product's promise in one glance */}
                <div className="absolute bottom-0 left-2 w-[250px] rounded-2xl bg-white p-4 text-[#0B1533] shadow-[0_25px_50px_-20px_rgba(10,15,30,0.55)] sm:left-6 sm:w-[270px]">
                  <p className="text-sm font-semibold">Sent ৳2,500 to Rafiul K.</p>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-[#5B6478]">Your savings, debit</span><span className="amount">−৳2,511.25</span></div>
                    <div className="flex justify-between"><span className="text-[#5B6478]">Rafiul&apos;s savings, credit</span><span className="amount text-[#0B7A52]">+৳2,500.00</span></div>
                    <div className="flex justify-between border-t border-[#E4E7EF] pt-1.5"><span className="text-[#5B6478]">Transfer fee</span><span className="amount">৳11.25</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Demo logins — useful, not decorative */}
        <section aria-labelledby="demo-heading" className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <div className="flex flex-col gap-6 rounded-[24px] border border-kosh-border bg-kosh-surface p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 id="demo-heading" className="text-xl font-semibold">Try it from three sides</h2>
              <p className="mt-1 text-sm text-kosh-muted">
                Every demo login uses the password <code className="rounded bg-kosh-subtle px-1.5 py-0.5 font-mono text-kosh-text">{DEMO_PASSWORD}</code> and the transaction PIN <code className="rounded bg-kosh-subtle px-1.5 py-0.5 font-mono text-kosh-text">1234</code>.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3">
              {DEMO_USERS.map((u) => (
                <li key={u.email} className="rounded-2xl bg-kosh-subtle px-4 py-3">
                  <p className="text-sm font-semibold">{u.label}</p>
                  <p className="text-xs text-kosh-muted">{u.email}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section id="features" aria-labelledby="features-heading" className="mx-auto max-w-7xl scroll-mt-8 px-5 py-16 sm:px-8 lg:py-24">
          <h2 id="features-heading" className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">Everything you do with money. All in one place.</h2>
          <div className="mt-12">
            <FeatureSwitcher />
          </div>
        </section>

        {/* Cards — dark section */}
        <section id="cards" aria-labelledby="cards-heading" className="scroll-mt-8 bg-[#0A0F1E] px-5 py-20 text-white sm:px-8 lg:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
            <div className="relative mx-auto h-[320px] w-full max-w-[460px]">
              <div className={`absolute left-6 top-0 aspect-[1.586] w-[300px] -rotate-[10deg] rounded-[22px] ${GRADIENT} opacity-70 sm:w-[340px]`} aria-hidden />
              <div className="absolute left-14 top-10 aspect-[1.586] w-[300px] -rotate-[3deg] rounded-[22px] bg-[linear-gradient(135deg,#1A2A5E,#3557F5)] opacity-90 sm:w-[340px]" aria-hidden />
              <GlassCard number="4000 •••• •••• 4417" holder="AYESHA SIDDIQUA" expiry="03/29" className="left-20 top-20 rotate-[4deg]" />
            </div>
            <div className="max-w-lg">
              <h2 id="cards-heading" className="text-4xl font-semibold leading-tight sm:text-5xl">A card for every account.</h2>
              <p className="mt-5 text-lg leading-relaxed text-white/70">Virtual debit cards that spend straight from the account they belong to, with the same PIN and limits as a transfer.</p>
              <ul className="mt-8 space-y-5">
                {[
                  { icon: Snowflake, t: "Freeze it in a tap", d: "Lost your phone? Freeze the card from the app and unfreeze it when you're ready." },
                  { icon: Gauge, t: "Your own daily limit", d: "Set how much the card can spend in a day, up to the bank's limit." },
                  { icon: KeyRound, t: "PIN on every payment", d: "Five wrong attempts lock the account's PIN for fifteen minutes." },
                ].map(({ icon: Icon, t, d }) => (
                  <li key={t} className="flex gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10"><Icon className="size-5 text-[#8EB1FF]" /></span>
                    <span>
                      <span className="block font-semibold">{t}</span>
                      <span className="mt-0.5 block text-sm leading-relaxed text-white/65">{d}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-xs text-white/45">Cards are simulated. Numbers are random test values and can&apos;t be used anywhere outside Kosh.</p>
            </div>
          </div>
        </section>

        {/* Accounts + live limits */}
        <section id="accounts" aria-labelledby="accounts-heading" className="mx-auto max-w-7xl scroll-mt-8 px-5 py-20 sm:px-8 lg:py-28">
          <h2 id="accounts-heading" className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">Pick the account that fits.</h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <article key={p.name} className="flex flex-col rounded-[24px] border border-kosh-border bg-kosh-surface p-6">
                <h3 className="text-2xl font-semibold">{p.name}</h3>
                <p className="mt-2 text-sm text-kosh-muted">{p.who}</p>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex gap-2.5"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-kosh-info" />{pt}</li>
                  ))}
                </ul>
              </article>
            ))}
            <article className="flex flex-col rounded-[24px] bg-kosh-navy p-6 text-white md:col-span-3 lg:flex-row lg:items-center lg:gap-12">
              <div className="lg:w-64">
                <h3 className="text-2xl font-semibold">Limits and fees today</h3>
                <p className="mt-2 text-sm text-white/65">Read live from the bank&apos;s settings, the same values every transfer is checked against.</p>
              </div>
              <dl className="mt-6 grid flex-1 grid-cols-2 gap-x-6 gap-y-5 text-sm lg:mt-0 lg:grid-cols-4">
                {[
                  ["Daily transfer limit", formatMoney(s.dailyTransferLimit, { decimals: false })],
                  ["Largest single transfer", formatMoney(s.maxSingleTransaction, { decimals: false })],
                  ["Minimum balance", formatMoney(s.minimumBalance, { decimals: false })],
                  ["Transfer fee", `${formatMoney(s.transferFeeFlat, { decimals: false })} + ${formatBps(s.transferFeePercentBps)}${s.transferFeeMax ? `, max ${formatMoney(s.transferFeeMax, { decimals: false })}` : ""}`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-white/60">{k}</dt>
                    <dd className="amount mt-1 text-lg font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </div>
          <div className="mt-6 rounded-[24px] border border-kosh-border bg-kosh-surface p-6">
            <h3 className="text-lg font-semibold">Loans with fixed rates</h3>
            <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
              {Object.values(LOAN_PRODUCTS).map((l) => (
                <li key={l.label} className="rounded-2xl bg-kosh-subtle px-4 py-3">
                  <p className="font-semibold">{l.label}</p>
                  <p className="text-kosh-muted">{formatBps(l.rateBps)} a year, up to {l.maxMonths} months</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Security */}
        <section id="security" aria-labelledby="security-heading" className="scroll-mt-8 bg-kosh-surface px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <h2 id="security-heading" className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">Your money&apos;s safe space.</h2>
            <p className="mt-4 max-w-xl text-lg text-kosh-muted">What happens behind the button, in plain words.</p>
            <ul className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-2">
              {[
                { icon: ShieldCheck, t: "Both sides or neither", d: "A transfer locks both accounts, checks your balance, limits and PIN, then writes the debit and credit together. If anything fails, nothing moves." },
                { icon: Users, t: "Two people for every approval", d: "Deposits, withdrawals and loans are approved by bank staff, never by the person who asked. Loans need a second, admin decision." },
                { icon: CalendarClock, t: "Nothing is rewritten", d: "Mistakes are fixed with a new, opposite transaction. The original stays in your history, marked as reversed." },
                { icon: ScrollText, t: "Every staff action is logged", d: "Freezing an account, approving a loan or changing a fee leaves an audit entry with who did it and why." },
              ].map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-kosh-subtle"><Icon className="size-5 text-kosh-info" /></span>
                  <span>
                    <span className="block text-lg font-semibold">{t}</span>
                    <span className="mt-1 block max-w-md leading-relaxed text-kosh-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="px-3 py-16 sm:px-6 lg:py-24">
          <div className={`relative mx-auto max-w-7xl overflow-hidden rounded-[32px] ${GRADIENT} px-6 py-16 text-center text-white sm:px-12`}>
            <div aria-hidden className="absolute -right-20 -top-24 size-72 rounded-full border-[16px] border-[#5EEAD4]/35" />
            <h2 className="relative mx-auto max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">See it for yourself in under a minute.</h2>
            <p className="relative mx-auto mt-4 max-w-md text-white/80">Sign in as a customer, send money, then switch to staff and approve it.</p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/login" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#2A1FB8] hover:bg-white/90">Try the demo</Link>
              <Link href="/register" className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold hover:bg-white/10">Open an account</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-kosh-navy px-5 py-12 text-white/70 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <span className="flex items-center gap-2.5 text-white">
              <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
                <rect width="32" height="32" rx="9" fill="#1A2A5E" />
                <path d="M11 8v16" stroke="#2F6BFF" strokeWidth="3.2" strokeLinecap="round" />
                <path d="M21.5 9.5 13.5 17l8.5 7" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <span className="font-display text-xl font-semibold">Kosh</span>
            </span>
            <p className="mt-4 text-sm leading-relaxed">Simulated bank, no real money. Built with Next.js, Redux Toolkit, Prisma and PostgreSQL as an assessment project.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
            <Link href="/login" className="hover:text-white">Log in</Link>
            <Link href="/register" className="hover:text-white">Open account</Link>
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#security" className="hover:text-white">Security</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
