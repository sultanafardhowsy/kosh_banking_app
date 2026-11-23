"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, TextField } from "@heroui/react";
import { Search } from "lucide-react";
import { useGetAllAccountsQuery } from "@/store/api/staffApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatAccountNumber, formatDate, formatMoneyShort, titleCase } from "./format-helpers";
import type { AccountStatus, AccountType, AdminAccountRow } from "@/types/api";
import { AccountControls } from "./AccountControls";

export function AccountsList({ scope }: { scope: "staff" | "admin" }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<AccountStatus | "">("");
  const [type, setType] = useState<AccountType | "">("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isLoading } = useGetAllAccountsQuery({ q: debounced || undefined, status: status || undefined, type: type || undefined, page });

  const columns: Column<AdminAccountRow>[] = [
    {
      key: "acc",
      header: "Account",
      cell: (a) => (
        <div>
          <p className="amount font-medium">{formatAccountNumber(a.accountNumber)}</p>
          <p className="text-xs text-kosh-muted">{titleCase(a.type)}{a.nickname ? ` · ${a.nickname}` : ""}</p>
        </div>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      cell: (a) => (
        <div>
          <p>{a.user.name}</p>
          {a.user.status !== "ACTIVE" && <StatusBadge status={a.user.status} className="mt-1" />}
        </div>
      ),
    },
    { key: "bal", header: "Balance", align: "right", cell: (a) => <Money value={a.balance} className="font-semibold" /> },
    {
      key: "limits",
      header: "Limits",
      hideOnMobile: true,
      cell: (a) => <span className="text-xs text-kosh-muted">{a.dailyTransferLimit || a.maxSingleTxn ? `Daily ${a.dailyTransferLimit ? formatMoneyShort(a.dailyTransferLimit) : "default"} · Single ${a.maxSingleTxn ? formatMoneyShort(a.maxSingleTxn) : "default"}` : "Bank default"}</span>,
    },
    { key: "opened", header: "Opened", hideOnMobile: true, cell: (a) => <span className="text-kosh-muted">{formatDate(a.createdAt)}</span> },
    { key: "status", header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
    ...(scope === "admin"
      ? [{ key: "act", header: "", align: "right" as const, cell: (a: AdminAccountRow) => <div onClick={(e) => e.stopPropagation()}><AccountControls account={a} customerId={a.user.id} /></div> }]
      : []),
  ];

  return (
    <>
      <PageHeader title="Accounts" description={data ? `${data.total} accounts` : "Every account in the bank."} />
      <Panel className="mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_180px_180px]">
        <TextField aria-label="Search accounts" value={q} onChange={setQ} fullWidth>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-kosh-muted" />
            <Input placeholder="Account number, owner or nickname" className="pl-9" />
          </div>
        </TextField>
        <NativeSelect aria-label="Type" value={type} onChange={(e) => { setType(e.target.value as AccountType | ""); setPage(1); }} options={[{ value: "", label: "All types" }, { value: "SAVINGS", label: "Savings" }, { value: "CURRENT", label: "Current" }, { value: "BUSINESS", label: "Business" }]} />
        <NativeSelect aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value as AccountStatus | ""); setPage(1); }} options={[{ value: "", label: "Any status" }, { value: "ACTIVE", label: "Active" }, { value: "FROZEN", label: "Frozen" }, { value: "CLOSED", label: "Closed" }]} />
      </Panel>
      <Panel>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(a) => a.id}
          isLoading={isLoading}
          emptyTitle="No accounts match"
          onRowClick={(a) => router.push(`/${scope}/customers/${a.user.id}`)}
          page={page}
          pageCount={data ? Math.ceil(data.total / data.pageSize) : undefined}
          onPageChange={setPage}
        />
      </Panel>
    </>
  );
}
