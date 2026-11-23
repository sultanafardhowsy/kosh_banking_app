"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Input, Label, TextField, TextArea, toast } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { useGetMeQuery } from "@/store/api/meApi";
import { useApplyLoanMutation } from "@/store/api/loansApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { resetWizard, selectLoanDraft, selectWizardStep, setWizardStep, updateDraft, type LoanDraft } from "@/store/slices/loanSlice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Money } from "@/components/ui/Money";
import { EMPLOYMENT_LABELS, LOAN_PRODUCTS, MAX_EMI_TO_INCOME_PCT, type LoanProductKey } from "@/lib/loan-products";
import { buildSchedule } from "@/lib/emi";
import { formatBps, formatMoney, takaToPaisa } from "@/lib/money";
import { errorMessage } from "@/lib/client";
import { cn, maskAccountNumber, titleCase } from "@/lib/format";

const STEPS = ["Loan", "About you", "Review"];

function safePaisa(v?: string) {
  try {
    return v ? takaToPaisa(v) : null;
  } catch {
    return null;
  }
}

/** Multi-step application; the draft lives in Redux (loanSlice) so it survives navigation. */
export default function ApplyLoanPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectWizardStep);
  const draft = useAppSelector(selectLoanDraft);
  const { data: me } = useGetMeQuery();
  const [apply, state] = useApplyLoanMutation();
  const [error, setError] = useState<string | null>(null);

  const type = (draft.loanType ?? "PERSONAL") as LoanProductKey;
  const product = LOAN_PRODUCTS[type];
  const months = draft.durationMonths ?? Math.min(12, product.maxMonths);
  const principal = safePaisa(draft.amount);
  const income = safePaisa(draft.monthlyIncome);
  const accounts = (me?.accounts ?? []).filter((a) => a.status === "ACTIVE");
  const accountId = draft.accountId ?? accounts[0]?.id ?? "";

  const set = (p: Partial<LoanDraft>) => dispatch(updateDraft(p));

  const amountError = (() => {
    if (!draft.amount) return null;
    if (principal === null) return "Enter a whole amount, e.g. 150000";
    const t = Number(principal / BigInt(100));
    if (t < product.minTaka || t > product.maxTaka) return `${product.label} loans: ৳${product.minTaka.toLocaleString("en-IN")} – ৳${product.maxTaka.toLocaleString("en-IN")}`;
    return null;
  })();

  const calc = useMemo(() => {
    if (!principal || amountError) return null;
    try {
      return buildSchedule(principal, product.rateBps, months, new Date());
    } catch {
      return null;
    }
  }, [principal, amountError, product.rateBps, months]);

  const emiShare = calc && income && income > BigInt(0) ? Number((calc.emi * BigInt(10000)) / income) / 100 : null;

  const step1Ok = Boolean(calc);
  const step2Ok = Boolean(income && income > BigInt(0) && draft.employmentStatus && accountId && (draft.description ?? "").trim().length >= 5);

  async function submit() {
    if (!principal || !income || !draft.employmentStatus) return;
    setError(null);
    try {
      const loan = await apply({
        loanType: type,
        accountId,
        principal: principal.toString(),
        durationMonths: months,
        monthlyIncome: income.toString(),
        employmentStatus: draft.employmentStatus,
        description: (draft.description ?? "").trim(),
      }).unwrap();
      dispatch(resetWizard());
      toast.success("Application submitted", { description: "We'll notify you as it moves through review." });
      router.push(`/loans/${loan.id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/loans" className="mb-4 inline-flex items-center gap-1.5 text-sm text-kosh-muted hover:text-kosh-text">
        <ArrowLeft className="size-4" /> Loans
      </Link>
      <PageHeader title="Apply for a loan" description="Rates are fixed per product. You'll see your exact EMI before submitting." />

      <ol className="mb-6 grid grid-cols-3 gap-2">
        {STEPS.map((s, i) => (
          <li key={s}>
            <div className={cn("h-1.5 rounded-full", i <= step ? "bg-kosh-accent" : "bg-kosh-border")} />
            <p className={cn("mt-1.5 text-xs font-medium", i <= step ? "text-kosh-text" : "text-kosh-muted")}>{s}</p>
          </li>
        ))}
      </ol>

      {me && !me.user.isVerified && (
        <Alert status="warning" className="mb-4">
          <Alert.Content><Alert.Description>Your profile must be verified by Kosh staff before you can apply.</Alert.Description></Alert.Content>
        </Alert>
      )}
      {error && (
        <Alert status="danger" className="mb-4">
          <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
        </Alert>
      )}

      <Panel className="p-5 sm:p-6">
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">Loan type</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(Object.keys(LOAN_PRODUCTS) as LoanProductKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set({ loanType: k, durationMonths: Math.min(Math.max(months, LOAN_PRODUCTS[k].minMonths), LOAN_PRODUCTS[k].maxMonths) })}
                    aria-pressed={k === type}
                    className={cn(
                      "rounded-2xl border p-3 text-left transition",
                      k === type ? "border-kosh-accent bg-kosh-accent/5 ring-1 ring-kosh-accent" : "border-kosh-border hover:bg-kosh-subtle",
                    )}
                  >
                    <p className="text-sm font-semibold">{LOAN_PRODUCTS[k].label}</p>
                    <p className="text-xs text-kosh-muted">{formatBps(LOAN_PRODUCTS[k].rateBps)} p.a.</p>
                  </button>
                ))}
              </div>
            </div>
            <TextField value={draft.amount ?? ""} onChange={(v) => set({ amount: v })} isInvalid={Boolean(amountError)} fullWidth>
              <Label>Amount (৳)</Label>
              <Input inputMode="numeric" placeholder={`${product.minTaka.toLocaleString("en-IN")} – ${product.maxTaka.toLocaleString("en-IN")}`} />
              {amountError && <p className="text-xs text-danger">{amountError}</p>}
            </TextField>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="months" className="text-sm font-medium">Duration</label>
                <span className="text-sm font-semibold">{months} months</span>
              </div>
              <input
                id="months"
                type="range"
                min={product.minMonths}
                max={product.maxMonths}
                step={product.minMonths >= 12 ? 12 : 6}
                value={months}
                onChange={(e) => set({ durationMonths: Number(e.target.value) })}
                className="mt-2 w-full accent-[var(--kosh-accent)]"
              />
              <div className="flex justify-between text-xs text-kosh-muted">
                <span>{product.minMonths}</span>
                <span>{product.maxMonths}</span>
              </div>
            </div>
            <div className="rounded-2xl bg-kosh-navy p-5 text-kosh-navy-fg">
              <p className="text-sm text-white/70">Monthly EMI</p>
              <p className="amount mt-1 text-3xl font-semibold">{calc ? formatMoney(calc.emi) : "—"}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-white/70">
                <span>Total interest <span className="block font-medium text-white">{calc && principal ? formatMoney(calc.totalPayable - principal) : "—"}</span></span>
                <span>Total payable <span className="block font-medium text-white">{calc ? formatMoney(calc.totalPayable) : "—"}</span></span>
              </div>
            </div>
            <Button fullWidth size="lg" isDisabled={!step1Ok} onPress={() => { set({ loanType: type, durationMonths: months }); dispatch(setWizardStep(1)); }}>
              Continue
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <TextField value={draft.monthlyIncome ?? ""} onChange={(v) => set({ monthlyIncome: v })} fullWidth>
              <Label>Monthly income (৳)</Label>
              <Input inputMode="numeric" placeholder="e.g. 60000" />
            </TextField>
            {emiShare !== null && (
              <p className={cn("text-xs", emiShare > MAX_EMI_TO_INCOME_PCT ? "text-danger" : "text-kosh-muted")}>
                The EMI would be {emiShare.toFixed(1)}% of your income{emiShare > MAX_EMI_TO_INCOME_PCT ? ` — above the ${MAX_EMI_TO_INCOME_PCT}% we usually approve.` : "."}
              </p>
            )}
            <NativeSelect
              label="Employment"
              value={draft.employmentStatus ?? ""}
              onChange={(e) => set({ employmentStatus: e.target.value as LoanDraft["employmentStatus"] })}
              options={[{ value: "", label: "Choose…" }, ...Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => ({ value, label }))]}
            />
            <NativeSelect
              label="Disburse to & repay from"
              value={accountId}
              onChange={(e) => set({ accountId: e.target.value })}
              options={accounts.map((a) => ({ value: a.id, label: `${a.nickname ?? titleCase(a.type)} ${maskAccountNumber(a.accountNumber)}` }))}
            />
            <TextField value={draft.description ?? ""} onChange={(v) => set({ description: v })} fullWidth>
              <Label>What is the loan for?</Label>
              <TextArea rows={3} placeholder="e.g. Home renovation — kitchen and bathroom" />
            </TextField>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onPress={() => dispatch(setWizardStep(0))}>Back</Button>
              <Button className="flex-1" isDisabled={!step2Ok} onPress={() => { set({ accountId }); dispatch(setWizardStep(2)); }}>Review</Button>
            </div>
          </div>
        )}

        {step === 2 && calc && principal && income && (
          <div>
            <dl className="divide-y divide-kosh-border rounded-2xl border border-kosh-border text-sm">
              {(
                [
                  ["Product", `${product.label} · ${formatBps(product.rateBps)} p.a.`],
                  ["Amount", <Money key="p" value={principal} className="font-semibold" />],
                  ["Duration", `${months} months`],
                  ["Monthly EMI", <Money key="e" value={calc.emi} className="font-semibold" />],
                  ["Total payable", <Money key="t" value={calc.totalPayable} />],
                  ["Monthly income", <Money key="i" value={income} />],
                  ["Employment", draft.employmentStatus ? EMPLOYMENT_LABELS[draft.employmentStatus] : "—"],
                  ["Account", (() => { const a = accounts.find((x) => x.id === accountId); return a ? `${a.nickname ?? titleCase(a.type)} ${maskAccountNumber(a.accountNumber)}` : "—"; })()],
                  ["Purpose", draft.description],
                ] as [string, React.ReactNode][]
              ).map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 px-4 py-3">
                  <dt className="text-kosh-muted">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-kosh-muted">
              Staff review your application first, then the credit team decides. If approved, the money is credited immediately and your first EMI is due a month later.
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onPress={() => dispatch(setWizardStep(1))}>Back</Button>
              <Button className="flex-1" onPress={submit} isPending={state.isLoading} isDisabled={me ? !me.user.isVerified : true}>
                Submit application
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
