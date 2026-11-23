import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/format";
import { Panel } from "./Panel";

export function StatCard({
  label,
  value,
  icon,
  trend,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** percentage change vs previous period, e.g. 12.4 or -3 */
  trend?: number;
  hint?: string;
  className?: string;
}) {
  const up = (trend ?? 0) >= 0;
  return (
    <Panel className={cn("p-5", className)} as="div">
      <div className="flex items-center justify-between">
        <p className="text-sm text-kosh-muted">{label}</p>
        {icon && (
          <span className="grid size-9 place-items-center rounded-xl bg-kosh-subtle text-kosh-text [&_svg]:size-4">
            {icon}
          </span>
        )}
      </div>
      <p className="amount mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        {trend !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              up ? "text-kosh-money-in" : "text-[var(--kosh-danger-fg)]",
            )}
          >
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-kosh-muted">{hint}</span>}
      </div>
    </Panel>
  );
}
