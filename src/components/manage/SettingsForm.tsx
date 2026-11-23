"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Input, Label, TextField, toast } from "@heroui/react";
import { useGetSettingsQuery, useUpdateSettingsMutation } from "@/store/api/adminApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TwoFactorCancelled, useTwoFactor } from "@/components/security/TwoFactorDialog";
import { SkeletonBlock } from "@/components/ui/Skeletons";
import { computeTransferFee } from "@/lib/fees";
import { formatAmount, formatMoney, takaToPaisa } from "@/lib/money";
import { errorMessage } from "@/lib/client";
import { formatDateTime } from "@/lib/format";

type Draft = { daily: string; single: string; minBalance: string; feeFlat: string; feePct: string; feeMax: string; otp: string };
const toTaka = (p: string | null) => (p == null ? "" : formatAmount(p).replace(/,/g, "").replace(/\.00$/, ""));
const p = (v: string) => takaToPaisa(v);

export function SettingsForm() {
  const { data, isLoading } = useGetSettingsQuery();
  const [save, state] = useUpdateSettingsMutation();
  const twoFactor = useTwoFactor();
  const [d, setD] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setD({
        daily: toTaka(data.dailyTransferLimit),
        single: toTaka(data.maxSingleTransaction),
        minBalance: toTaka(data.minimumBalance),
        feeFlat: toTaka(data.transferFeeFlat),
        feePct: (data.transferFeePercentBps / 100).toString(),
        feeMax: toTaka(data.transferFeeMax),
        otp: toTaka(data.otpThreshold),
      });
    }
  }, [data]);

  const parsed = useMemo(() => {
    if (!d) return null;
    try {
      const pct = Number(d.feePct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 5 || Math.round(pct * 100) !== pct * 100) throw new Error("Fee % must be 0–5 with up to 2 decimals");
      const body = {
        dailyTransferLimit: p(d.daily).toString(),
        maxSingleTransaction: p(d.single).toString(),
        minimumBalance: p(d.minBalance || "0").toString(),
        transferFeeFlat: p(d.feeFlat || "0").toString(),
        transferFeePercentBps: Math.round(pct * 100),
        transferFeeMax: d.feeMax.trim() ? p(d.feeMax).toString() : null,
        otpThreshold: d.otp.trim() ? p(d.otp).toString() : null,
      };
      if (BigInt(body.maxSingleTransaction) > BigInt(body.dailyTransferLimit)) throw new Error("Max single transfer can't exceed the daily limit");
      return { body, error: null };
    } catch (e) {
      return { body: null, error: e instanceof Error ? (e.message === "Invalid amount" ? "Amounts must be numbers with up to 2 decimals" : e.message) : "Invalid values" };
    }
  }, [d]);

  if (isLoading || !d || !data) return <SkeletonBlock className="h-[520px] rounded-[20px]" />;

  const examples = parsed?.body
    ? [1_000, 10_000, 100_000].map((t) => ({
        t,
        fee: computeTransferFee(BigInt(t * 100), {
          transferFeeFlat: BigInt(parsed.body.transferFeeFlat),
          transferFeePercentBps: parsed.body.transferFeePercentBps,
          transferFeeMax: parsed.body.transferFeeMax ? BigInt(parsed.body.transferFeeMax) : null,
        }),
      }))
    : [];

  const field = (key: keyof Draft, label: string, hint?: string) => (
    <TextField value={d[key]} onChange={(v) => setD({ ...d, [key]: v })} fullWidth>
      <Label>{label}</Label>
      <Input inputMode="decimal" />
      {hint && <p className="text-xs text-kosh-muted">{hint}</p>}
    </TextField>
  );

  return (
    <>
      <PageHeader title="Bank settings" description={`Bank-wide rules enforced on every transfer.${data.updatedBy ? ` Last changed by ${data.updatedBy.name}, ${formatDateTime(data.updatedAt)}.` : ""}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Panel className="space-y-6 p-6">
          <section>
            <h2 className="font-semibold">Limits</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {field("daily", "Daily transfer limit (৳)")}
              {field("single", "Max single transfer (৳)")}
              {field("minBalance", "Minimum balance (৳)", "Must remain after amount + fee")}
            </div>
          </section>
          <section>
            <h2 className="font-semibold">Transfer fee</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {field("feeFlat", "Flat fee (৳)")}
              {field("feePct", "Percentage (%)", "0 – 5")}
              {field("feeMax", "Fee cap (৳)", "Blank = no cap")}
            </div>
          </section>
          <section>
            <h2 className="font-semibold">Two-factor</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {field("otp", "Email code for transfers from (৳)", "Blank = off")}
            </div>
            <p className="mt-2 text-xs text-kosh-muted">
              Transfers of this amount or more need a one-time code emailed to the customer. PIN changes, reversals and settings changes always need one.
            </p>
          </section>
          {(parsed?.error || error) && (
            <Alert status="danger"><Alert.Content><Alert.Description>{parsed?.error ?? error}</Alert.Description></Alert.Content></Alert>
          )}
          <div className="flex justify-end">
            <Button onPress={() => { setError(null); setConfirm(true); }} isDisabled={!parsed?.body}>Save settings</Button>
          </div>
        </Panel>
        <Panel className="h-fit p-6">
          <h2 className="font-semibold">Fee preview</h2>
          <p className="mt-1 text-sm text-kosh-muted">What customers would pay with these values.</p>
          <ul className="mt-4 space-y-2 text-sm">
            {examples.map((e) => (
              <li key={e.t} className="flex justify-between rounded-xl bg-kosh-subtle px-3 py-2">
                <span>Send {formatMoney(BigInt(e.t * 100), { decimals: false })}</span>
                <span className="amount font-medium">{formatMoney(e.fee)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-kosh-muted">Accounts with their own (lower) limits keep them. Changes apply to the next transfer.</p>
        </Panel>
      </div>
      {twoFactor.dialog}
      <ConfirmDialog
        isOpen={confirm}
        onOpenChange={setConfirm}
        title="Apply new bank settings?"
        description="These rules apply to every customer's next transfer. The change and old values are written to the audit log."
        confirmLabel="Apply"
        isLoading={state.isLoading}
        onConfirm={async () => {
          if (!parsed?.body) return;
          const body = parsed.body;
          setConfirm(false);
          try {
            // the code is bound to these exact values
            await twoFactor.run({ purpose: "SETTINGS", settings: body }, (otp) => save({ ...body, otp }).unwrap());
            toast.success("Settings saved");
          } catch (e) {
            if (!(e instanceof TwoFactorCancelled)) setError(errorMessage(e));
          }
        }}
      />
    </>
  );
}
