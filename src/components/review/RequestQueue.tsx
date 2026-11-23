"use client";

import { useState } from "react";
import { Button, Label, TextArea, TextField, toast } from "@heroui/react";
import { Check, X } from "lucide-react";
import { useGetRequestQueueQuery, useReviewRequestMutation } from "@/store/api/requestsApi";
import { useAppSelector } from "@/store/hooks";
import { selectUser } from "@/store/slices/authSlice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { errorMessage } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { formatDateTime, maskAccountNumber, titleCase } from "@/lib/format";
import type { BankRequest, RequestStatus } from "@/types/api";

/** Deposit/withdrawal review queue — shared by /staff/requests and /admin/requests. */
export function RequestQueue() {
  const me = useAppSelector(selectUser);
  const [status, setStatus] = useState<RequestStatus>("PENDING");
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useGetRequestQueueQuery({ status, page });
  const [review, reviewState] = useReviewRequestMutation();
  const [target, setTarget] = useState<{ req: BankRequest; action: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  async function confirm() {
    if (!target) return;
    setDialogError(null);
    try {
      await review({ id: target.req.id, action: target.action, note: note || undefined }).unwrap();
      toast.success(`${titleCase(target.req.type)} ${target.action === "approve" ? "approved" : "rejected"}`);
      setTarget(null);
      setNote("");
    } catch (e) {
      setDialogError(errorMessage(e));
    }
  }

  const columns: Column<BankRequest>[] = [
    {
      key: "cust",
      header: "Customer",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.requestedBy?.name}</p>
          <p className="text-xs text-kosh-muted">{r.requestedBy?.email}</p>
        </div>
      ),
    },
    { key: "type", header: "Type", cell: (r) => <span className={r.type === "DEPOSIT" ? "text-kosh-money-in" : ""}>{titleCase(r.type)}</span> },
    { key: "amount", header: "Amount", align: "right", cell: (r) => <Money value={r.amount} className="font-semibold" /> },
    {
      key: "acc",
      header: "Account",
      cell: (r) => (
        <div>
          <p className="amount text-xs">{maskAccountNumber(r.account.accountNumber)} · {titleCase(r.account.type)}</p>
          <p className="text-xs text-kosh-muted">Balance {r.account.balance ? formatMoney(r.account.balance) : "—"}</p>
        </div>
      ),
    },
    { key: "date", header: "Requested", cell: (r) => <span className="text-kosh-muted">{formatDateTime(r.createdAt)}</span> },
    {
      key: "act",
      header: status === "PENDING" ? "Action" : "Reviewed",
      align: "right",
      cell: (r) =>
        r.status === "PENDING" ? (
          r.requestedBy?.id === me?.id ? (
            <span className="text-xs text-kosh-muted">Your own request</span>
          ) : (
            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" aria-label="Reject" onPress={() => { setDialogError(null); setNote(""); setTarget({ req: r, action: "reject" }); }}>
                <X className="size-4" />
              </Button>
              <Button size="sm" onPress={() => { setDialogError(null); setNote(""); setTarget({ req: r, action: "approve" }); }}>
                <Check className="size-4" /> Approve
              </Button>
            </div>
          )
        ) : (
          <div className="text-right">
            <StatusBadge status={r.status} />
            <p className="mt-1 text-xs text-kosh-muted">{r.reviewedBy?.name ?? ""}</p>
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Deposit & withdrawal requests" description="Approving moves the money immediately. Balances are re-checked at approval." />
      <Segmented
        ariaLabel="Status"
        value={status}
        onChange={(s) => { setStatus(s); setPage(1); }}
        options={[
          { value: "PENDING", label: "Pending", count: status === "PENDING" ? data?.total : undefined },
          { value: "APPROVED", label: "Approved" },
          { value: "REJECTED", label: "Rejected" },
        ]}
        className="mb-4"
      />
      <Panel className={isFetching && !isLoading ? "opacity-70" : undefined}>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          emptyTitle={status === "PENDING" ? "Queue is clear" : "Nothing here"}
          emptyDescription={status === "PENDING" ? "New customer requests appear here." : undefined}
          page={page}
          pageCount={data ? Math.ceil(data.total / data.pageSize) : undefined}
          onPageChange={setPage}
        />
      </Panel>

      <ConfirmDialog
        isOpen={Boolean(target)}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target?.action === "approve" ? `Approve ${target.req.type.toLowerCase()}?` : `Reject ${target?.req.type.toLowerCase()}?`}
        tone={target?.action === "approve" ? "primary" : "danger"}
        confirmLabel={target?.action === "approve" ? "Approve" : "Reject"}
        isLoading={reviewState.isLoading}
        onConfirm={confirm}
        description={
          target && (
            <>
              {formatMoney(target.req.amount)} {target.req.type === "DEPOSIT" ? "into" : "from"} {target.req.requestedBy?.name}&apos;s account{" "}
              <span className="amount">{maskAccountNumber(target.req.account.accountNumber)}</span>.
            </>
          )
        }
      >
        <TextField value={note} onChange={setNote} fullWidth className="mt-3">
          <Label>{target?.action === "reject" ? "Reason (sent to the customer)" : "Note (optional)"}</Label>
          <TextArea rows={2} />
        </TextField>
        {dialogError && <p className="mt-2 text-sm text-danger" role="alert">{dialogError}</p>}
      </ConfirmDialog>
    </>
  );
}
