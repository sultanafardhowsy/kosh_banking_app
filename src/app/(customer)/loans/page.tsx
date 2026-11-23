"use client";

import Link from "next/link";
import { CalendarClock, HandCoins, Plus } from "lucide-react";
import { useGetMyLoansQuery } from "@/store/api/loansApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonBlock } from "@/components/ui/Skeletons";
import { LoanProgress, loanLabel } from "@/components/loans/LoanBits";
import { formatBps } from "@/lib/money";
import { formatDate } from "@/lib/format";

export default function LoansPage() {
  const { data, isLoading } = useGetMyLoansQuery();
  const hasOpen = data?.some((l) => l.status === "PENDING" || l.status === "UNDER_REVIEW");

  return (
    <>
      <PageHeader
        title="Loans"
        description="Apply, follow the review and repay your EMIs."
        actions={
          !hasOpen && (
            <Link href="/loans/apply" className="button button--primary button--md">
              <Plus className="size-4" /> Apply for a loan
            </Link>
          )
        }
      />
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonBlock className="h-52 rounded-[20px]" />
          <SkeletonBlock className="h-52 rounded-[20px]" />
        </div>
      ) : !data?.length ? (
        <Panel>
          <EmptyState
            icon={<HandCoins />}
            title="No loans yet"
            description="Personal, home, auto, education and business loans with transparent EMIs."
            action={<Link href="/loans/apply" className="button button--primary button--md">Check what you can borrow</Link>}
          />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((l) => (
            <Link key={l.id} href={`/loans/${l.id}`} className="block rounded-[20px] border border-kosh-border bg-kosh-surface p-5 transition-colors hover:border-kosh-info/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{loanLabel(l.loanType)}</p>
                  <p className="text-xs text-kosh-muted">
                    {formatBps(l.interestRateBps)} · {l.durationMonths} months · applied {formatDate(l.createdAt)}
                  </p>
                </div>
                <StatusBadge status={l.status} label={l.status === "UNDER_REVIEW" ? "Under review" : undefined} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-kosh-muted">Principal</p>
                  <Money value={l.principal} className="text-lg font-semibold" />
                </div>
                <div>
                  <p className="text-xs text-kosh-muted">{l.status === "ACTIVE" ? "Remaining" : "EMI"}</p>
                  <Money value={l.status === "ACTIVE" ? l.remainingBalance : (l.emiAmount ?? "0")} className="text-lg font-semibold" />
                </div>
              </div>
              {l.status === "ACTIVE" && (
                <>
                  <LoanProgress paid={l.paidCount ?? 0} total={l.durationMonths} className="mt-4" />
                  {l.nextInstallment && (
                    <p className={`mt-4 flex items-center gap-1.5 text-sm ${l.nextInstallment.status === "OVERDUE" ? "text-danger" : "text-kosh-muted"}`}>
                      <CalendarClock className="size-4" />
                      {l.nextInstallment.status === "OVERDUE" ? "Overdue: " : "Next: "}
                      <Money value={l.nextInstallment.amountDue} className="font-medium text-kosh-text" /> on {formatDate(l.nextInstallment.dueDate)}
                    </p>
                  )}
                </>
              )}
              {l.status === "REJECTED" && l.rejectionReason && <p className="mt-4 text-sm text-kosh-muted">Reason: {l.rejectionReason}</p>}
              {(l.status === "PENDING" || l.status === "UNDER_REVIEW") && (
                <p className="mt-4 text-sm text-kosh-muted">
                  {l.status === "PENDING" ? "Waiting for a staff review." : "Passed staff review — awaiting the credit decision."}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
