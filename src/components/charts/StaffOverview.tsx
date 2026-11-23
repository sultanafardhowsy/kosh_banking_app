"use client";

import Link from "next/link";
import { Activity, Flag, HandCoins, ListChecks, ShieldAlert } from "lucide-react";
import { useGetStaffOverviewQuery } from "@/store/api/staffApi";
import { useAppSelector } from "@/store/hooks";
import { selectUser } from "@/store/slices/authSlice";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { loanLabel } from "@/components/loans/LoanBits";
import { formatDate, titleCase } from "@/lib/format";

/** Staff home: "limited" analytics — today's numbers + the oldest items in each queue. */
export function StaffOverview() {
  const user = useAppSelector(selectUser);
  const { data, isLoading } = useGetStaffOverviewQuery(undefined, { pollingInterval: 60_000 });
  const k = data?.kpis;

  const tiles = k
    ? [
        { href: "/staff/requests", icon: ListChecks, label: "Requests to review", n: k.pendingRequests },
        { href: "/staff/loans", icon: HandCoins, label: "New loan applications", n: k.loansPending },
        { href: "/staff/customers", icon: ShieldAlert, label: "Customers awaiting KYC", n: k.unverified },
        { href: "/staff/transactions", icon: Activity, label: "Transactions today", n: k.txnsToday },
        { href: "/staff/transactions", icon: Flag, label: "Open fraud flags", n: k.openFlags },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-kosh-muted">Today&apos;s work</p>
        <h1 className="text-2xl font-semibold sm:text-[28px]">Welcome back, {user?.name.split(" ")[0]}</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {isLoading
          ? [0, 1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)
          : tiles.map(({ href, icon: Icon, label, n }) => (
              <Link key={label} href={href} className="rounded-[20px] border border-kosh-border bg-kosh-surface p-5 transition-colors hover:border-kosh-info/50">
                <span className="grid size-9 place-items-center rounded-xl bg-kosh-subtle"><Icon className="size-4" /></span>
                <p className="amount mt-4 text-3xl font-semibold">{n}</p>
                <p className="mt-1 text-sm text-kosh-muted">{label}</p>
              </Link>
            ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Oldest requests" action={<Link href="/staff/requests" className="text-sm font-medium text-kosh-info">Open queue</Link>} />
          {isLoading ? <TableSkeleton rows={3} /> : !data?.requests.length ? <EmptyState title="Queue is clear" /> : (
            <ul className="mt-3 divide-y divide-kosh-border text-sm">
              {data.requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-6 py-3">
                  <span>{r.requestedBy.name} <span className="text-xs text-kosh-muted">· {titleCase(r.type)} · {formatDate(r.createdAt)}</span></span>
                  <Money value={r.amount} className="font-medium" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <PanelHeader title="New loan applications" action={<Link href="/staff/loans" className="text-sm font-medium text-kosh-info">Review</Link>} />
          {isLoading ? <TableSkeleton rows={3} /> : !data?.loans.length ? <EmptyState title="No new applications" /> : (
            <ul className="mt-3 divide-y divide-kosh-border text-sm">
              {data.loans.map((l) => (
                <li key={l.id}>
                  <Link href={`/staff/loans/${l.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-kosh-subtle">
                    <span>{l.user.name} <span className="text-xs text-kosh-muted">· {loanLabel(l.loanType)}</span></span>
                    <Money value={l.principal} className="font-medium" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <PanelHeader title="Awaiting KYC" action={<Link href="/staff/customers" className="text-sm font-medium text-kosh-info">All customers</Link>} />
          {isLoading ? <TableSkeleton rows={3} /> : !data?.customers.length ? <EmptyState title="Everyone is verified" /> : (
            <ul className="mt-3 divide-y divide-kosh-border text-sm">
              {data.customers.map((c) => (
                <li key={c.id}>
                  <Link href={`/staff/customers/${c.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-kosh-subtle">
                    <span>{c.name}<span className="block text-xs text-kosh-muted">{c.email}</span></span>
                    <span className="text-xs text-kosh-muted">since {formatDate(c.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
