"use client";

import { useState } from "react";
import { Button, toast } from "@heroui/react";
import { BadgeCheck, Clock, KeyRound, Lock } from "lucide-react";
import {
  useGetAccountsQuery,
  useSetPinMutation,
} from "@/store/api/accountsApi";
import { useAppSelector } from "@/store/hooks";
import { selectUser } from "@/store/slices/authSlice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PinInput } from "@/components/ui/PinInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { errorMessage } from "@/lib/client";
import { initials, maskAccountNumber, titleCase } from "@/lib/format";
import type { AccountDetail } from "@/types/api";
import { KycForm } from "@/components/profile/KycForm";
import { TwoFactorCancelled, useTwoFactor } from "@/components/security/TwoFactorDialog";
import { useGetKycProfileQuery } from "@/store/api/meApi";

function PinForm({
  account,
  onDone,
}: {
  account: AccountDetail;
  onDone: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [setPin, state] = useSetPinMutation();
  const twoFactor = useTwoFactor();
  const changing = account.hasPin;

  async function save() {
    setError(null);
    if (next !== confirm) return setError("The new PINs don't match");
    if (/^(\d)\1+$/.test(next))
      return setError("Avoid repeated digits like 1111");
    const body = {
      accountId: account.id,
      currentPin: changing ? current : undefined,
      newPin: next,
      confirmPin: confirm,
    };
    try {
      // Changing an existing PIN needs the emailed code; setting the first one doesn't.
      if (changing) await twoFactor.run({ purpose: "PIN_CHANGE", accountId: account.id }, (otp) => setPin({ ...body, otp }).unwrap());
      else await setPin(body).unwrap();
      toast.success(changing ? "PIN changed" : "PIN set");
      onDone();
    } catch (e) {
      if (e instanceof TwoFactorCancelled) return;
      setError(errorMessage(e));
      setCurrent("");
    }
  }

  const ready =
    next.length === 4 &&
    confirm.length === 4 &&
    (!changing || current.length === 4);
  return (
    <div className="mt-4 space-y-4 rounded-2xl bg-kosh-subtle p-4">
      {twoFactor.dialog}
      {changing && (
        <div>
          <p className="mb-2 text-sm font-medium">Current PIN</p>
          <PinInput
            value={current}
            onChange={setCurrent}
            label="Current PIN"
            autoFocus
          />
        </div>
      )}
      <div>
        <p className="mb-2 text-sm font-medium">New PIN</p>
        <PinInput
          value={next}
          onChange={setNext}
          label="New PIN"
          autoFocus={!changing}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Confirm new PIN</p>
        <PinInput
          value={confirm}
          onChange={setConfirm}
          label="Confirm new PIN"
          isInvalid={confirm.length === 4 && confirm !== next}
        />
      </div>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="tertiary" onPress={onDone}>
          Cancel
        </Button>
        <Button onPress={save} isPending={state.isLoading} isDisabled={!ready}>
          {changing ? "Change PIN" : "Set PIN"}
        </Button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const user = useAppSelector(selectUser);
  const { data: accounts } = useGetAccountsQuery();
  const [editing, setEditing] = useState<string | null>(null);
  const { data: kyc } = useGetKycProfileQuery(undefined, { skip: !user || user.isVerified });

  return (
    <>
      <PageHeader
        title="Profile & PIN"
        description="Your details and the PIN that authorises transfers."
      />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel className="h-fit p-6">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-kosh-navy font-display text-lg font-semibold text-kosh-navy-fg">
              {user ? initials(user.name) : ""}
            </span>
            <div>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-sm text-kosh-muted">{user?.email}</p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-kosh-subtle px-3 py-2.5 text-sm">
            {user?.isVerified ? (
              <>
                <BadgeCheck className="size-4 text-kosh-money-in" /> Verified
                customer
              </>
            ) : (
              <>
                <Clock className="size-4 text-[var(--kosh-pending-fg)]" />{" "}
                {kyc?.complete ? "Waiting for staff to verify your details" : "Not verified yet — complete your details"}
              </>
            )}
          </div>
          <p className="mt-4 text-xs text-kosh-muted">
            {user?.isVerified
              ? "To change your name or contact details, visit a branch or ask Kosh staff."
              : "Once staff verify you, these details are locked."}
          </p>
        </Panel>

        <div className="space-y-6">
          {user && !user.isVerified && <KycForm />}
          <Panel>
            <PanelHeader
              title="Transaction PINs"
              description="Each account has its own 4-digit PIN. 5 wrong attempts lock it for 15 minutes."
            />
            <ul className="mt-3 divide-y divide-kosh-border">
              {(accounts ?? []).map((a) => (
                <li key={a.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-kosh-subtle">
                        {a.pinLocked ? (
                          <Lock className="size-4 text-danger" />
                        ) : (
                          <KeyRound className="size-4" />
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {a.nickname ?? `${titleCase(a.type)} account`}{" "}
                          <span className="amount text-kosh-muted">
                            {maskAccountNumber(a.accountNumber)}
                          </span>
                        </p>
                        <p className="text-xs text-kosh-muted">
                          {a.pinLocked
                            ? "Locked after too many attempts"
                            : a.hasPin
                              ? "PIN set"
                              : "No PIN — transfers are disabled"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.status !== "ACTIVE" && (
                        <StatusBadge status={a.status} />
                      )}
                      {editing !== a.id && a.status !== "CLOSED" && (
                        <Button
                          size="sm"
                          variant={a.hasPin ? "outline" : "primary"}
                          onPress={() => setEditing(a.id)}
                        >
                          {a.hasPin ? "Change PIN" : "Set PIN"}
                        </Button>
                      )}
                    </div>
                  </div>
                  {editing === a.id && (
                    <PinForm account={a} onDone={() => setEditing(null)} />
                  )}
                </li>
              ))}
            </ul>
            {accounts?.length === 0 && (
              <p className="px-5 pb-6 text-sm text-kosh-muted sm:px-6">
                You don&apos;t have an account yet. Kosh staff open one once your
                profile is verified.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
