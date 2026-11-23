"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGetLoanQueueQuery } from "@/store/api/loansApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { loanLabel } from "@/components/loans/LoanBits";
import { formatBps } from "@/lib/money";
import { formatDate } from "@/lib/format";
import type { LoanStatus, ReviewLoanRow } from "@/types/api";

type Tab = LoanStatus | "ALL";

/** Loan queue — staff default to PENDING (their work), admin to UNDER_REVIEW (awaiting decision). */
export function LoanQueue({ scope }: { scope: "staff" | "admin" }) {
  const router = useRouter();
  const [status, setStatus] = useState<Tab>(scope === "admin" ? "UNDER_REVIEW" : "PENDING");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetLoanQueueQuery({ status: status === "ALL" ? undefined : status, page });
  const c = data?.counts ?? {};

  const columns: Column<ReviewLoanRow>[] = [
    {
      key: "who",
      header: "Applicant",
      cell: (l) => (
        <div>
          <p className="font-medium">{l.user.name}</p>
          <p className="text-xs text-kosh-muted">{l.user.email}{!l.user.isVerified && " · unverified"}</p>
        </div>
      ),
    },
    { key: "type", header: "Loan", cell: (l) => <span>{loanLabel(l.loanType)} <span className="text-xs text-kosh-muted">· {formatBps(l.interestRateBps)} · {l.durationMonths}m</span></span> },
    { key: "amt", header: "Principal", align: "right", cell: (l) => <Money value={l.principal} className="font-semibold" /> },
    { key: "emi", header: "EMI / income", align: "right", hideOnMobile: true, cell: (l) => <span className="text-xs text-kosh-muted"><Money value={l.emiAmount ?? "0"} /> / <Money value={l.monthlyIncome} /></span> },
    { key: "date", header: "Applied", cell: (l) => <span className="text-kosh-muted">{formatDate(l.createdAt)}</span> },
    {
      key: "status",
      header: "Status",
      cell: (l) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={l.status} label={l.status === "UNDER_REVIEW" ? "Under review" : undefined} />
          {l.overdueCount > 0 && <StatusBadge status="OVERDUE" label={`${l.overdueCount} overdue`} />}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Loans"
        description={scope === "admin" ? "Approve or reject applications forwarded by staff. Approval disburses immediately." : "Review applications, add notes and forward them for the credit decision."}
      />
      <Segmented
        ariaLabel="Status"
        value={status}
        onChange={(s) => { setStatus(s); setPage(1); }}
        options={[
          { value: "PENDING", label: "New", count: c.PENDING ?? 0 },
          { value: "UNDER_REVIEW", label: "Under review", count: c.UNDER_REVIEW ?? 0 },
          { value: "ACTIVE", label: "Active", count: c.ACTIVE ?? 0 },
          { value: "COMPLETED", label: "Completed", count: c.COMPLETED ?? 0 },
          { value: "REJECTED", label: "Rejected", count: c.REJECTED ?? 0 },
          { value: "ALL", label: "All" },
        ]}
        className="mb-4"
      />
      <Panel>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(l) => l.id}
          isLoading={isLoading}
          emptyTitle="No loans in this state"
          onRowClick={(l) => router.push(`/${scope}/loans/${l.id}`)}
          page={page}
          pageCount={data ? Math.ceil(data.total / data.pageSize) : undefined}
          onPageChange={setPage}
        />
      </Panel>
    </>
  );
}
