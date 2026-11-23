"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, Button } from "@heroui/react";
import { ArrowLeft, Check, CircleAlert, ShieldCheck } from "lucide-react";
import { useGetMeQuery } from "@/store/api/meApi";
import { usePreviewTransferMutation, useTransferMutation } from "@/store/api/transactionsApi";
import { useAppSelector } from "@/store/hooks";
import { selectSelectedAccountId } from "@/store/slices/accountSlice";
import { Panel } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormTextField } from "@/components/ui/FormTextField";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { PinInput } from "@/components/ui/PinInput";
import { Money } from "@/components/ui/Money";
import { TwoFactorCancelled, useTwoFactor } from "@/components/security/TwoFactorDialog";
import { errorCode, errorDetails, errorMessage, newIdempotencyKey } from "@/lib/client";
import { formatMoney, takaToPaisa } from "@/lib/money";
import { cn, formatAccountNumber, formatDateTime, maskAccountNumber, titleCase } from "@/lib/format";
import type { TransferPreview, TransferResult } from "@/types/api";

const detailsSchema = z.object({
  fromAccountId: z.string().min(1, "Choose an account"),
  toAccountNumber: z
    .string()
    .transform((s) => s.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{12}$/, "Enter the 12-digit account number")),
  amount: z.string().refine((v) => {
    try {
      return takaToPaisa(v) > BigInt(0);
    } catch {
      return false;
    }
  }, "Enter an amount like 1500 or 1500.50"),
  description: z.string().max(140, "Keep it under 140 characters"),
});
type DetailsIn = z.input<typeof detailsSchema>;
type Details = z.output<typeof detailsSchema>;

const STEPS = ["Details", "Review", "PIN", "Done"] as const;

export function TransferFlow() {
  const { data: me } = useGetMeQuery();
  const selected = useAppSelector(selectSelectedAccountId);
  const accounts = useMemo(() => (me?.accounts ?? []).filter((a) => a.status === "ACTIVE"), [me]);

  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<Details | null>(null);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [result, setResult] = useState<TransferResult | null>(null);
  const [idemKey, setIdemKey] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [runPreview, previewState] = usePreviewTransferMutation();
  const [runTransfer, transferState] = useTransferMutation();
  const twoFactor = useTwoFactor();

  const form = useForm<DetailsIn, unknown, Details>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { fromAccountId: "", toAccountNumber: "", amount: "", description: "" },
  });

  // Default "from" = the account picked in the top-bar switcher
  useEffect(() => {
    if (!form.getValues("fromAccountId") && accounts.length) {
      form.setValue("fromAccountId", accounts.find((a) => a.id === selected)?.id ?? accounts[0]!.id);
    }
  }, [accounts, selected, form]);

  const from = accounts.find((a) => a.id === form.watch("fromAccountId"));

  async function onDetails(d: Details) {
    setError(null);
    try {
      const p = await runPreview({ fromAccountId: d.fromAccountId, toAccountNumber: d.toAccountNumber, amount: takaToPaisa(d.amount).toString() }).unwrap();
      setDetails(d);
      setPreview(p);
      setIdemKey(newIdempotencyKey()); // one key per confirmed intent; reused on retry
      setStep(1);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function submit(code = pin) {
    if (!details || code.length !== 4) return;
    setError(null);
    const body = {
      fromAccountId: details.fromAccountId,
      toAccountNumber: details.toAccountNumber,
      amount: takaToPaisa(details.amount).toString(),
      description: details.description,
      pin: code,
      idempotencyKey: idemKey,
    };
    try {
      // Large transfer → confirm with the emailed code (the server enforces this too).
      const r = preview?.otpRequired
        ? await twoFactor.run(
            { purpose: "TRANSFER", fromAccountId: body.fromAccountId, toAccountNumber: body.toAccountNumber, amount: body.amount },
            (otp) => runTransfer({ ...body, otp }).unwrap(),
          )
        : await runTransfer(body).unwrap();
      setResult(r);
      setStep(3);
    } catch (e) {
      setPin("");
      if (e instanceof TwoFactorCancelled) return; // stay on the PIN step
      const c = errorCode(e);
      if (c === "INVALID_PIN") {
        const left = errorDetails<{ attemptsLeft: number }>(e)?.attemptsLeft;
        setError(`Incorrect PIN.${left !== undefined ? ` ${left} attempt${left === 1 ? "" : "s"} left before it locks.` : ""}`);
      } else if (c === "PIN_LOCKED" || c === "PIN_NOT_SET") {
        setError(errorMessage(e));
      } else {
        // balance/limit/status changed since the review — back to details
        setError(errorMessage(e));
        setStep(0);
      }
    }
  }

  function reset() {
    form.reset({ fromAccountId: details?.fromAccountId ?? "", toAccountNumber: "", amount: "", description: "" });
    setDetails(null);
    setPreview(null);
    setResult(null);
    setPin("");
    setError(null);
    setStep(0);
  }

  return (
    <div className="mx-auto max-w-xl">
      {twoFactor.dialog}
      <PageHeader title="Transfer money" description="Send to any Kosh account. Fees and limits are checked before you confirm." />

      {/* Stepper */}
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}>
            <div className={cn("h-1.5 rounded-full", i <= step ? "bg-kosh-accent" : "bg-kosh-border")} />
            <p className={cn("mt-1.5 text-xs font-medium", i <= step ? "text-kosh-text" : "text-kosh-muted")}>{s}</p>
          </li>
        ))}
      </ol>

      {error && step !== 2 && (
        <Alert status="danger" className="mb-4">
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Panel className="p-5 sm:p-6">
        {step === 0 && (
          <form onSubmit={form.handleSubmit(onDetails)} className="space-y-4" noValidate>
            {accounts.length === 0 ? (
              <p className="text-sm text-kosh-muted">You have no active account to send from.</p>
            ) : (
              <NativeSelect
                label="From"
                {...form.register("fromAccountId")}
                error={form.formState.errors.fromAccountId?.message}
                options={accounts.map((a) => ({
                  value: a.id,
                  label: `${a.nickname ?? titleCase(a.type)} ${maskAccountNumber(a.accountNumber)} — ${formatMoney(a.balance)}`,
                }))}
              />
            )}
            {from && !from.hasPin && (
              <p className="flex items-center gap-1.5 text-xs text-[var(--kosh-pending-fg)]">
                <CircleAlert className="size-3.5" /> This account has no PIN yet.{" "}
                <Link href="/profile" className="font-medium underline">Set one</Link>
              </p>
            )}
            <FormTextField control={form.control} name="toAccountNumber" label="To account number" inputMode="numeric" placeholder="1012 3456 7890" autoComplete="off" />
            <FormTextField control={form.control} name="amount" label="Amount (৳)" inputMode="decimal" placeholder="0.00" autoComplete="off" />
            <FormTextField control={form.control} name="description" label="Note (optional)" placeholder="What's it for?" />
            <Button type="submit" fullWidth size="lg" isPending={previewState.isLoading} isDisabled={!accounts.length}>
              Review transfer
            </Button>
          </form>
        )}

        {step === 1 && preview && details && (
          <div>
            <div className="text-center">
              <p className="text-sm text-kosh-muted">You&apos;re sending</p>
              <Money value={preview.amount} className="mt-1 block text-4xl font-semibold" />
              <p className="mt-2 text-sm">
                to <span className="font-semibold">{preview.recipient.name}</span>{" "}
                <span className="amount text-kosh-muted">{preview.recipient.accountNumber}</span>
              </p>
            </div>
            <dl className="mt-6 divide-y divide-kosh-border rounded-2xl border border-kosh-border text-sm">
              {[
                ["Amount", <Money key="a" value={preview.amount} />],
                ["Transfer fee", <Money key="f" value={preview.fee} />],
                ["Total debited", <Money key="t" value={preview.total} className="font-semibold" />],
                ["Balance after", <Money key="b" value={preview.balanceAfter} />],
                ["Daily limit left after this", <Money key="d" value={preview.remainingDailyLimit} />],
                ...(details.description ? [["Note", details.description] as [string, string]] : []),
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-kosh-muted">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
            {preview.otpRequired && (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-kosh-subtle px-4 py-3 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-kosh-info" />
                This is a large transfer, so after your PIN we&apos;ll email you a one-time code to confirm it.
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onPress={() => setStep(0)} className="flex-1">
                <ArrowLeft className="size-4" /> Edit
              </Button>
              <Button onPress={() => { setError(null); setStep(2); }} className="flex-1">
                Confirm
              </Button>
            </div>
          </div>
        )}

        {step === 2 && preview && (
          <div className="flex flex-col items-center text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-kosh-subtle">
              <ShieldCheck className="size-6 text-kosh-info" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">Enter your transaction PIN</h2>
            <p className="mt-1 text-sm text-kosh-muted">
              Authorise <span className="amount font-medium text-kosh-text">{formatMoney(preview.total)}</span> to {preview.recipient.name}
            </p>
            <div className="mt-6">
              <PinInput value={pin} onChange={setPin} onComplete={(v) => submit(v)} isInvalid={Boolean(error)} autoFocus />
            </div>
            {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
            <div className="mt-6 flex w-full gap-3">
              <Button variant="outline" onPress={() => { setPin(""); setError(null); setStep(1); }} className="flex-1" isDisabled={transferState.isLoading}>
                Back
              </Button>
              <Button onPress={() => submit()} className="flex-1" isPending={transferState.isLoading} isDisabled={pin.length !== 4}>
                Send money
              </Button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="flex flex-col items-center text-center">
            <span className="grid size-14 place-items-center rounded-full bg-[var(--kosh-success-bg)] text-kosh-money-in">
              <Check className="size-7" />
            </span>
            <h2 className="mt-4 text-xl font-semibold">Money sent</h2>
            <Money value={result.transaction.amount} className="mt-1 block text-3xl font-semibold" />
            {result.recipient && (
              <p className="mt-1 text-sm text-kosh-muted">
                to {result.recipient.name} <span className="amount">{result.recipient.accountNumber}</span>
              </p>
            )}
            <dl className="mt-6 w-full divide-y divide-kosh-border rounded-2xl border border-kosh-border text-left text-sm">
              {[
                ["Reference", <span key="r" className="amount">{result.transaction.reference}</span>],
                ["Fee", <Money key="f" value={result.transaction.fee} />],
                ["Date", formatDateTime(result.transaction.createdAt)],
                ...(result.balanceAfter ? [["Balance now", <Money key="b" value={result.balanceAfter} />] as [string, React.ReactNode]] : []),
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-kosh-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {result.replayed && <p className="mt-3 text-xs text-kosh-muted">This transfer was already completed — no money was sent twice.</p>}
            <div className="mt-6 flex w-full gap-3">
              <Link href={`/transactions/${result.transaction.id}`} className="button button--outline button--md flex-1">
                View receipt
              </Link>
              <Button onPress={reset} className="flex-1">
                New transfer
              </Button>
            </div>
          </div>
        )}
      </Panel>
      {step === 0 && from && (
        <p className="mt-3 text-center text-xs text-kosh-muted">
          Sending from {from.nickname ?? titleCase(from.type)} · {formatAccountNumber(from.accountNumber)}
        </p>
      )}
    </div>
  );
}
