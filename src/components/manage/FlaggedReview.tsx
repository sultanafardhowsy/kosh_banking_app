"use client";

import { useState } from "react";
import { Button, toast } from "@heroui/react";
import { CheckCircle2, Flag, RotateCcw, ShieldCheck } from "lucide-react";
import { useTwoFactor } from "@/components/security/TwoFactorDialog";
import { useGetFlaggedQuery, useResolveFlagMutation, useReverseTransactionMutation } from "@/store/api/adminApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonBlock } from "@/components/ui/Skeletons";
import { TXN_TYPE_LABEL } from "@/components/banking/TxnRow";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import type { BankTxn } from "@/types/api";
import { party } from "./BankTransactions";
import { ReasonDialog } from "./ReasonDialog";

/** Admin: review auto-flagged and manually flagged transactions — clear the flag or reverse. */
export function FlaggedReview() {
  const [state, setState] = useState<"open" | "resolved">("open");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetFlaggedQuery({ state, page });
  const [resolve] = useResolveFlagMutation();
  const [reverse] = useReverseTransactionMutation();
  const twoFactor = useTwoFactor();
  const [target, setTarget] = useState<{ t: BankTxn; action: "resolve" | "reverse" } | null>(null);
  const pages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <>
      <PageHeader title="Flagged transactions" description="Caught by fraud rules (≥80% of balance, bursts, 5× average, failed PINs) or flagged by staff." />
      <Segmented ariaLabel="State" value={state} onChange={(s) => { setState(s); setPage(1); }} options={[{ value: "open", label: "Needs review", count: state === "open" ? data?.total : undefined }, { value: "resolved", label: "Resolved" }]} className="mb-4" />

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-36 rounded-[20px]" />)}</div>
      ) : !data?.items.length ? (
        <Panel><EmptyState icon={<ShieldCheck />} title={state === "open" ? "Nothing to review" : "No resolved flags yet"} description={state === "open" ? "New flags appear here as transactions happen." : undefined} /></Panel>
      ) : (
        <div className="space-y-3">
          {data.items.map((t) => (
            <Panel key={t.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Money value={t.amount} className="text-xl font-semibold" />
                    <span className="text-sm text-kosh-muted">{TXN_TYPE_LABEL[t.type]} · <span className="amount">{t.reference}</span></span>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="text-sm">
                    {party(t.senderAccount, "Cash")} <span className="text-kosh-muted">→</span> {party(t.receiverAccount, "Cash")}
                  </p>
                  <p className="flex items-start gap-2 rounded-xl bg-[var(--kosh-pending-bg)] px-3 py-2 text-sm text-[var(--kosh-pending-fg)]">
                    <Flag className="mt-0.5 size-4 shrink-0" /> {t.flagReason}
                  </p>
                  <p className="text-xs text-kosh-muted">
                    {formatDateTime(t.createdAt)}
                    {t.flaggedBy ? ` · flagged by ${t.flaggedBy.name}` : " · auto-flagged"}
                    {t.flagResolvedAt && ` · resolved ${formatDateTime(t.flagResolvedAt)}`}
                    {t.reversal && ` · reversed by ${t.reversal.reference}`}
                  </p>
                </div>
                {state === "open" && (
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" onPress={() => setTarget({ t, action: "resolve" })}><CheckCircle2 className="size-4" /> Looks fine</Button>
                    {t.status === "COMPLETED" && ["TRANSFER", "DEPOSIT", "WITHDRAWAL"].includes(t.type) && (
                      <Button variant="danger-soft" onPress={() => setTarget({ t, action: "reverse" })}><RotateCcw className="size-4" /> Reverse</Button>
                    )}
                  </div>
                )}
              </div>
            </Panel>
          ))}
          {pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-kosh-muted">Page {page} of {pages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" isDisabled={page <= 1} onPress={() => setPage(page - 1)}>Previous</Button>
                <Button size="sm" variant="outline" isDisabled={page >= pages} onPress={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {target?.action === "resolve" && (
        <ReasonDialog
          open
          onClose={() => setTarget(null)}
          title="Clear this flag?"
          description="The transaction stays as it is; your note is recorded in the audit log."
          confirmLabel="Clear flag"
          label="Review note"
          placeholder="e.g. Customer confirmed by phone"
          onConfirm={async (note) => { await resolve({ id: target.t.id, note }).unwrap(); toast.success("Flag cleared"); }}
        />
      )}
      {target?.action === "reverse" && (
        <ReasonDialog
          open
          onClose={() => setTarget(null)}
          tone="danger"
          title={`Reverse ${target.t.reference}?`}
          description={`${formatMoney(target.t.amount)}${target.t.fee !== "0" ? ` + ${formatMoney(target.t.fee)} fee` : ""} goes back to the sender through a compensating transaction. The flag is closed.`}
          confirmLabel="Reverse"
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
