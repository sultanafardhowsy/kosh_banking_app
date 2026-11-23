import { cn } from "@/lib/format";

/** Lightweight shimmer block that follows the Kosh subtle fill in both themes. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-kosh-subtle", className)} aria-hidden />;
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-[20px] border border-kosh-border bg-kosh-surface p-5">
      <SkeletonBlock className="h-4 w-24" />
      <SkeletonBlock className="mt-4 h-7 w-36" />
      <SkeletonBlock className="mt-2 h-3 w-20" />
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <SkeletonBlock className="size-9 shrink-0 rounded-full" />
          <SkeletonBlock className="h-4 flex-1" />
          <SkeletonBlock className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
