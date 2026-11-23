"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Button, Modal, toast } from "@heroui/react";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { useGetMyLoanQuery, useRepayLoanMutation } from "@/store/api/loansApi";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonBlock } from "@/components/ui/Skeletons";
import { PinInput } from "@/components/ui/PinInput";
import { LoanProgress, ScheduleTable, loanLabel } from "@/components/loans/LoanBits";
import { EMPLOYMENT_LABELS } from "@/lib/loan-products";
import { errorCode, errorMessage, newIdempotencyKey } from "@/lib/client";
import { formatBps } from "@/lib/money";
import { formatDate, maskAccountNumber, titleCase } from "@/lib/format";

const TIMELINE = ["PENDING", "UNDER_REVIEW", "ACTIVE", "COMPLETED"] as const;

export default function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: loan, isLoading, error } = useGetMyLoanQuery(id);
  const [repay, repayState] = useRepayLoanMutation();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [key, setKey] = useState("");

  if (errorCode(error) === "NOT_FOUND") {
    return <Panel><EmptyState title="Loan not found" action={<Link href="/loans" className="text-kosh-info">Back to loans</Link>} /></Panel>;
  }
  if (isLoading || !loan) return <SkeletonBlock className="h-96 rounded-[20px]" />;

  const paid = loan.installments.filter((i) => i.status === "PAID").length;
  const next = loan.installments.find((i) => i.status !== "PAID");
  const stageIndex = loan.status === "REJECTED" ? -1 : TIMELINE.indexOf(loan.status as (typeof TIMELINE)[number]);

  async function pay(code = pin) {
    if (code.length !== 4) return;
    setPinError(null);
    try {
      const r = await repay({ id, pin: code, idempotencyKey: key }).unwrap();
      setOpen(false);
      setPin("");
      toast.success(r.completed ? "Loan fully repaid 🎉" : "EMI paid", { description: r.completed ? "Your loan is now closed." : "Thanks — your schedule is updated." });
    } catch (e) {
      setPin("");
      setPinError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/loans" className="inline-flex items-center gap-1.5 text-sm text-kosh-muted hover:text-kosh-text">
        <ArrowLeft className="size-4" /> Loans
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-[22px] bg-kosh-navy p-6 text-kosh-navy-fg sm:p-7">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/70">{loanLabel(loan.loanType)} · {formatBps(loan.interestRateBps)} · {loan.durationMonths} months</p>
            <StatusBadge status={loan.status} label={loan.status === "UNDER_REVIEW" ? "Under review" : undefined} />
          </div>
          <p className="mt-4 text-sm text-white/60">{loan.status === "ACTIVE" ? "Remaining to repay" : "Principal"}</p>
          <Money value={loan.status === "ACTIVE" ? loan.remainingBalance : loan.principal} className="block text-4xl font-semibold" />
          {loan.status === "ACTIVE" && (
            <>
              <LoanProgress paid={paid} total={loan.installments.length} className="mt-5 [&_*]:text-white/70" />
              {next && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/10 p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarClock className="size-4 text-kosh-accent-soft" />
                    <span>
                      EMI #{next.installmentNo} {next.status === "OVERDUE" ? <span className="font-semibold text-[#FCA5A5]">overdue</span> : "due"} {formatDate(next.dueDate)} —{" "}
                      <Money value={next.amountDue} className="font-semibold" />
                    </span>
                  </div>
                  <Button className="bg-kosh-accent text-kosh-accent-fg" onPress={() => { setKey(newIdempotencyKey()); setPinError(null); setOpen(true); }}>
                    Pay EMI
                  </Button>
                </div>
              )}
            </>
          )}
          {loan.status === "REJECTED" && <p className="mt-4 rounded-2xl bg-white/10 p-4 text-sm">Reason: {loan.rejectionReason}</p>}
        </section>

        <Panel className="p-6">
          <h2 className="text-base font-semibold">Application</h2>
          {loan.status !== "REJECTED" && (
            <ol className="mt-4 flex items-center gap-2 text-xs">
              {TIMELINE.map((s, i) => (
                <li key={s} className="flex flex-1 flex-col gap-1.5">
                  <span className={`h-1.5 rounded-full ${i <= stageIndex ? "bg-kosh-accent" : "bg-kosh-border"}`} />
                  <span className={i <= stageIndex ? "font-medium" : "text-kosh-muted"}>{s === "UNDER_REVIEW" ? "Review" : titleCase(s)}</span>
                </li>
              ))}
            </ol>
          )}
          <dl className="mt-5 space-y-3 text-sm">
            {(
              [
                ["Monthly EMI", loan.emiAmount ? <Money key="e" value={loan.emiAmount} /> : "—"],
                ["Total payable", loan.totalPayable ? <Money key="t" value={loan.totalPayable} /> : "Set at approval"],
                ["Account", `${loan.account.nickname ?? titleCase(loan.account.type)} ${maskAccountNumber(loan.account.accountNumber)}`],
                ["Employment", EMPLOYMENT_LABELS[loan.employmentStatus]],
                ["Monthly income", <Money key="i" value={loan.monthlyIncome} />],
                ["Applied", formatDate(loan.createdAt)],
                ...(loan.disbursementTxn ? [["Disbursed", <Link key="d" href={`/transactions/${loan.disbursementTxn.id}`} className="amount text-kosh-info hover:underline">{loan.disbursementTxn.reference}</Link>]] : []),
              ] as [string, React.ReactNode][]
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-kosh-muted">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
          {loan.description && <p className="mt-4 rounded-xl bg-kosh-subtle p-3 text-sm text-kosh-muted">{loan.description}</p>}
        </Panel>
      </div>

      {loan.installments.length > 0 && (
        <Panel>
          <PanelHeader title="Repayment schedule" description="Reducing-balance EMI — interest falls as you repay." />
          <div className="mt-3"><ScheduleTable rows={loan.installments} /></div>
        </Panel>
      )}

      <Modal.Backdrop isOpen={open} onOpenChange={(o) => { if (!repayState.isLoading) setOpen(o); }}>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog>
            <Modal.Header><Modal.Heading>Pay EMI #{next?.installmentNo}</Modal.Heading></Modal.Header>
            <Modal.Body>
              <p className="text-sm text-kosh-muted">
                <Money value={next?.amountDue ?? "0"} className="font-semibold text-kosh-text" /> will be debited from {maskAccountNumber(loan.account.accountNumber)}.
              </p>
              <div className="mt-4 flex justify-center">
                <PinInput value={pin} onChange={setPin} onComplete={(v) => pay(v)} isInvalid={Boolean(pinError)} autoFocus />
              </div>
              {pinError && <p className="mt-3 text-center text-sm text-danger" role="alert">{pinError}</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => setOpen(false)} isDisabled={repayState.isLoading}>Cancel</Button>
              <Button onPress={() => pay()} isPending={repayState.isLoading} isDisabled={pin.length !== 4}>Pay now</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
