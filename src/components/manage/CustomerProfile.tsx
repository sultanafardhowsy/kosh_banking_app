"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Modal, toast } from "@heroui/react";
import { ArrowLeft, BadgeCheck, Ban, Clock, KeyRound, Lock, Plus, Power, ShieldCheck } from "lucide-react";
import { useGetCustomerQuery, useOpenAccountMutation, useVerifyCustomerMutation } from "@/store/api/staffApi";
import { useSetUserStatusMutation } from "@/store/api/adminApi";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonBlock } from "@/components/ui/Skeletons";
import { TXN_TYPE_LABEL } from "@/components/banking/TxnRow";
import { loanLabel } from "@/components/loans/LoanBits";
import { errorCode, errorMessage } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { formatAccountNumber, formatDate, formatDateTime, initials, titleCase } from "@/lib/format";
import type { AccountType, UserStatus } from "@/types/api";
import { AccountControls } from "./AccountControls";
import { ReasonDialog } from "./ReasonDialog";
import { auditLabel } from "./AuditLog";

export function CustomerProfile({ id, scope }: { id: string; scope: "staff" | "admin" }) {
  const { data: c, isLoading, error } = useGetCustomerQuery(id);
  const [verify, verifyState] = useVerifyCustomerMutation();
  const [openAccount, openState] = useOpenAccountMutation();
  const [setStatus] = useSetUserStatusMutation();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accType, setAccType] = useState<AccountType>("SAVINGS");
  const [statusTarget, setStatusTarget] = useState<UserStatus | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  if (errorCode(error) === "NOT_FOUND") return <Panel><EmptyState title="Customer not found" /></Panel>;
  if (isLoading || !c) return <SkeletonBlock className="h-[600px] rounded-[20px]" />;

  const total = c.accounts.reduce((s, a) => s + BigInt(a.balance), BigInt(0));
  const ownIds = new Set(c.accounts.map((a) => a.id));

  return (
    <div className="space-y-6">
      <Link href={`/${scope}/customers`} className="inline-flex items-center gap-1.5 text-sm text-kosh-muted hover:text-kosh-text">
        <ArrowLeft className="size-4" /> Customers
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-kosh-navy font-display text-lg font-semibold text-kosh-navy-fg">{initials(c.name)}</span>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              {c.name}
              <StatusBadge status={c.status} />
            </h1>
            <p className="text-sm text-kosh-muted">{c.email} · customer since {formatDate(c.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!c.isVerified && (
            <Button onPress={() => { setDialogError(null); setVerifyOpen(true); }}>
              <ShieldCheck className="size-4" /> Verify KYC
            </Button>
          )}
          {scope === "admin" && c.status !== "ACTIVE" && (
            <Button variant="outline" onPress={() => setStatusTarget("ACTIVE")}><Power className="size-4" /> Activate</Button>
          )}
          {scope === "admin" && c.status === "ACTIVE" && (
            <Button variant="outline" onPress={() => setStatusTarget("INACTIVE")}><Power className="size-4" /> Deactivate</Button>
          )}
          {scope === "admin" && c.status !== "BLOCKED" && (
            <Button variant="danger-soft" onPress={() => setStatusTarget("BLOCKED")}><Ban className="size-4" /> Block</Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="p-6">
          <h2 className="font-semibold">KYC profile</h2>
          <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${c.isVerified ? "bg-[var(--kosh-success-bg)] text-[var(--kosh-success-fg)]" : "bg-[var(--kosh-pending-bg)] text-[var(--kosh-pending-fg)]"}`}>
            {c.isVerified ? <BadgeCheck className="size-4" /> : <Clock className="size-4" />}
            {c.isVerified ? `Verified${c.profile?.verifiedBy ? ` by ${c.profile.verifiedBy.name}` : ""}${c.profile?.verifiedAt ? ` · ${formatDate(c.profile.verifiedAt)}` : ""}` : "Verification pending"}
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Phone", c.profile?.phone],
              ["Address", c.profile?.address],
              ["NID (demo)", c.profile?.nid],
              ["Date of birth", c.profile?.dateOfBirth ? formatDate(c.profile.dateOfBirth) : null],
              ["Pending requests", String(c.pendingRequests)],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-4">
                <dt className="text-kosh-muted">{k}</dt>
                <dd className="text-right">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Accounts"
            description={`Total ${formatMoney(total)}`}
            action={
              c.status === "ACTIVE" && (
                <Button size="sm" variant="outline" onPress={() => { setDialogError(null); setAccountOpen(true); }} isDisabled={!c.isVerified}>
                  <Plus className="size-4" /> Open account
                </Button>
              )
            }
          />
          {!c.isVerified && <p className="px-6 pt-2 text-xs text-kosh-muted">Verify the customer before opening accounts.</p>}
          <ul className="mt-3 divide-y divide-kosh-border">
            {c.accounts.length === 0 && <li><EmptyState title="No accounts yet" /></li>}
            {c.accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-sm font-medium">{a.nickname ?? `${titleCase(a.type)} account`} <span className="text-xs text-kosh-muted">· {titleCase(a.type)}</span></p>
                  <p className="amount text-xs text-kosh-muted">{formatAccountNumber(a.accountNumber)}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-kosh-muted">
                    {a.pinLocked ? <Lock className="size-3" /> : <KeyRound className="size-3" />}
                    {a.pinLocked ? "PIN locked" : a.hasPin ? "PIN set" : "No PIN"}
                    {(a.dailyTransferLimit || a.maxSingleTxn) && (
                      <span> · custom limits {a.dailyTransferLimit && `daily ${formatMoney(a.dailyTransferLimit, { decimals: false })}`}{a.maxSingleTxn && ` · single ${formatMoney(a.maxSingleTxn, { decimals: false })}`}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={a.status} />
                  <Money value={a.balance} className="font-semibold" />
                  {scope === "admin" && <AccountControls account={a} customerId={c.id} />}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Recent transactions" />
          <ul className="mt-3 divide-y divide-kosh-border text-sm">
            {c.recent.length === 0 && <li><EmptyState title="No activity yet" /></li>}
            {c.recent.map((t) => {
              const out = t.senderAccountId && ownIds.has(t.senderAccountId) && !(t.receiverAccountId && ownIds.has(t.receiverAccountId));
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div>
                    <p className="font-medium">{TXN_TYPE_LABEL[t.type]} {t.isFlagged && !t.flagResolvedAt && <StatusBadge status="FLAGGED" className="ml-1" />}</p>
                    <p className="amount text-xs text-kosh-muted">{t.reference} · {formatDateTime(t.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <Money value={t.amount} direction={out ? "out" : "in"} className={t.status === "REVERSED" ? "line-through opacity-60" : "font-medium"} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader title="Loans" />
          <ul className="mt-3 divide-y divide-kosh-border text-sm">
            {c.loans.length === 0 && <li><EmptyState title="No loans" /></li>}
            {c.loans.map((l) => (
              <li key={l.id}>
                <Link href={`/${scope}/loans/${l.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-kosh-subtle">
                  <span>{loanLabel(l.loanType)} · <Money value={l.principal} className="text-kosh-muted" /></span>
                  <StatusBadge status={l.status} />
                </Link>
              </li>
            ))}
          </ul>
          <PanelHeader title="Activity log" className="mt-4 border-t border-kosh-border pt-5" />
          <ul className="space-y-2 px-6 pb-5 pt-3 text-sm">
            {c.audit.length === 0 && <li className="text-kosh-muted">No staff actions yet.</li>}
            {c.audit.map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span>{auditLabel(a.action)} <span className="text-kosh-muted">· {a.actor.name}</span></span>
                <span className="whitespace-nowrap text-xs text-kosh-muted">{formatDate(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <ConfirmDialog
        isOpen={verifyOpen}
        onOpenChange={setVerifyOpen}
        title="Mark KYC as verified?"
        description={`Confirm you have checked ${c.name}'s NID, phone and address. This is recorded in the audit log.`}
        confirmLabel="Verify"
        isLoading={verifyState.isLoading}
        onConfirm={async () => {
          setDialogError(null);
          try { await verify(c.id).unwrap(); toast.success("Customer verified"); setVerifyOpen(false); } catch (e) { setDialogError(errorMessage(e)); }
        }}
      >
        {dialogError && <p className="mt-2 text-sm text-danger">{dialogError}</p>}
      </ConfirmDialog>

      <Modal.Backdrop isOpen={accountOpen} onOpenChange={setAccountOpen}>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog>
            <Modal.Header><Modal.Heading>Open an account for {c.name}</Modal.Heading></Modal.Header>
            <Modal.Body className="space-y-3">
              <NativeSelect label="Account type" value={accType} onChange={(e) => setAccType(e.target.value as AccountType)} options={[{ value: "SAVINGS", label: "Savings" }, { value: "CURRENT", label: "Current" }, { value: "BUSINESS", label: "Business" }]} />
              <p className="text-xs text-kosh-muted">A 12-digit account number is generated. It starts at ৳0 — the customer adds money with a deposit request and sets the PIN themselves.</p>
              {dialogError && <p className="text-sm text-danger">{dialogError}</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => setAccountOpen(false)}>Cancel</Button>
              <Button
                isPending={openState.isLoading}
                onPress={async () => {
                  setDialogError(null);
                  try {
                    const a = await openAccount({ userId: c.id, type: accType }).unwrap();
                    toast.success("Account opened", { description: formatAccountNumber(a.accountNumber) });
                    setAccountOpen(false);
                  } catch (e) { setDialogError(errorMessage(e)); }
                }}
              >
                Open account
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {statusTarget && (
        <ReasonDialog
          open
          onClose={() => setStatusTarget(null)}
          title={statusTarget === "BLOCKED" ? `Block ${c.name}?` : statusTarget === "INACTIVE" ? `Deactivate ${c.name}?` : `Reactivate ${c.name}?`}
          description={statusTarget === "ACTIVE" ? "They can sign in and bank again." : "They're signed out everywhere immediately and can't sign in. Their money stays in their accounts."}
          confirmLabel={statusTarget === "BLOCKED" ? "Block" : statusTarget === "INACTIVE" ? "Deactivate" : "Reactivate"}
          tone={statusTarget === "ACTIVE" ? "primary" : "danger"}
          onConfirm={async (reason) => {
            await setStatus({ id: c.id, status: statusTarget, reason }).unwrap();
            toast.success(`Customer ${statusTarget === "ACTIVE" ? "reactivated" : statusTarget.toLowerCase()}`);
          }}
        />
      )}
    </div>
  );
}
