"use client";

import type { ReactNode } from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Description, FieldError, Input, Label, TextField } from "@heroui/react";

/**
 * React Hook Form + HeroUI TextField in one line:
 *   <FormTextField control={control} name="email" label="Email" type="email" />
 * The Zod error (from zodResolver) is shown under the field.
 */
export function FormTextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  type = "text",
  placeholder,
  autoComplete,
  inputMode,
  endContent,
  isDisabled,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
  type?: "text" | "email" | "password" | "tel" | "number";
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel";
  endContent?: ReactNode;
  isDisabled?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          name={field.name}
          type={type}
          value={field.value ?? ""}
          onChange={field.onChange}
          onBlur={field.onBlur}
          isInvalid={Boolean(fieldState.error)}
          isDisabled={isDisabled}
          validationBehavior="aria"
          fullWidth
        >
          <Label>{label}</Label>
          <div className="relative">
            <Input
              ref={field.ref}
              placeholder={placeholder}
              autoComplete={autoComplete}
              inputMode={inputMode}
              className={endContent ? "pr-11" : undefined}
            />
            {endContent && (
              <div className="absolute inset-y-0 right-1.5 flex items-center">{endContent}</div>
            )}
          </div>
          {description && !fieldState.error && <Description>{description}</Description>}
          <FieldError>{fieldState.error?.message}</FieldError>
        </TextField>
      )}
    />
  );
}
