"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@heroui/react";
import { cn } from "@/lib/format";
import { EmptyState } from "./EmptyState";
import { TableSkeleton } from "./Skeletons";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  /** hide this column inside the mobile card view */
  hideOnMobile?: boolean;
};

/**
 * Responsive table: a real <table> with sticky header on ≥ md screens,
 * stacked cards on mobile. Pagination is controlled by the caller (Redux slice).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  onRowClick,
  mobileCard,
  page,
  pageCount,
  onPageChange,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  /** custom mobile card; defaults to label/value pairs */
  mobileCard?: (row: T) => ReactNode;
  page?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;
}) {
  if (isLoading) return <TableSkeleton />;
  if (!rows?.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  const alignClass = (a?: Column<T>["align"]) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden max-h-[70vh] overflow-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-kosh-surface">
            <tr className="border-b border-kosh-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "px-5 py-3 text-xs font-medium uppercase tracking-wide text-kosh-muted",
                    alignClass(c.align),
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-kosh-border last:border-0",
                  onRowClick && "cursor-pointer hover:bg-kosh-subtle",
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-5 py-3.5", alignClass(c.align), c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-kosh-border md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn("px-4 py-3.5", onRowClick && "cursor-pointer active:bg-kosh-subtle")}
          >
            {mobileCard ? (
              mobileCard(row)
            ) : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {columns
                  .filter((c) => !c.hideOnMobile)
                  .map((c) => (
                    <div key={c.key} className="contents">
                      <dt className="text-kosh-muted">{c.header}</dt>
                      <dd className="text-right">{c.cell(row)}</dd>
                    </div>
                  ))}
              </dl>
            )}
          </li>
        ))}
      </ul>

      {pageCount !== undefined && pageCount > 1 && page !== undefined && onPageChange && (
        <div className="flex items-center justify-between border-t border-kosh-border px-5 py-3 text-sm">
          <span className="text-kosh-muted">
            Page {page} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              isIconOnly
              aria-label="Previous page"
              isDisabled={page <= 1}
              onPress={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              isIconOnly
              aria-label="Next page"
              isDisabled={page >= pageCount}
              onPress={() => onPageChange(page + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
