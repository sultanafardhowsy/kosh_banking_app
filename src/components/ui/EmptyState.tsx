import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/format";

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-2xl bg-kosh-subtle text-kosh-muted [&_svg]:size-5">
        {icon ?? <Inbox />}
      </span>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-kosh-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
