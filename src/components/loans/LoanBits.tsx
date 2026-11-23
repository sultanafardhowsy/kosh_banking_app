import type { Installment, LoanType } from "@/types/api";
import { LOAN_PRODUCTS } from "@/lib/loan-products";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, formatDate } from "@/lib/format";

export const loanLabel = (t: LoanType) => `${LOAN_PRODUCTS[t].label} loan`;

/** Paid-vs-total bar. */
export function LoanProgress({ paid, total, className }: { paid: number; total: number; className?: string }) {
  const pct = total ? Math.round((paid / total) * 100) : 0;
  return (
    <div className={className}>
      <div className="flex justify-between text-xs text-kosh-muted">
        <span>{paid} of {total} EMIs paid</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-kosh-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-kosh-accent transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Full amortisation table (customer + staff views). */
export function ScheduleTable({ rows }: { rows: Installment[] }) {
  return (
    <div className="max-h-[480px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-kosh-surface">
          <tr className="border-b border-kosh-border text-left text-xs uppercase tracking-wide text-kosh-muted">
            <th className="px-5 py-3 font-medium">#</th>
            <th className="px-5 py-3 font-medium">Due</th>
            <th className="hidden px-5 py-3 text-right font-medium sm:table-cell">Principal</th>
            <th className="hidden px-5 py-3 text-right font-medium sm:table-cell">Interest</th>
            <th className="px-5 py-3 text-right font-medium">EMI</th>
            <th className="px-5 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={cn("border-b border-kosh-border last:border-0", r.status === "PAID" && "text-kosh-muted")}>
              <td className="px-5 py-3">{r.installmentNo}</td>
              <td className="whitespace-nowrap px-5 py-3">{formatDate(r.dueDate)}</td>
              <td className="hidden px-5 py-3 text-right sm:table-cell"><Money value={r.principalPart} /></td>
              <td className="hidden px-5 py-3 text-right sm:table-cell"><Money value={r.interestPart} /></td>
              <td className="px-5 py-3 text-right font-medium"><Money value={r.amountDue} /></td>
              <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
