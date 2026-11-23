import { cn, titleCase } from "@/lib/format";

/**
 * One color per status family — identical on every screen.
 * Pending = amber · Completed/Approved/Active/Paid = green ·
 * Failed/Rejected/Blocked/Overdue = red · Reversed/Frozen/Inactive/etc. = neutral blue-grey
 */
const TONE: Record<string, "success" | "pending" | "danger" | "neutral"> = {
  PENDING: "pending",
  UNDER_REVIEW: "pending",
  REQUESTED: "pending",
  DUE: "pending",

  COMPLETED: "success",
  APPROVED: "success",
  ACTIVE: "success",
  PAID: "success",
  VERIFIED: "success",

  FAILED: "danger",
  REJECTED: "danger",
  BLOCKED: "danger",
  OVERDUE: "danger",
  FLAGGED: "danger",

  REVERSED: "neutral",
  FROZEN: "neutral",
  INACTIVE: "neutral",
  CLOSED: "neutral",
};

const TONE_CLASS = {
  success: "bg-[var(--kosh-success-bg)] text-[var(--kosh-success-fg)]",
  pending: "bg-[var(--kosh-pending-bg)] text-[var(--kosh-pending-fg)]",
  danger: "bg-[var(--kosh-danger-bg)] text-[var(--kosh-danger-fg)]",
  neutral: "bg-[var(--kosh-neutral-bg)] text-[var(--kosh-neutral-fg)]",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const tone = TONE[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {label ?? titleCase(status)}
    </span>
  );
}
