"use client";

import { useEffect, useState } from "react";
import { Button, Dropdown, Input, Label, Modal, TextField, toast } from "@heroui/react";
import { MoreHorizontal } from "lucide-react";
import { useUpdateAccountMutation } from "@/store/api/adminApi";
import { errorMessage } from "@/lib/client";
import { formatAmount, formatMoney, takaToPaisa } from "@/lib/money";
import { maskAccountNumber } from "@/lib/format";
import type { AccountStatus, Money } from "@/types/api";
import { ReasonDialog } from "./ReasonDialog";

type Acc = { id: string; accountNumber: string; status: AccountStatus; balance: Money; dailyTransferLimit: Money | null; maxSingleTxn: Money | null };

/** Admin-only menu for one account: freeze / unfreeze / limits / close. */
export function AccountControls({ account, customerId }: { account: Acc; customerId?: string }) {
  const [update] = useUpdateAccountMutation();
  const [dialog, setDialog] = useState<"freeze" | "unfreeze" | "close" | "limits" | null>(null);
  if (account.status === "CLOSED") return null;

  const label = maskAccountNumber(account.accountNumber);
  return (
    <>
      <Dropdown>
        <Dropdown.Trigger aria-label={`Actions for ${label}`} className="grid size-8 place-items-center rounded-lg hover:bg-kosh-subtle">
          <MoreHorizontal className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu onAction={(k) => setDialog(k as typeof dialog)}>
            {account.status === "ACTIVE" ? (
              <Dropdown.Item id="freeze" textValue="Freeze">Freeze account</Dropdown.Item>
            ) : (
              <Dropdown.Item id="unfreeze" textValue="Unfreeze">Unfreeze account</Dropdown.Item>
            )}
            <Dropdown.Item id="limits" textValue="Limits">Set transfer limits</Dropdown.Item>
            <Dropdown.Item id="close" textValue="Close" variant="danger">Close account</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      {(dialog === "freeze" || dialog === "unfreeze" || dialog === "close") && (
        <ReasonDialog
          open
          onClose={() => setDialog(null)}
          title={dialog === "freeze" ? `Freeze ${label}?` : dialog === "unfreeze" ? `Unfreeze ${label}?` : `Close ${label}?`}
          description={
            dialog === "freeze"
              ? "No money can leave or enter this account until it's unfrozen. The customer is notified."
              : dialog === "close"
                ? account.balance === "0" ? "Closing is permanent." : `The balance is ${formatMoney(account.balance)} — only empty accounts can be closed.`
                : "Transfers resume immediately."
          }
          confirmLabel={dialog === "freeze" ? "Freeze" : dialog === "unfreeze" ? "Unfreeze" : "Close account"}
          tone={dialog === "unfreeze" ? "primary" : "danger"}
          onConfirm={async (reason) => {
            await update({ id: account.id, customerId, action: dialog, reason }).unwrap();
            toast.success(dialog === "freeze" ? "Account frozen" : dialog === "unfreeze" ? "Account unfrozen" : "Account closed");
          }}
        />
      )}
      {dialog === "limits" && <LimitsDialog account={account} customerId={customerId} onClose={() => setDialog(null)} />}
    </>
  );
}

function LimitsDialog({ account, customerId, onClose }: { account: Acc; customerId?: string; onClose: () => void }) {
  const [update, state] = useUpdateAccountMutation();
  const [daily, setDaily] = useState("");
  const [single, setSingle] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDaily(account.dailyTransferLimit ? formatAmount(account.dailyTransferLimit, { decimals: false }).replace(/,/g, "") : "");
    setSingle(account.maxSingleTxn ? formatAmount(account.maxSingleTxn, { decimals: false }).replace(/,/g, "") : "");
  }, [account]);

  async function save() {
    setError(null);
    try {
      const toPaisa = (v: string) => (v.trim() ? takaToPaisa(v).toString() : null);
      await update({ id: account.id, customerId, action: "limits", dailyTransferLimit: toPaisa(daily), maxSingleTxn: toPaisa(single) }).unwrap();
      toast.success("Limits updated");
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message === "Invalid amount" ? "Enter whole taka amounts" : errorMessage(e));
    }
  }

  return (
    <Modal.Backdrop isOpen onOpenChange={(o) => !o && onClose()}>
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog>
          <Modal.Header><Modal.Heading>Transfer limits · {maskAccountNumber(account.accountNumber)}</Modal.Heading></Modal.Header>
          <Modal.Body className="space-y-4">
            <p className="text-sm text-kosh-muted">Leave blank to use the bank-wide limit. Account limits can only be lower than the bank&apos;s.</p>
            <TextField value={daily} onChange={setDaily} fullWidth>
              <Label>Daily limit (৳)</Label>
              <Input inputMode="numeric" placeholder="Bank default" />
            </TextField>
            <TextField value={single} onChange={setSingle} fullWidth>
              <Label>Max single transfer (৳)</Label>
              <Input inputMode="numeric" placeholder="Bank default" />
            </TextField>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={onClose}>Cancel</Button>
            <Button onPress={save} isPending={state.isLoading}>Save limits</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
