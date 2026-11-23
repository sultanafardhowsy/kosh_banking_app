"use client";

import Link from "next/link";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, Flag, HandCoins, Landmark, ListChecks, Users, Wallet } from "lucide-react";
import { useGetAdminStatsQuery } from "@/store/api/adminApi";
import { useAppSelector } from "@/store/hooks";
import { selectUser } from "@/store/slices/authSlice";
import { StatCard } from "@/components/ui/StatCard";
import { StatCardSkeleton } from "@/components/ui/Skeletons";
import { formatMoneyShort } from "@/components/manage/format-helpers";
import { titleCase } from "@/lib/format";
import { axisProps, BarList, ChartCard, compactTaka, KoshTooltip, moneyFmt, monthLabel, SegmentedBar, SERIES, takaNum } from "./ChartKit";

export function AdminOverview() {
  const user = useAppSelector(selectUser);
  const { data, isLoading } = useGetAdminStatsQuery(undefined, { pollingInterval: 60_000 });
  const k = data?.kpis;

  const monthly = (data?.monthly ?? []).map((m) => ({
    month: monthLabel(m.month),
    volume: takaNum(m.totalVolume),
    transfers: takaNum(m.transferVolume),
    deposits: takaNum(m.deposits),
    withdrawals: takaNum(m.withdrawals),
    transferCount: m.transferCount,
    depositCount: m.depositCount,
    withdrawalCount: m.withdrawalCount,
    count: m.totalCount,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-kosh-muted">Bank-wide overview</p>
        <h1 className="text-2xl font-semibold sm:text-[28px]">Welcome back, {user?.name.split(" ")[0]}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !k ? (
          [0, 1, 2, 3].map((i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Customer deposits" value={formatMoneyShort(k.totalDeposits)} icon={<Wallet />} hint={`${k.accounts} open accounts`} />
            <StatCard label="Volume this month" value={formatMoneyShort(k.monthVolume)} icon={<Activity />} trend={k.monthVolumeTrend} hint="vs last month, to date" />
            <StatCard label="Active customers" value={k.activeCustomers.toLocaleString("en-IN")} icon={<Users />} hint={`+${k.newCustomers30d} in 30 days`} />
            <StatCard label="Loan book" value={formatMoneyShort(k.loanBook)} icon={<Landmark />} hint={`${k.overdueInstallments} overdue EMI${k.overdueInstallments === 1 ? "" : "s"}`} />
          </>
        )}
      </div>

      {k && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { href: "/admin/requests", icon: ListChecks, label: "Pending requests", n: k.pendingRequests },
            { href: "/admin/loans", icon: HandCoins, label: "Loans awaiting decision", n: k.loansAwaiting },
            { href: "/admin/flagged", icon: Flag, label: "Open fraud flags", n: k.openFlags },
          ].map(({ href, icon: Icon, label, n }) => (
            <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl border border-kosh-border bg-kosh-surface px-4 py-3 text-sm hover:border-kosh-info/50">
              <span className="grid size-9 place-items-center rounded-xl bg-kosh-subtle"><Icon className="size-4" /></span>
              <span className="flex-1">{label}</span>
              <span className="amount text-lg font-semibold">{n}</span>
              {n > 0 && label.includes("flags") && <AlertTriangle className="size-4 text-[var(--kosh-pending-fg)]" aria-label="Needs attention" />}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Monthly transaction volume"
          subtitle="All completed transactions, ৳"
          isLoading={isLoading}
          table={{ columns: ["Month", "Volume", "Transactions"], rows: monthly.map((m) => [m.month, moneyFmt(m.volume), m.count]) }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={compactTaka} width={48} />
              <Tooltip content={<KoshTooltip />} cursor={{ fill: "var(--kosh-subtle)" }} />
              <Bar dataKey="volume" name="Volume" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Deposits vs withdrawals"
          subtitle="Approved cash requests, ৳"
          isLoading={isLoading}
          legend={[{ label: "Deposits", color: SERIES[0] }, { label: "Withdrawals", color: SERIES[1] }]}
          table={{ columns: ["Month", "Deposits", "Withdrawals"], rows: monthly.map((m) => [m.month, moneyFmt(m.deposits), moneyFmt(m.withdrawals)]) }}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={compactTaka} width={48} />
              <Tooltip content={<KoshTooltip />} cursor={{ fill: "var(--kosh-subtle)" }} />
              <Bar dataKey="deposits" name="Deposits" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar dataKey="withdrawals" name="Withdrawals" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Monthly banking activity"
          subtitle="Number of transactions by kind"
          isLoading={isLoading}
          className="xl:col-span-2"
          legend={[{ label: "Transfers", color: SERIES[0] }, { label: "Withdrawals", color: SERIES[1] }, { label: "Deposits", color: SERIES[2] }]}
          table={{ columns: ["Month", "Transfers", "Withdrawals", "Deposits"], rows: monthly.map((m) => [m.month, m.transferCount, m.withdrawalCount, m.depositCount]) }}
        >
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} width={36} allowDecimals={false} />
              <Tooltip content={<KoshTooltip money={false} />} cursor={{ stroke: "var(--kosh-border)" }} />
              <Area type="monotone" dataKey="transferCount" name="Transfers" stroke="none" fill={SERIES[0]} fillOpacity={0.1} legendType="none" tooltipType="none" />
              <Line type="monotone" dataKey="transferCount" name="Transfers" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--kosh-surface)", fill: SERIES[0] }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="withdrawalCount" name="Withdrawals" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--kosh-surface)", fill: SERIES[1] }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="depositCount" name="Deposits" stroke={SERIES[2]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--kosh-surface)", fill: SERIES[2] }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Account distribution"
          subtitle="Share of customer balances by account type"
          isLoading={isLoading}
          table={{ columns: ["Type", "Accounts", "Balance"], rows: (data?.accountDistribution ?? []).map((a) => [titleCase(a.type), a.count, moneyFmt(takaNum(a.balance))]) }}
        >
          <SegmentedBar
            format={moneyFmt}
            parts={(data?.accountDistribution ?? []).map((a) => ({ label: titleCase(a.type), value: takaNum(a.balance), detail: `${a.count} account${a.count === 1 ? "" : "s"}` }))}
          />
        </ChartCard>

        <ChartCard
          title="Loan approval statistics"
          subtitle="Applications by status"
          isLoading={isLoading}
          table={{ columns: ["Status", "Loans", "Principal"], rows: (data?.loanStats ?? []).map((l) => [titleCase(l.status), l.count, moneyFmt(takaNum(l.principal))]) }}
        >
          <BarList
            format={(v) => String(v)}
            rows={(data?.loanStats ?? []).map((l) => ({ label: l.status === "UNDER_REVIEW" ? "Under review" : titleCase(l.status), value: l.count, hint: formatMoneyShort(l.principal) }))}
          />
        </ChartCard>
      </div>
    </div>
  );
}
