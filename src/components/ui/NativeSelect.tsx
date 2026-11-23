"use client";

import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/format";

/**
 * Styled native <select>: keyboard + screen-reader friendly everywhere and
 * uses the OS picker on phones. Matches the HeroUI field look.
 */
export const NativeSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; options: { value: string; label: string }[]; wrapperClassName?: string }
>(function NativeSelect({ label, error, options, className, wrapperClassName, id, ...rest }, ref) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      {label && (
        <label htmlFor={selectId} className={cn("text-sm font-medium", error && "text-danger")}>
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-10 w-full appearance-none rounded-[var(--field-radius,12px)] border border-kosh-border bg-[var(--field-background)] pl-3 pr-9 text-sm text-kosh-text outline-none transition focus-visible:ring-2 focus-visible:ring-kosh-info",
            error && "border-danger",
            className,
          )}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-kosh-muted" />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
});
