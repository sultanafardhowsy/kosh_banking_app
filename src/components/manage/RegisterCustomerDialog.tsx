"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, Button, Modal } from "@heroui/react";
import { Check, Copy } from "lucide-react";
import { useRegisterCustomerMutation } from "@/store/api/staffApi";
import { FormTextField } from "@/components/ui/FormTextField";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { errorMessage } from "@/lib/client";
import { formatAccountNumber } from "@/lib/format";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the full name"),
  email: z.email("Enter a valid email").trim(),
  phone: z.string().trim().regex(/^\+?\d{10,14}$/, "e.g. +8801712345678"),
  address: z.string().trim().min(5, "Enter an address"),
  nid: z.string().trim().min(5, "Enter the (demo) NID"),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  openAccount: z.enum(["NONE", "SAVINGS", "CURRENT", "BUSINESS"]),
});
type Form = z.infer<typeof schema>;

/** Staff/Admin: create a customer login + profile; shows the temporary password ONCE. */
export function RegisterCustomerDialog({ open, onClose, basePath }: { open: boolean; onClose: () => void; basePath: string }) {
  const [register, state] = useRegisterCustomerMutation();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; name: string; email: string; password: string; account: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "+8801", address: "", nid: "", dateOfBirth: "", openAccount: "SAVINGS" },
  });

  function close() {
    onClose();
    setTimeout(() => {
      form.reset();
      setDone(null);
      setError(null);
      setCopied(false);
    }, 200);
  }

  async function submit(v: Form) {
    setError(null);
    try {
      const r = await register(v).unwrap();
      setDone({ id: r.customer.id, name: r.customer.name, email: r.customer.email, password: r.temporaryPassword, account: r.account?.accountNumber ?? null });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={(o) => !o && close()}>
      <Modal.Container size="lg" placement="center" scroll="inside">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{done ? "Customer registered" : "Register a customer"}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {done ? (
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3 rounded-2xl bg-[var(--kosh-success-bg)] p-4 text-[var(--kosh-success-fg)]">
                  <Check className="size-5" /> {done.name} can now sign in.
                </div>
                <dl className="divide-y divide-kosh-border rounded-2xl border border-kosh-border">
                  <div className="flex justify-between px-4 py-3"><dt className="text-kosh-muted">Email</dt><dd>{done.email}</dd></div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <dt className="text-kosh-muted">Temporary password</dt>
                    <dd className="flex items-center gap-2">
                      <code className="rounded-lg bg-kosh-subtle px-2 py-1 font-mono">{done.password}</code>
                      <Button isIconOnly size="sm" variant="ghost" aria-label="Copy password" onPress={() => { navigator.clipboard?.writeText(done.password); setCopied(true); }}>
                        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                      </Button>
                    </dd>
                  </div>
                  {done.account && <div className="flex justify-between px-4 py-3"><dt className="text-kosh-muted">Account opened</dt><dd className="amount">{formatAccountNumber(done.account)}</dd></div>}
                </dl>
                <p className="text-xs text-kosh-muted">This password is shown only once. Hand it to the customer; they set a transaction PIN after signing in. Verify their KYC before they can borrow.</p>
              </div>
            ) : (
              <form id="register-customer" onSubmit={form.handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2" noValidate>
                {error && (
                  <Alert status="danger" className="sm:col-span-2">
                    <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
                  </Alert>
                )}
                <FormTextField control={form.control} name="name" label="Full name" />
                <FormTextField control={form.control} name="email" label="Email" type="email" />
                <FormTextField control={form.control} name="phone" label="Phone" type="tel" />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="dob" className="text-sm font-medium">Date of birth</label>
                  <input id="dob" type="date" max={new Date(Date.now() - 18 * 365.25 * 86_400_000).toISOString().slice(0, 10)} {...form.register("dateOfBirth")} className="h-10 rounded-[var(--field-radius,12px)] border border-kosh-border bg-[var(--field-background)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-kosh-info" />
                  {form.formState.errors.dateOfBirth && <p className="text-xs text-danger">{form.formState.errors.dateOfBirth.message}</p>}
                </div>
                <div className="sm:col-span-2"><FormTextField control={form.control} name="address" label="Address" /></div>
                <FormTextField control={form.control} name="nid" label="NID (demo)" description="Fake numbers only — this is a simulation." />
                <NativeSelect
                  label="Open first account"
                  {...form.register("openAccount")}
                  options={[
                    { value: "SAVINGS", label: "Savings" },
                    { value: "CURRENT", label: "Current" },
                    { value: "BUSINESS", label: "Business" },
                    { value: "NONE", label: "Not now" },
                  ]}
                />
              </form>
            )}
          </Modal.Body>
          <Modal.Footer>
            {done ? (
              <>
                <Button variant="tertiary" onPress={close}>Close</Button>
                <Link href={`${basePath}/${done.id}`} onClick={close} className="button button--primary button--md">Open profile</Link>
              </>
            ) : (
              <>
                <Button variant="tertiary" onPress={close}>Cancel</Button>
                <Button type="submit" form="register-customer" isPending={state.isLoading}>Register</Button>
              </>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
