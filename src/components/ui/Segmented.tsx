"use client";

import { cn } from "@/lib/format";

/** Pill segmented control (status filters, deposit/withdraw toggle). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex flex-wrap gap-1 rounded-2xl bg-kosh-subtle p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-kosh-info",
              active ? "bg-kosh-surface text-kosh-text shadow-sm" : "text-kosh-muted hover:text-kosh-text",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("rounded-full px-1.5 text-[11px]", active ? "bg-kosh-navy text-kosh-navy-fg" : "bg-kosh-border")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
