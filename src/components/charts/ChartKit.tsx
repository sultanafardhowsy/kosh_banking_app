"use client";

import { useState, type ReactNode } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { SkeletonBlock } from "@/components/ui/Skeletons";
import { cn } from "@/lib/format";
import { formatMoney, toBigInt } from "@/lib/money";

/**
 * Shared chart pieces. Rules (dataviz skill): fixed categorical order, one axis,
 * thin marks, recessive grid, legend for ≥2 series, text never in series colour,
 * every chart has a table view (relief for the low-contrast aqua slot).
 */
export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)"] as const;

export type TableSpec = { columns: string[]; rows: (string | number)[][] };

export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  isLoading,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: { label: string; color: string }[];
  table: TableSpec;
  isLoading?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Panel className={cn("flex flex-col p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-kosh-muted">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          aria-label={asTable ? `Show ${title} as a chart` : `Show ${title} as a table`}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-kosh-muted hover:bg-kosh-subtle hover:text-kosh-text"
        >
          {asTable ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
        </button>
      </div>
      {legend && legend.length > 1 && !asTable && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-kosh-muted" aria-label="Legend">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: l.color }} aria-hidden />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 min-h-0 flex-1">
        {isLoading ? (
          <SkeletonBlock className="h-56" />
        ) : asTable ? (
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kosh-border text-left text-xs text-kosh-muted">
                  {table.columns.map((c, i) => (
                    <th key={c} className={cn("py-2 pr-3 font-medium", i > 0 && "text-right")}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-kosh-border last:border-0">
                    {r.map((v, j) => (
                      <td key={j} className={cn("py-2 pr-3", j > 0 && "amount text-right")}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </Panel>
  );
}

/** "2026-07" → "Jul" (or "Jul 26" when long) */
export function monthLabel(key: string, withYear = false) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1, 1));
  return d.toLocaleDateString("en-GB", { month: "short", ...(withYear ? { year: "2-digit" } : {}), timeZone: "UTC" });
}

/** paisa string → taka number (display only — charts never do money maths). */
export const takaNum = (p: string) => Number(toBigInt(p) / BigInt(100));

/** compact axis tick: 0 / 25K / 1.2L / 3Cr */
export function compactTaka(n: number) {
  if (n >= 1e7) return `${+(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `${+(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(0)}K`;
  return String(n);
}

/** Recharts tooltip in Kosh style; values formatted as ৳ or counts. */
export function KoshTooltip({
  active,
  payload,
  label,
  money = true,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string | number; type?: string }[];
  label?: string;
  money?: boolean;
}) {
  if (!active || !payload?.length) return null;
  // A series can be drawn twice (a soft area fill under its line). Recharts still hands the
  // hidden copy (tooltipType="none") to custom tooltips, so skip it and keep one row per series.
  const seen = new Set<string>();
  const rows = payload.filter((p) => {
    const key = String(p.dataKey ?? p.name);
    if (p.type === "none" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    <div className="rounded-xl border border-kosh-border bg-kosh-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-kosh-text">{label}</p>
      {rows.map((p) => (
        <p key={String(p.dataKey ?? p.name)} className="flex items-center gap-2 text-kosh-muted">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {p.name}
          <span className="amount ml-auto pl-3 font-medium text-kosh-text">
            {money ? formatMoney(BigInt(Math.round((p.value ?? 0) * 100)), { decimals: false }) : (p.value ?? 0).toLocaleString("en-IN")}
          </span>
        </p>
      ))}
    </div>
  );
}

export const axisProps = {
  stroke: "var(--kosh-muted)",
  tick: { fill: "var(--kosh-muted)", fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

/** Horizontal bar list (meter-list form): name · bar · value. HTML, so labels never clip. */
export function BarList({
  rows,
  color = SERIES[0],
  format,
}: {
  rows: { label: string; value: number; hint?: string }[];
  color?: string;
  format: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="group" title={`${r.label}: ${format(r.value)}${r.hint ? ` · ${r.hint}` : ""}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{r.label}</span>
            <span className="amount font-medium">
              {format(r.value)}
              {r.hint && <span className="ml-1.5 text-xs font-normal text-kosh-muted">{r.hint}</span>}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 rounded-full bg-kosh-subtle">
            <div
              className="h-full rounded-full transition-[width,opacity] group-hover:opacity-80"
              style={{ width: `${r.value === 0 ? 0 : Math.max(2, (r.value / max) * 100)}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tall segmented bar — one whole split into ≤ 6 parts (replaces a donut). */
export function SegmentedBar({ parts, format }: { parts: { label: string; value: number; detail?: string }[]; format: (v: number) => string }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-7 gap-[2px] overflow-hidden" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(", ")}>
        {parts.map((p, i) =>
          p.value === 0 ? null : (
            <div
              key={p.label}
              title={`${p.label}: ${format(p.value)} (${Math.round((p.value / total) * 100)}%)`}
              className="flex items-center rounded-[4px] px-2 text-xs font-semibold text-white"
              style={{ width: `${(p.value / total) * 100}%`, background: SERIES[i % SERIES.length] }}
            >
              {p.value / total > 0.12 && `${Math.round((p.value / total) * 100)}%`}
            </div>
          ),
        )}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-[3px]" style={{ background: SERIES[i % SERIES.length] }} aria-hidden />
            <span>{p.label}</span>
            <span className="ml-auto amount font-medium">{format(p.value)}</span>
            {p.detail && <span className="w-24 text-right text-xs text-kosh-muted">{p.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const moneyFmt = (taka: number) => formatMoney(BigInt(Math.round(taka * 100)), { decimals: false });
