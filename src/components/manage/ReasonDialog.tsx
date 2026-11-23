"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Label, TextArea, TextField } from "@heroui/react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TwoFactorCancelled } from "@/components/security/TwoFactorDialog";
import { errorMessage } from "@/lib/client";

/**
 * Confirm dialog that requires a written reason (audited server-side).
 * `onConfirm` should throw (e.g. `.unwrap()`) on failure; the error is shown inline.
 */
export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  tone = "primary",
  label = "Reason",
  placeholder,
  minLength = 3,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  label?: string;
  placeholder?: string;
  minLength?: number;
  onConfirm: (reason: string) => Promise<unknown>;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  async function confirm() {
    if (reason.trim().length < minLength) return setError(`Write at least ${minLength} characters`);
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      if (!(e instanceof TwoFactorCancelled)) setError(errorMessage(e)); // cancelling the code step just returns here
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      isOpen={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      tone={tone}
      isLoading={busy}
      onConfirm={confirm}
    >
      {children}
      <TextField value={reason} onChange={setReason} fullWidth className="mt-3" isInvalid={Boolean(error)}>
        <Label>{label}</Label>
        <TextArea rows={2} placeholder={placeholder} />
      </TextField>
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
    </ConfirmDialog>
  );
}
