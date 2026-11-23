"use client";

import { useState } from "react";
import { Input, TextField } from "@heroui/react";
import { useGetAuditQuery } from "@/store/api/adminApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { cn, formatDateTime, titleCase } from "@/lib/format";
import type { AuditEntry } from "@/types/api";

export const auditLabel = (action: string) => titleCase(action);

const TONE: Record<string, string> = {
  BLOCKED: "text-[var(--kosh-danger-fg)]",
  REJECTED: "text-[var(--kosh-danger-fg)]",
  FROZEN: "text-[var(--kosh-danger-fg)]",
  REVERSED: "text-[var(--kosh-danger-fg)]",
  FLAGGED: "text-[var(--kosh-pending-fg)]",
  APPROVED: "text-kosh-money-in",
  VERIFIED: "text-kosh-money-in",
};
const toneFor = (action: string) => Object.entries(TONE).find(([k]) => action.includes(k))?.[1] ?? "";

function Meta({ m }: { m: Record<string, unknown> | null }) {
  if (!m || !Object.keys(m).length) return <span className="text-kosh-muted">—</span>;
  return (
    <span className="text-xs text-kosh-muted">
      {Object.entries(m)
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}`)
        .join(" · ")}
    </span>
  );
}

const columns: Column<AuditEntry>[] = [
  { key: "when", header: "When", cell: (a) => <span className="whitespace-nowrap text-kosh-muted">{formatDateTime(a.createdAt)}</span> },
  { key: "who", header: "Actor", cell: (a) => <span>{a.actor.name} <span className="text-xs text-kosh-muted">· {titleCase(a.actor.role)}</span></span> },
  { key: "what", header: "Action", cell: (a) => <span className={cn("font-medium", toneFor(a.action))}>{auditLabel(a.action)}</span> },
  { key: "on", header: "Entity", cell: (a) => <span className="text-kosh-muted">{a.entity} <span className="amount text-xs">#{a.entityId.slice(-6)}</span></span> },
  { key: "meta", header: "Details", hideOnMobile: true, className: "max-w-xs truncate", cell: (a) => <Meta m={a.metadata} /> },
];

const ENTITIES = ["", "User", "Account", "Transaction", "DepositWithdrawalRequest", "Loan", "BankSettings"];

export function AuditLog() {
  const [entity, setEntity] = useState("");
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetAuditQuery({ entity: entity || undefined, actorId: actorId || undefined, action: action || undefined, page });

  return (
    <>
      <PageHeader title="Audit log" description="Every staff and admin action, newest first. Entries can't be edited or deleted." />
      <Panel className="mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <NativeSelect aria-label="Entity" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} options={ENTITIES.map((e) => ({ value: e, label: e ? titleCase(e.replace(/([a-z])([A-Z])/g, "$1_$2")) : "All entities" }))} />
        <NativeSelect aria-label="Actor" value={actorId} onChange={(e) => { setActorId(e.target.value); setPage(1); }} options={[{ value: "", label: "Anyone" }, ...(data?.actors ?? []).map((a) => ({ value: a.id, label: `${a.name} (${titleCase(a.role)})` }))]} />
        <TextField aria-label="Action contains" value={action} onChange={(v) => { setAction(v.toUpperCase().replace(/\s+/g, "_")); setPage(1); }} fullWidth>
          <Input placeholder="Action, e.g. approved" />
        </TextField>
      </Panel>
      <Panel>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(a) => a.id}
          isLoading={isLoading}
          emptyTitle="No entries"
          page={page}
          pageCount={data ? Math.ceil(data.total / data.pageSize) : undefined}
          onPageChange={setPage}
        />
      </Panel>
    </>
  );
}
