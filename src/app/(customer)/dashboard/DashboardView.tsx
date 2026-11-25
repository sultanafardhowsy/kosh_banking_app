"use client";

import Link from "next/link";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, HandCoins, Plus } from "lucide-react";
import { useGetMeQuery } from "@/store/api/meApi";
import { useAppSelector } from "@/store/hooks";
import { selectSelectedAccountId } from "@/store/slices/accountSlice";
import { selectUser } from "@/store/slices/authSlice";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonBlock, TableSkeleton } from "@/components/ui/Skeletons";
import { TxnRow } from "@/components/banking/TxnRow";
import { CustomerCharts } from "@/components/charts/CustomerCharts";
import { VirtualCard } from "@/components/cards/VirtualCard";
import { useGetMyCardsQuery } from "@/store/api/cardsApi";
import { useGetTransactionsQuery } from "@/store/api/transactionsApi";
import { formatAccountNumber, titleCase } from "@/lib/format";
import { toBigInt } from "@/lib/money";

const QUICK_ACTIONS = [
  { label: "Transfer", href: "/transfer", icon: ArrowLeftRight },
  { label: "Deposit", href: "/requests?type=DEPOSIT", icon: ArrowDownToLine },
  { label: "Withdraw", href: "/requests?type=WITHDRAWAL", icon: ArrowUpFromLine },
  { label: "Loans", href: "/loans", icon: HandCoins },
];

/** Compact virtual-card panel (plan: card visual on the dashboard). */
function CardWidget() {
  const { data, isLoading } = useGetMyCardsQuery();
  const card = data?.cards.find((c) => c.status === "ACTIVE") ?? data?.cards.find((c) => c.status === "FROZEN") ?? data?.cards[0];
  return (
    <Panel className="h-fit min-w-0 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Your card</h2>
        <Link href="/cards" className="text-sm font-medium text-kosh-info hover:underline">Manage</Link>
      </div>
      {isLoading ? (
        <SkeletonBlock className="aspect-[1.586] rounded-2xl" />
      ) : card ? (
        <Link href="/cards" aria-label="Open cards"><VirtualCard card={card} compact /></Link>
      ) : (
        <EmptyState title="No card yet" description="Request a simulated virtual card." action={<Link href="/cards" className="text-sm font-medium text-kosh-info">Get a card</Link>} className="py-6" />
      )}
    </Panel>
  );
}

function RecentActivity({ accountId }: { accountId?: string }) {
  const { data, isLoading } = useGetTransactionsQuery({ accountId, page: 1, pageSize: 6 }, { skip: !accountId });
  return (
    <Panel className="min-w-0">
      <PanelHeader
        title="Recent activity"
        description="Latest transactions on this account."
        action={
          <Link href="/transactions" className="text-sm font-medium text-kosh-info hover:underline">
            See all
          </Link>
        }
      />
      <div className="p-2 sm:p-3">
        {isLoading || !accountId ? (
          <TableSkeleton rows={4} />
        ) : data?.items.length ? (
          data.items.map((t) => <TxnRow key={t.id} t={t} />)
        ) : (
          <EmptyState title="No transactions yet" description="Money you send or receive will show up here." />
        )}
      </div>
    </Panel>
  );
}

export function DashboardView() {
  const user = useAppSelector(selectUser);
  const selectedId = useAppSelector(selectSelectedAccountId);
  const { data, isLoading } = useGetMeQuery();

  const accounts = data?.accounts ?? [];
  const account = accounts.find((a) => a.id === selectedId) ?? accounts[0];
  const total = accounts.reduce((sum, a) => sum + toBigInt(a.balance), BigInt(0));
  const firstName = user?.name.split(" ")[0] ?? "there";

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div>
        <p className="text-sm text-kosh-muted">Good to see you,</p>
        <h1 className="text-2xl font-semibold sm:text-[28px]">{firstName}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Balance card */}
        <section className="relative min-w-0 overflow-hidden rounded-[22px] bg-kosh-navy p-5 text-kosh-navy-fg sm:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-kosh-brand-accent/20 blur-3xl"
          />
          {isLoading ? (
            <div className="space-y-4">
              <SkeletonBlock className="h-4 w-32 bg-white/10" />
              <SkeletonBlock className="h-10 w-56 bg-white/10" />
              <SkeletonBlock className="h-4 w-40 bg-white/10" />
            </div>
          ) : account ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 text-sm text-white/70">
                  {account.nickname ?? `${titleCase(account.type)} account`}
                </p>
                <StatusBadge status={account.status} />
              </div>
              <Money value={account.balance} className="mt-3 block max-w-full truncate text-2xl font-semibold sm:text-5xl" />
              <p className="amount mt-2 text-sm text-white/60">{formatAccountNumber(account.accountNumber)}</p>
              <div className="mt-6 grid grid-cols-2 gap-2 sm:flex">
                <Link
                  href="/transfer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-kosh-brand-accent px-3 text-sm font-semibold text-kosh-brand-accent-fg hover:brightness-110 sm:px-4"
                >
                  <ArrowLeftRight className="size-4" /> Send money
                </Link>
                <Link
                  href="/requests"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-medium hover:bg-white/15 sm:px-4"
                >
                  <Plus className="size-4" /> Add money
                </Link>
              </div>
            </>
          ) : (
            <p className="text-white/80">No accounts yet. A staff member will open one for you.</p>
          )}
        </section>

        {/* Totals + quick actions */}
        <Panel className="flex min-w-0 flex-col p-5 sm:p-6">
          <p className="text-sm text-kosh-muted">Total across {accounts.length} account(s)</p>
          {isLoading ? (
            <SkeletonBlock className="mt-3 h-8 w-40" />
          ) : (
            <Money value={total} className="mt-2 text-3xl font-semibold" />
          )}
          <div className="mt-auto grid grid-cols-2 gap-2 pt-6 sm:grid-cols-4">
            {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="flex flex-col items-center gap-2 rounded-2xl p-2 text-xs font-medium hover:bg-kosh-subtle"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-kosh-subtle text-kosh-text">
                  <Icon className="size-[18px]" />
                </span>
                {label}
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      {/* Accounts list */}
      <Panel>
        <PanelHeader title="Your accounts" description="Switch accounts from the top bar." />
        <ul className="mt-3 divide-y divide-kosh-border">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between px-6 py-4">
                <SkeletonBlock className="h-4 w-40" />
                <SkeletonBlock className="h-4 w-24" />
              </li>
            ))}
          {!isLoading && accounts.length === 0 && (
            <li>
              <EmptyState title="No accounts yet" description="Accounts opened by the bank appear here." />
            </li>
          )}
          {accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.nickname ?? `${titleCase(a.type)} account`}</p>
                <p className="amount text-xs text-kosh-muted">{formatAccountNumber(a.accountNumber)}</p>
              </div>
              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <StatusBadge status={a.status} className="hidden sm:inline-flex" />
                <Money value={a.balance} className="text-sm font-semibold" />
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <CustomerCharts accountId={account?.id} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <RecentActivity accountId={account?.id} />
        <CardWidget />
      </div>
    </div>
  );
}
