"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, TextField } from "@heroui/react";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useGetTransactionsQuery } from "@/store/api/transactionsApi";
import { useGetMeQuery } from "@/store/api/meApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { resetFilters, selectTxnFilters, selectTxnPage, selectTxnPageSize, setFilters, setPage, type TransactionFilters } from "@/store/slices/transactionSlice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TxnIcon, TxnRow, TXN_TYPE_LABEL } from "@/components/banking/TxnRow";
import { formatDateTime, maskAccountNumber, titleCase } from "@/lib/format";
import { DateRangeField } from "@/components/ui/DateRangeField";
import type { CustomerTxn } from "@/types/api";

const columns: Column<CustomerTxn>[] = [
  {
    key: "who",
    header: "Transaction",
    cell: (t) => (
      <div className="flex items-center gap-3">
        <TxnIcon type={t.type} direction={t.direction} />
        <div className="min-w-0">
          <p className="truncate font-medium">{t.counterparty}</p>
          <p className="truncate text-xs text-kosh-muted">{t.description || TXN_TYPE_LABEL[t.type]}</p>
        </div>
      </div>
    ),
  },
  { key: "ref", header: "Reference", cell: (t) => <span className="amount text-xs text-kosh-muted">{t.reference}</span> },
  { key: "date", header: "Date", cell: (t) => <span className="whitespace-nowrap text-kosh-muted">{formatDateTime(t.createdAt)}</span> },
  { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} /> },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    cell: (t) => <Money value={t.net} direction={t.direction === "internal" ? undefined : t.direction} className="font-semibold" />,
  },
];

const TYPES = ["ALL", "TRANSFER", "DEPOSIT", "WITHDRAWAL", "LOAN_DISBURSEMENT", "LOAN_REPAYMENT", "REVERSAL"] as const;
const STATUSES = ["ALL", "COMPLETED", "REVERSED", "PENDING", "FAILED"] as const;

export default function TransactionsPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const filters = useAppSelector(selectTxnFilters);
  const page = useAppSelector(selectTxnPage);
  const pageSize = useAppSelector(selectTxnPageSize);
  const { data: me } = useGetMeQuery();

  // debounce the search box into Redux
  const [q, setQ] = useState(filters.q);
  useEffect(() => {
    const t = setTimeout(() => q !== filters.q && dispatch(setFilters({ q })), 300);
    return () => clearTimeout(t);
  }, [q, filters.q, dispatch]);

  const { data, isFetching, isLoading } = useGetTransactionsQuery({
    accountId: filters.accountId || undefined,
    q: filters.q || undefined,
    type: filters.type === "ALL" ? undefined : filters.type,
    status: filters.status === "ALL" ? undefined : filters.status,
    from: filters.from ?? undefined,
    to: filters.to ?? undefined,
    page,
    pageSize,
  });

  const set = (p: Partial<TransactionFilters>) => dispatch(setFilters(p));
  const [showFilters, setShowFilters] = useState(false);
  const mobileHide = showFilters ? "" : "max-md:hidden";
  const activeCount = [filters.q, filters.accountId, filters.type !== "ALL", filters.status !== "ALL", filters.from, filters.to].filter(Boolean).length;
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

  return (
    <>
      <PageHeader title="Transactions" description={data ? `${data.total} transaction${data.total === 1 ? "" : "s"} found` : "Search and filter your history."} />

      <Panel className="mb-4 p-4">
        <Button variant="outline" size="sm" className="mb-3 md:hidden" onPress={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
          <SlidersHorizontal className="size-4" /> {showFilters ? "Hide filters" : "Filters"}
          {activeCount > 0 && <span className="rounded-full bg-kosh-navy px-1.5 text-[11px] text-kosh-navy-fg">{activeCount}</span>}
        </Button>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <TextField aria-label="Search" value={q} onChange={setQ} fullWidth className="sm:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-kosh-muted" />
              <Input placeholder="Search reference or note" className="pl-9" />
            </div>
          </TextField>
          <NativeSelect
            aria-label="Account"
            wrapperClassName={mobileHide}
            value={filters.accountId}
            onChange={(e) => set({ accountId: e.target.value })}
            options={[{ value: "", label: "All accounts" }, ...(me?.accounts ?? []).map((a) => ({ value: a.id, label: `${a.nickname ?? titleCase(a.type)} ${maskAccountNumber(a.accountNumber)}` }))]}
          />
          <NativeSelect
            aria-label="Type"
            wrapperClassName={mobileHide}
            value={filters.type}
            onChange={(e) => set({ type: e.target.value as TransactionFilters["type"] })}
            options={TYPES.map((t) => ({ value: t, label: t === "ALL" ? "All types" : TXN_TYPE_LABEL[t] }))}
          />
          <NativeSelect
            aria-label="Status"
            wrapperClassName={mobileHide}
            value={filters.status}
            onChange={(e) => set({ status: e.target.value as TransactionFilters["status"] })}
            options={STATUSES.map((s) => ({ value: s, label: s === "ALL" ? "Any status" : titleCase(s) }))}
          />
          <Button variant="outline" className={mobileHide} onPress={() => { setQ(""); dispatch(resetFilters()); }}>
            <RotateCcw className="size-4" /> Reset
          </Button>
          <DateRangeField
            className={`sm:col-span-2 ${mobileHide}`}
            label="Date range"
            value={{ from: filters.from ?? null, to: filters.to ?? null }}
            max={todayIso}
            onChange={(r) => set({ from: r.from, to: r.to })}
          />
        </div>
      </Panel>

      <Panel className={isFetching && !isLoading ? "opacity-70 transition-opacity" : undefined}>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(t) => t.id}
          isLoading={isLoading}
          emptyTitle="No matching transactions"
          emptyDescription="Try a different filter or date range."
          onRowClick={(t) => router.push(`/transactions/${t.id}`)}
          mobileCard={(t) => <TxnRow t={t} href={false} />}
          page={page}
          pageCount={data ? Math.ceil(data.total / data.pageSize) : undefined}
          onPageChange={(p) => dispatch(setPage(p))}
        />
      </Panel>
    </>
  );
}
