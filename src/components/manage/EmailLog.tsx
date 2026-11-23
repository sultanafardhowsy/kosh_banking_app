"use client";

import { useState } from "react";
import { Button, Modal } from "@heroui/react";
import { Mail } from "lucide-react";
import { useGetEmailLogQuery, useGetEmailQuery } from "@/store/api/adminApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { formatDateTime, titleCase } from "@/lib/format";
import type { EmailLogRow, EmailStatus } from "@/types/api";

const STATUS_STYLE: Record<EmailStatus, string> = {
  SENT: "bg-[var(--kosh-success-bg)] text-[var(--kosh-success-fg)]",
  FAILED: "bg-[var(--kosh-danger-bg)] text-[var(--kosh-danger-fg)]",
  LOGGED: "bg-[var(--kosh-neutral-bg)] text-[var(--kosh-neutral-fg)]",
};
const STATUS_LABEL: Record<EmailStatus, string> = { SENT: "Sent", FAILED: "Failed", LOGGED: "Logged only" };
const PROVIDER_LABEL = { smtp: "SMTP (Nodemailer)", resend: "Resend", log: "Not configured — emails are logged here only" } as const;

export function EmailLog() {
  const [status, setStatus] = useState<EmailStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  const { data, isLoading } = useGetEmailLogQuery({ status: status === "ALL" ? undefined : status, page });
  const c = data?.counts ?? {};

  const columns: Column<EmailLogRow>[] = [
    { key: "when", header: "When", cell: (e) => <span className="whitespace-nowrap text-kosh-muted">{formatDateTime(e.createdAt)}</span> },
    {
      key: "to",
      header: "Recipient",
      cell: (e) => (
        <div>
          <p>{e.user?.name ?? e.originalTo}</p>
          <p className="text-xs text-kosh-muted">{e.toAddress !== e.originalTo ? `${e.originalTo} → ${e.toAddress}` : e.toAddress}</p>
        </div>
      ),
    },
    { key: "subject", header: "Subject", cell: (e) => <span className="font-medium">{e.subject.replace(/ — Kosh.*$/, "")}</span> },
    { key: "type", header: "Trigger", hideOnMobile: true, cell: (e) => <span className="text-xs text-kosh-muted">{e.notificationType ? titleCase(e.notificationType) : "—"}</span> },
    {
      key: "status",
      header: "Status",
      cell: (e) => (
        <div>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[e.status]}`}>{STATUS_LABEL[e.status]}</span>
          {e.error && <p className="mt-1 max-w-[220px] truncate text-xs text-[var(--kosh-danger-fg)]" title={e.error}>{e.error}</p>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Email log" description="Every notification email Kosh sent or tried to send. Click a row to preview it." />
      {data && (
        <Panel className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-2 p-4 text-sm">
          <span className="flex items-center gap-2"><Mail className="size-4 text-kosh-muted" /> Provider: <strong>{PROVIDER_LABEL[data.config.provider]}</strong></span>
          {data.config.provider !== "log" && <span className="text-kosh-muted">From: {data.config.from}</span>}
          {data.config.redirectTo && <span className="text-kosh-muted">Demo redirect: all emails go to {data.config.redirectTo}</span>}
        </Panel>
      )}
      <Segmented
        ariaLabel="Status"
        value={status}
        onChange={(s) => { setStatus(s); setPage(1); }}
        options={[
          { value: "ALL", label: "All" },
          { value: "SENT", label: "Sent", count: c.SENT ?? 0 },
          { value: "FAILED", label: "Failed", count: c.FAILED ?? 0 },
          { value: "LOGGED", label: "Logged only", count: c.LOGGED ?? 0 },
        ]}
        className="mb-4"
      />
      <Panel>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(e) => e.id}
          isLoading={isLoading}
          emptyTitle="No emails yet"
          emptyDescription="Emails appear here as customers transfer money, requests are decided, loans are approved and so on."
          onRowClick={(e) => setPreview(e.id)}
          page={page}
          pageCount={data ? Math.ceil(data.total / data.pageSize) : undefined}
          onPageChange={setPage}
        />
      </Panel>
      {preview && <EmailPreview id={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

function EmailPreview({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useGetEmailQuery(id);
  return (
    <Modal.Backdrop isOpen onOpenChange={(o) => !o && onClose()}>
      <Modal.Container size="lg" placement="center" scroll="inside">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading className="truncate">{data?.subject ?? "Email"}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {data && (
              <>
                <p className="mb-3 text-xs text-kosh-muted">To {data.toAddress} · {formatDateTime(data.createdAt)}</p>
                {/* sandboxed: the stored HTML can't run scripts or reach the app */}
                <iframe title="Email preview" sandbox="" srcDoc={data.html} className="h-[520px] w-full rounded-xl border border-kosh-border bg-white" />
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={onClose}>Close</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
