"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, toast } from "@heroui/react";
import { kycProfileSchema } from "@/lib/validators/money";
import { useGetKycProfileQuery, useSubmitKycProfileMutation, type KycInput } from "@/store/api/meApi";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { FormTextField } from "@/components/ui/FormTextField";
import { errorMessage } from "@/lib/client";

/**
 * Shown to unverified customers (self-signup or Google). Staff can only verify a
 * profile once it has a phone and NID, so this is the customer's first step.
 */
export function KycForm() {
  const { data, isLoading } = useGetKycProfileQuery();
  const [submit, state] = useSubmitKycProfileMutation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<KycInput>({
    resolver: zodResolver(kycProfileSchema),
    defaultValues: { phone: "+8801", address: "", nid: "", dateOfBirth: "" },
  });

  useEffect(() => {
    const p = data?.profile;
    if (p) form.reset({ phone: p.phone ?? "+8801", address: p.address ?? "", nid: p.nid ?? "", dateOfBirth: p.dateOfBirth?.slice(0, 10) ?? "" });
  }, [data, form]);

  async function onSubmit(v: KycInput) {
    setError(null);
    try {
      await submit(v).unwrap();
      toast.success(data?.complete ? "Details updated" : "Details sent for verification");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (isLoading) return null;
  const complete = data?.complete;
  return (
    <Panel>
      <PanelHeader
        title={complete ? "Your details" : "Complete your profile"}
        description={complete ? "Kosh staff are reviewing these. You can correct them until you're verified." : "Staff need these to verify you. Until then you can't apply for loans."}
      />
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 px-5 pb-6 pt-4 sm:grid-cols-2 sm:px-6" noValidate>
        {error && (
          <Alert status="danger" className="sm:col-span-2">
            <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
          </Alert>
        )}
        <FormTextField control={form.control} name="phone" label="Phone" type="tel" autoComplete="tel" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="kyc-dob" className="text-sm font-medium">Date of birth</label>
          <input
            id="kyc-dob"
            type="date"
            max={new Date(Date.now() - 18 * 365.25 * 86_400_000).toISOString().slice(0, 10)}
            {...form.register("dateOfBirth")}
            className="h-10 rounded-[var(--field-radius,12px)] border border-kosh-border bg-[var(--field-background)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-kosh-info"
          />
          {form.formState.errors.dateOfBirth && <p className="text-xs text-danger">{form.formState.errors.dateOfBirth.message}</p>}
        </div>
        <FormTextField control={form.control} name="nid" label="National ID (demo)" description="Any made-up number — this bank is simulated." />
        <FormTextField control={form.control} name="address" label="Address" autoComplete="street-address" />
        <div className="sm:col-span-2">
          <Button type="submit" isPending={state.isLoading}>{complete ? "Save changes" : "Send for verification"}</Button>
        </div>
      </form>
    </Panel>
  );
}
