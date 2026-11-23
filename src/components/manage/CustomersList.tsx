"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, TextField } from "@heroui/react";
import { BadgeCheck, Clock, Search, UserPlus } from "lucide-react";
import { useGetCustomersQuery } from "@/store/api/staffApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/format";
import type { CustomerRow, UserStatus } from "@/types/api";
import { RegisterCustomerDialog } from "./RegisterCustomerDialog";

export function CustomersList({ scope }: { scope: "staff" | "admin" }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<UserStatus | "ALL">("ALL");
  const [kyc, setKyc] = useState<"all" | "verified" | "pending">("all");
  const [page, setPage] = useState(1);
  const [registerOpen, setRegisterOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading, isFetching } = useGetCustomersQuery({
    q: debounced || undefined,
    status: status === "ALL" ? undefined : status,
    verified: kyc === "all" ? undefined : kyc === "verified",
    page,
  });

  const columns: Column<CustomerRow>[] = [
    {
      key: "name",
      header: "Customer",
      cell: (c) => (
        <div>
          <p className="flex items-center gap-1.5 font-medium">
            {c.name}
            {c.isVerified ? <BadgeCheck className="size-4 text-kosh-money-in" aria-label="Verified" /> : <Clock className="size-3.5 text-[var(--kosh-pending-fg)]" aria-label="KYC pending" />}
          </p>
          <p className="text-xs text-kosh-muted">{c.email}</p>
        </div>
      ),
    },
    { key: "phone", header: "Phone", hideOnMobile: true, cell: (c) => <span className="text-kosh-muted">{c.profile?.phone ?? "—"}</span> },
    { key: "acc", header: "Accounts", align: "center", cell: (c) => <span>{c.accountCount}{c.frozenCount > 0 && <span className="text-xs text-kosh-muted"> ({c.frozenCount} frozen)</span>}</span> },
    { key: "bal", header: "Total balance", align: "right", cell: (c) => <Money value={c.totalBalance} className="font-medium" /> },
    { key: "since", header: "Joined", hideOnMobile: true, cell: (c) => <span className="text-kosh-muted">{formatDate(c.createdAt)}</span> },
    { key: "status", header: "Status", cell: (c) => <StatusBadge status={c.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        description={data ? `${data.total} customer${data.total === 1 ? "" : "s"}` : "Search, register and verify customers."}
        actions={<Button onPress={() => setRegisterOpen(true)}><UserPlus className="size-4" /> Register customer</Button>}
      />
      <Panel className="mb-4 flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <TextField aria-label="Search customers" value={q} onChange={setQ} fullWidth className="lg:max-w-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-kosh-muted" />
            <Input placeholder="Name, email, phone or account no." className="pl-9" />
          </div>
        </TextField>
        <Segmented
          ariaLabel="KYC"
          value={kyc}
          onChange={(v) => { setKyc(v); setPage(1); }}
          options={[{ value: "all", label: "All" }, { value: "verified", label: "Verified" }, { value: "pending", label: "KYC pending" }]}
        />
        <NativeSelect
          aria-label="Status"
          value={status}
          onChange={(e) => { setStatus(e.target.value as UserStatus | "ALL"); setPage(1); }}
          wrapperClassName="lg:ml-auto lg:w-44"
          options={[{ value: "ALL", label: "Any status" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }, { value: "BLOCKED", label: "Blocked" }]}
        />
      </Panel>
      <Panel className={isFetching && !isLoading ? "opacity-70" : undefined}>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(c) => c.id}
          isLoading={isLoading}
          emptyTitle="No customers match"
          onRowClick={(c) => router.push(`/${scope}/customers/${c.id}`)}
          page={page}
          pageCount={data ? Math.ceil(data.total / data.pageSize) : undefined}
          onPageChange={setPage}
        />
      </Panel>
      <RegisterCustomerDialog open={registerOpen} onClose={() => setRegisterOpen(false)} basePath={`/${scope}/customers`} />
    </>
  );
}
