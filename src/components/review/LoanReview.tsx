"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Label, TextArea, TextField, toast } from "@heroui/react";
import { ArrowLeft, BadgeCheck, Forward, MessageSquare, ShieldAlert } from "lucide-react";
import { useAddLoanNoteMutation, useDecideLoanMutation, useForwardLoanMutation, useGetLoanReviewQuery } from "@/store/api/loansApi";
import { useAppSelector } from "@/store/hooks";
import { selectUser } from "@/store/slices/authSlice";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonBlock } from "@/components/ui/Skeletons";
import { LoanProgress, ScheduleTable, loanLabel } from "@/components/loans/LoanBits";
import { EMPLOYMENT_LABELS, MAX_EMI_TO_INCOME_PCT } from "@/lib/loan-products";
import { errorCode, errorMessage } from "@/lib/client";
import { formatBps, formatMoney } from "@/lib/money";
import { cn, formatDate, formatDateTime, maskAccountNumber, titleCase } from "@/lib/format";

/**
 * Loan review screen. Staff: notes + forward. Admin: notes + approve/reject.
 * Every button here is backed by a server-side role + not-self check.
 */
export function LoanReview({ id, scope }: { id: string; scope: "staff" | "admin" }) {
  const me = useAppSelector(selectUser);
  const { data: loan, isLoading, error } = useGetLoanReviewQuery(id);
  const [addNote, noteState] = useAddLoanNoteMutation();
  const [forward, forwardState] = useForwardLoanMutation();
  const [decide, decideState] = useDecideLoanMutation();
  const [note, setNote] = useState("");
  const [dialog, setDialog] = useState<"forward" | "approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  if (errorCode(error) === "NOT_FOUND") return <Panel><EmptyState title="Loan not found" /></Panel>;
  if (isLoading || !loan) return <SkeletonBlock className="h-[600px] rounded-[20px]" />;

  const own = loan.user.id === me?.id;
  const open = loan.status === "PENDING" || loan.status === "UNDER_REVIEW";
  const pct = loan.insight.emiToIncomePct;
  const paid = loan.installments.filter((i) => i.status === "PAID").length;

  async function submitNote() {
    if (note.trim().length < 3) return;
    try {
      await addNote({ id, note: note.trim() }).unwrap();
      setNote("");
    } catch {
      /* toast via middleware */
    }
  }

  async function runDialog() {
    setDialogError(null);
    try {
      if (dialog === "forward") await forward(id).unwrap();
      if (dialog === "approve") await decide({ id, action: "approve" }).unwrap();
      if (dialog === "reject") await decide({ id, action: "reject", reason }).unwrap();
      toast.success(dialog === "forward" ? "Forwarded for decision" : dialog === "approve" ? "Loan approved and disbursed" : "Loan rejected");
      setDialog(null);
      setReason("");
    } catch (e) {
      setDialogError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <Link href={`/${scope}/loans`} className="inline-flex items-center gap-1.5 text-sm text-kosh-muted hover:text-kosh-text">
        <ArrowLeft className="size-4" /> Loans
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{loanLabel(loan.loanType)}</h1>
            <StatusBadge status={loan.status} label={loan.status === "UNDER_REVIEW" ? "Under review" : undefined} />
          </div>
          <p className="mt-1 text-sm text-kosh-muted">
            {loan.user.name} · applied {formatDate(loan.createdAt)}
            {loan.forwardedBy && ` · forwarded by ${loan.forwardedBy.name}`}
            {loan.approvedBy && ` · decided by ${loan.approvedBy.name}`}
          </p>
        </div>
        {open && !own && (
          <div className="flex gap-2">
            {loan.status === "PENDING" && (
              <Button variant={scope === "staff" ? "primary" : "outline"} onPress={() => { setDialogError(null); setDialog("forward"); }} isDisabled={loan.notes.length === 0}>
                <Forward className="size-4" /> Forward to admin
              </Button>
            )}
            {scope === "admin" && (
              <>
                <Button variant="danger-soft" onPress={() => { setDialogError(null); setDialog("reject"); }}>Reject</Button>
                <Button onPress={() => { setDialogError(null); setDialog("approve"); }}>Approve & disburse</Button>
              </>
            )}
          </div>
        )}
      </div>
      {own && <p className="rounded-xl bg-[var(--kosh-pending-bg)] px-4 py-3 text-sm text-[var(--kosh-pending-fg)]">This is your own application — another colleague must review it.</p>}
      {open && loan.status === "PENDING" && loan.notes.length === 0 && !own && (
        <p className="text-sm text-kosh-muted">Add a review note before forwarding.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="p-6 lg:col-span-2">
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs text-kosh-muted">Principal</p>
              <Money value={loan.principal} className="text-2xl font-semibold" />
            </div>
            <div>
              <p className="text-xs text-kosh-muted">EMI · {loan.durationMonths} months</p>
              <Money value={loan.insight.emi} className="text-2xl font-semibold" />
            </div>
            <div>
              <p className="text-xs text-kosh-muted">Rate</p>
              <p className="amount text-2xl font-semibold">{formatBps(loan.interestRateBps)}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className={cn("rounded-2xl p-4", pct !== null && pct > MAX_EMI_TO_INCOME_PCT ? "bg-[var(--kosh-danger-bg)]" : "bg-kosh-subtle")}>
              <p className="text-xs text-kosh-muted">EMI / income</p>
              <p className={cn("amount text-xl font-semibold", pct !== null && pct > MAX_EMI_TO_INCOME_PCT && "text-[var(--kosh-danger-fg)]")}>{pct !== null ? `${pct.toFixed(1)}%` : "—"}</p>
              <p className="text-xs text-kosh-muted">guide ≤ {MAX_EMI_TO_INCOME_PCT}%</p>
            </div>
            <div className="rounded-2xl bg-kosh-subtle p-4">
              <p className="text-xs text-kosh-muted">Stated income</p>
              <Money value={loan.monthlyIncome} className="text-xl font-semibold" />
              <p className="text-xs text-kosh-muted">{EMPLOYMENT_LABELS[loan.employmentStatus]}</p>
            </div>
            <div className="rounded-2xl bg-kosh-subtle p-4">
              <p className="text-xs text-kosh-muted">Money in, last 90 days</p>
              <Money value={loan.insight.inflow90d} className="text-xl font-semibold" />
              <p className="text-xs text-kosh-muted">all accounts</p>
            </div>
          </div>

          {loan.description && (
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-kosh-muted">Purpose</p>
              <p className="mt-1 text-sm">{loan.description}</p>
            </div>
          )}
          {loan.rejectionReason && (
            <p className="mt-6 rounded-xl bg-[var(--kosh-danger-bg)] px-4 py-3 text-sm text-[var(--kosh-danger-fg)]">Rejected: {loan.rejectionReason}</p>
          )}
          {loan.status === "ACTIVE" && <LoanProgress paid={paid} total={loan.installments.length} className="mt-6" />}
        </Panel>

        <Panel className="p-6">
          <h2 className="font-semibold">Applicant</h2>
          <div className="mt-3 space-y-2 text-sm">
            <p className="flex items-center gap-1.5 font-medium">
              {loan.user.name}
              {loan.user.isVerified ? <BadgeCheck className="size-4 text-kosh-money-in" aria-label="Verified" /> : <ShieldAlert className="size-4 text-[var(--kosh-pending-fg)]" aria-label="Unverified" />}
            </p>
            <p className="text-kosh-muted">{loan.user.email}</p>
            {loan.user.profile?.phone && <p className="text-kosh-muted">{loan.user.profile.phone}</p>}
            <p className="text-kosh-muted">Customer since {formatDate(loan.user.createdAt)}</p>
            {loan.user.status !== "ACTIVE" && <StatusBadge status={loan.user.status} />}
          </div>
          <div className="mt-5 rounded-2xl bg-kosh-subtle p-4 text-sm">
            <p className="text-xs text-kosh-muted">Disbursement account</p>
            <p className="mt-1 font-medium">{loan.account.nickname ?? titleCase(loan.account.type)} <span className="amount text-kosh-muted">{maskAccountNumber(loan.account.accountNumber)}</span></p>
            <p className="mt-1 text-kosh-muted">Balance {formatMoney(loan.account.balance)}</p>
            {loan.account.status !== "ACTIVE" && <StatusBadge status={loan.account.status} className="mt-2" />}
          </div>
          {loan.otherLoans.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-kosh-muted">Other loans</p>
              <ul className="mt-2 space-y-2 text-sm">
                {loan.otherLoans.map((o) => (
                  <li key={o.id} className="flex items-center justify-between">
                    <span>{loanLabel(o.loanType)} <Money value={o.principal} className="text-kosh-muted" /></span>
                    <StatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Review notes" description="Internal — never shown to the customer." />
        <div className="p-5 sm:p-6">
          {loan.notes.length === 0 ? (
            <p className="text-sm text-kosh-muted">No notes yet.</p>
          ) : (
            <ul className="space-y-4">
              {loan.notes.map((n) => (
                <li key={n.id} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-kosh-subtle"><MessageSquare className="size-4 text-kosh-muted" /></span>
                  <div>
                    <p className="text-sm"><span className="font-medium">{n.author.name}</span> <span className="text-xs text-kosh-muted">· {titleCase(n.author.role)} · {formatDateTime(n.createdAt)}</span></p>
                    <p className="mt-0.5 text-sm text-kosh-muted">{n.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!own && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end">
              <TextField value={note} onChange={setNote} fullWidth className="flex-1">
                <Label>Add a note</Label>
                <TextArea rows={2} placeholder="e.g. Salary deposits match stated income" />
              </TextField>
              <Button onPress={submitNote} isPending={noteState.isLoading} isDisabled={note.trim().length < 3}>Add note</Button>
            </div>
          )}
        </div>
      </Panel>

      {loan.installments.length > 0 && (
        <Panel>
          <PanelHeader title="Repayment schedule" description={loan.disbursementTxn ? `Disbursed · ${loan.disbursementTxn.reference}` : undefined} />
          <div className="mt-3"><ScheduleTable rows={loan.installments} /></div>
        </Panel>
      )}

      <ConfirmDialog
        isOpen={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog === "approve" ? "Approve and disburse?" : dialog === "reject" ? "Reject application?" : "Forward to admin?"}
        tone={dialog === "reject" ? "danger" : "primary"}
        confirmLabel={dialog === "approve" ? `Disburse ${formatMoney(loan.principal)}` : dialog === "reject" ? "Reject" : "Forward"}
        isLoading={forwardState.isLoading || decideState.isLoading}
        onConfirm={runDialog}
        description={
          dialog === "approve"
            ? `${formatMoney(loan.principal)} will be credited to ${maskAccountNumber(loan.account.accountNumber)} now, and a ${loan.durationMonths}-month EMI schedule of ${formatMoney(loan.insight.emi)} will be created.`
            : dialog === "reject"
              ? "The customer is notified with your reason."
              : "The application moves to Under review for an admin decision."
        }
      >
        {dialog === "reject" && (
          <TextField value={reason} onChange={setReason} fullWidth className="mt-3">
            <Label>Reason for the customer</Label>
            <TextArea rows={2} />
          </TextField>
        )}
        {dialogError && <p className="mt-2 text-sm text-danger" role="alert">{dialogError}</p>}
      </ConfirmDialog>
    </div>
  );
}
