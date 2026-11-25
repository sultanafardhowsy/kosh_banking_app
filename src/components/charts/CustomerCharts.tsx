"use client";

import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useGetCustomerStatsQuery } from "@/store/api/statsApi";
import { TXN_TYPE_LABEL } from "@/components/banking/TxnRow";
import { axisProps, BarList, ChartCard, compactTaka, KoshTooltip, moneyFmt, monthLabel, SERIES, takaNum } from "./ChartKit";

/** Customer dashboard charts — Monthly spending, Monthly deposits, Transaction distribution. */
export function CustomerCharts({ accountId }: { accountId?: string }) {
  const { data, isLoading } = useGetCustomerStatsQuery({ accountId }, { skip: !accountId });
  const monthly = (data?.monthly ?? []).map((m) => ({
    month: monthLabel(m.month),
    spending: takaNum(m.spending),
    deposits: takaNum(m.deposits),
  }));
  const loading = isLoading || !accountId;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <ChartCard
        title="Monthly spending"
        subtitle="Money out of this account, incl. fees"
        isLoading={loading}
        table={{ columns: ["Month", "Spent"], rows: monthly.map((m) => [m.month, moneyFmt(m.spending)]) }}
      >
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthly} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={compactTaka} width={44} />
            <Tooltip content={<KoshTooltip />} cursor={{ fill: "var(--kosh-subtle)" }} />
            <Bar dataKey="spending" name="Spent" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Monthly deposits"
        subtitle="Approved cash deposits"
        isLoading={loading}
        table={{ columns: ["Month", "Deposited"], rows: monthly.map((m) => [m.month, moneyFmt(m.deposits)]) }}
      >
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={compactTaka} width={44} />
            <Tooltip content={<KoshTooltip />} cursor={{ stroke: "var(--kosh-border)" }} />
            <Area type="monotone" dataKey="deposits" stroke="none" fill={SERIES[0]} fillOpacity={0.1} tooltipType="none" />
            <Line type="monotone" dataKey="deposits" name="Deposited" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--kosh-surface)", fill: SERIES[0] }} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Transaction mix"
        subtitle="Last 6 months, by count"
        isLoading={loading}
        table={{ columns: ["Type", "Count", "Amount"], rows: (data?.distribution ?? []).map((d) => [TXN_TYPE_LABEL[d.type], d.count, moneyFmt(takaNum(d.amount))]) }}
      >
        {data?.distribution.length ? (
          <BarList format={(v) => String(v)} rows={data.distribution.slice(0, 5).map((d) => ({ label: TXN_TYPE_LABEL[d.type], value: d.count, hint: moneyFmt(takaNum(d.amount)) }))} />
        ) : (
          <p className="text-sm text-kosh-muted">No activity in the last 6 months.</p>
        )}
      </ChartCard>
    </div>
  );
}
