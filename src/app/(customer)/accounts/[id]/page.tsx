"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import { useGetStatementQuery } from "@/store/api/accountsApi";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonBlock } from "@/components/ui/Skeletons";
import { TXN_TYPE_LABEL } from "@/components/banking/TxnRow";
import { StatementExport } from "@/components/banking/StatementExport";
import { errorCode } from "@/lib/client";
import { formatAccountNumber, formatDateTime, titleCase } from "@/lib/format";
import type { StatementEntry } from "@/types/api";

const columns: Column<StatementEntry>[] = [
  { key: "date", header: "Date", cell: (e) => <span className="whitespace-nowrap text-kosh-muted">{formatDateTime(e.createdAt)}</span> },
  {
    key: "desc",
    header: "Description",
    cell: (e) => (
      <div className="min-w-0">
        <p className="font-medium">{e.transaction.description || TXN_TYPE_LABEL[e.transaction.type]}</p>
        <p className="amount text-xs text-kosh-muted">{e.transaction.reference}</p>
      </div>
    ),
  },
  { key: "type", header: "Type", hideOnMobile: true, cell: (e) => <span className="text-kosh-muted">{TXN_TYPE_LABEL[e.transaction.type]}</span> },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    cell: (e) => <Money value={e.amount} direction={e.direction === "CREDIT" ? "in" : "out"} className="font-semibold" />,
  },
  { key: "bal", header: "Balance", align: "right", cell: (e) => <Money value={e.balanceAfter} className="text-kosh-muted" /> },
];

export default function AccountStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, error } = useGetStatementQuery({ id, page });

  if (errorCode(error) === "NOT_FOUND") {
    return (
      <Panel>
        <EmptyState title="Account not found" description="It may not exist or doesn't belong to you." action={<Link href="/accounts" className="text-kosh-info">Back to accounts</Link>} />
      </Panel>
    );
  }

  const a = data?.account;
  return (
    <div className="space-y-6">
      <Link href="/accounts" className="inline-flex items-center gap-1.5 text-sm text-kosh-muted hover:text-kosh-text">
        <ArrowLeft className="size-4" /> Accounts
      </Link>

      <section className="rounded-[22px] bg-kosh-navy p-6 text-kosh-navy-fg sm:p-7">
        {!a ? (
          <SkeletonBlock className="h-24 bg-white/10" />
        ) : (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-white/70">{a.nickname ?? `${titleCase(a.type)} account`}</p>
                <StatusBadge status={a.status} />
              </div>
              <Money value={a.balance} className="mt-2 block text-4xl font-semibold" />
              <p className="amount mt-1 text-sm text-white/60">{formatAccountNumber(a.accountNumber)}</p>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-white/60">Money in</p>
                <Money value={data!.totals.credits} className="font-semibold text-kosh-on-brand-positive" />
              </div>
              <div>
                <p className="text-white/60">Money out</p>
                <Money value={data!.totals.debits} className="font-semibold" />
              </div>
            </div>
          </div>
        )}
      </section>

      <Panel>
        <PanelHeader
          title="Statement"
          description={data ? `${data.total} ledger entries — every balance change on this account.` : undefined}
          action={
            a && (
              <div className="flex items-center gap-3">
                {a.status === "ACTIVE" && (
                  <Link href="/transfer" className="hidden items-center gap-1.5 text-sm font-medium text-kosh-info hover:underline sm:inline-flex">
                    <ArrowLeftRight className="size-4" /> Transfer
                  </Link>
                )}
                <StatementExport accountId={a.id} />
              </div>
            )
          }
        />
        <div className="mt-3">
          <DataTable
            columns={columns}
            rows={data?.items}
            rowKey={(e) => e.id}
            isLoading={isLoading || (isFetching && !data)}
            emptyTitle="No entries yet"
            onRowClick={(e) => router.push(`/transactions/${e.transaction.id}`)}
            page={page}
            pageCount={data ? Math.ceil(data.total / data.pageSize) : undefined}
            onPageChange={setPage}
          />
        </div>
      </Panel>
    </div>
  );
}
