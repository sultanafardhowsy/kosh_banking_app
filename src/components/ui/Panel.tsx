import type { ReactNode } from "react";
import { cn } from "@/lib/format";

/** The standard Kosh surface card (20px radius, 1px border). */
export function Panel({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={cn("rounded-[20px] border border-kosh-border bg-kosh-surface", className)}>
      {children}
    </Tag>
  );
}

export function PanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 sm:px-6", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-kosh-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
