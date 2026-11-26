"use client";

import { useEffect, useState } from "react";
import { Button, Input, TextField, toast } from "@heroui/react";
import { Flag, RotateCcw, Search } from "lucide-react";
import { useFlagTransactionMutation, useGetAllTransactionsQuery } from "@/store/api/staffApi";
import { useTwoFactor } from "@/components/security/TwoFactorDialog";
import { useReverseTransactionMutation } from "@/store/api/adminApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TXN_TYPE_LABEL } from "@/components/banking/TxnRow";
import { formatMoney } from "@/lib/money";
import { formatDateTime, maskAccountNumber, titleCase } from "@/lib/format";
import type { BankTxn, BankTxnQuery, TransactionStatus, TransactionType } from "@/types/api";
import { ReasonDialog } from "./ReasonDialog";
import { DateRangeField } from "@/components/ui/DateRangeField";

const REVERSIBLE = new Set<TransactionType>(["TRANSFER", "DEPOSIT", "WITHDRAWAL"]);

export function party(p: BankTxn["senderAccount"], fallback: string) {
  return p ? (
    <span>
      {p.user.name} <span className="amount text-xs text-kosh-muted">{maskAccountNumber(p.accountNumber)}</span>
    </span>
  ) : (
    <span className="text-kosh-muted">{fallback}</span>
  );
}

/** Staff + admin: search every transaction; staff can flag, admin can also reverse. */
export function BankTransactions({ scope }: { scope: "staff" | "admin" }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<BankTxnQuery>({ page: 1 });
  const [target, setTarget] = useState<{ t: BankTxn; action: "flag" | "reverse" } | null>(null);
  const [flag] = useFlagTransactionMutation();
  const [reverse] = useReverseTransactionMutation();
  const twoFactor = useTwoFactor();
  useEffect(() => {
    const t = setTimeout(() => setF((p) => (p.q === (q.trim() || undefined) ? p : { ...p, q: q.trim() || undefined, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isLoading, isFetching } = useGetAllTransactionsQuery(f);
  const set = (p: Partial<BankTxnQuery>) => setF((prev) => ({ ...prev, ...p, page: 1 }));

  const columns: Column<BankTxn>[] = [
    {
      key: "ref",
      header: "Transaction",
      cell: (t) => (
        <div>
          <p className="font-medium">{TXN_TYPE_LABEL[t.type]}</p>
          <p className="amount text-xs text-kosh-muted">{t.reference}</p>
        </div>
      ),
    },
    { key: "from", header: "From", cell: (t) => party(t.senderAccount, t.type === "DEPOSIT" ? "Cash" : t.type === "LOAN_DISBURSEMENT" ? "Kosh Loans" : "—") },
    { key: "to", header: "To", cell: (t) => party(t.receiverAccount, t.type === "WITHDRAWAL" ? "Cash" : t.type === "LOAN_REPAYMENT" ? "Kosh Loans" : "—") },
    {
      key: "amt",
      header: "Amount",
      align: "right",
      cell: (t) => (
        <div>
          <Money value={t.amount} className="font-semibold" />
          {t.fee !== "0" && <p className="text-xs text-kosh-muted">fee {formatMoney(t.fee)}</p>}
        </div>
      ),
    },
    { key: "when", header: "Date", hideOnMobile: true, cell: (t) => <span className="whitespace-nowrap text-kosh-muted">{formatDateTime(t.createdAt)}</span> },
    {
      key: "status",
      header: "Status",
      cell: (t) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={t.status} />
          {t.isFlagged && !t.flagResolvedAt && <StatusBadge status="FLAGGED" />}
        </div>
      ),
    },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (t) => (
        <div className="flex justify-end gap-1">
          {!(t.isFlagged && !t.flagResolvedAt) && (
            <Button isIconOnly size="sm" variant="ghost" aria-label={`Flag ${t.reference}`} onPress={() => setTarget({ t, action: "flag" })}>
              <Flag className="size-4" />
            </Button>
          )}
          {scope === "admin" && t.status === "COMPLETED" && REVERSIBLE.has(t.type) && (
            <Button isIconOnly size="sm" variant="ghost" aria-label={`Reverse ${t.reference}`} onPress={() => setTarget({ t, action: "reverse" })}>
              <RotateCcw className="size-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Transactions" description={data ? `${data.total} transactions` : "Every transaction in the bank."} />
      <Panel className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_170px_150px_150px_150px_150px]">
        <TextField aria-label="Search transactions" value={q} onChange={setQ} fullWidth className="sm:col-span-2 lg:col-span-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-kosh-muted" />
            <Input placeholder="Reference, name, account no." className="pl-9" />
          </div>
        </TextField>
        <NativeSelect aria-label="Type" value={f.type ?? ""} onChange={(e) => set({ type: (e.target.value || undefined) as TransactionType | undefined })} options={[{ value: "", label: "All types" }, ...Object.entries(TXN_TYPE_LABEL).map(([value, label]) => ({ value, label }))]} />
        <NativeSelect aria-label="Status" value={f.status ?? ""} onChange={(e) => set({ status: (e.target.value || undefined) as TransactionStatus | undefined })} options={[{ value: "", label: "Any status" }, ...["COMPLETED", "REVERSED", "PENDING", "FAILED"].map((s) => ({ value: s, label: titleCase(s) }))]} />
        <NativeSelect aria-label="Flags" value={f.flagged ?? ""} onChange={(e) => set({ flagged: (e.target.value || undefined) as BankTxnQuery["flagged"] })} options={[{ value: "", label: "Flagged or not" }, { value: "open", label: "Open flags" }, { value: "resolved", label: "Resolved flags" }]} />
        <DateRangeField
          className="sm:col-span-2"
          value={{ from: f.from ?? null, to: f.to ?? null }}
          onChange={(r) => set({ from: r.from ?? undefined, to: r.to ?? undefined })}
        />
      </Panel>
      <Panel className={isFetching && !isLoading ? "opacity-70" : undefined}>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(t) => t.id}
          isLoading={isLoading}
          emptyTitle="No transactions match"
          page={f.page}
          pageCount={data ? Math.ceil(data.total / data.pageSize) : undefined}
          onPageChange={(page) => setF((p) => ({ ...p, page }))}
        />
      </Panel>

      {target?.action === "flag" && (
        <ReasonDialog
          open
          onClose={() => setTarget(null)}
          title={`Flag ${target.t.reference}?`}
          description="Flagged transactions go to the admin review queue. No money moves."
          confirmLabel="Flag for review"
          label="What looks wrong?"
          onConfirm={async (reason) => { await flag({ id: target.t.id, reason }).unwrap(); toast.success("Transaction flagged"); }}
        />
      )}
      {target?.action === "reverse" && (
        <ReasonDialog
          open
          onClose={() => setTarget(null)}
          tone="danger"
          title={`Reverse ${target.t.reference}?`}
          description={`A compensating transaction moves ${formatMoney(target.t.amount)}${target.t.fee !== "0" ? ` (+ ${formatMoney(target.t.fee)} fee refund)` : ""} back. The original is kept and marked Reversed.`}
          confirmLabel="Reverse transaction"
          onConfirm={async (reason) => {
            const id = target.t.id;
            await twoFactor.run({ purpose: "REVERSAL", transactionId: id }, (otp) => reverse({ id, reason, otp }).unwrap());
            toast.success("Transaction reversed");
          }}
        />
      )}
      {twoFactor.dialog}
    </>
  );
}
