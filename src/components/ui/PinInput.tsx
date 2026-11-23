"use client";

import { InputOTP } from "@heroui/react";

/** 4-digit transaction PIN, masked. */
export function PinInput({
  value,
  onChange,
  onComplete,
  isInvalid,
  autoFocus,
  label = "Transaction PIN",
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  isInvalid?: boolean;
  autoFocus?: boolean;
  label?: string;
}) {
  return (
    <InputOTP
      maxLength={4}
      value={value}
      onChange={(v: string) => onChange(v.replace(/\D/g, ""))}
      onComplete={onComplete}
      inputMode="numeric"
      pattern="^[0-9]*$"
      autoFocus={autoFocus}
      aria-label={label}
      isInvalid={isInvalid}
      className="pin-masked"
    >
      <InputOTP.Group>
        {[0, 1, 2, 3].map((i) => (
          <InputOTP.Slot key={i} index={i} className="size-12 text-lg" />
        ))}
      </InputOTP.Group>
    </InputOTP>
  );
}
