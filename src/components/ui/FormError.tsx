"use client";

import { Alert } from "@heroui/react";

/** Form-level error: tinted danger alert with an icon and a short title. */
export function FormError({ title = "Something went wrong", message, className }: { title?: string; message: string; className?: string }) {
  return (
    <Alert status="danger" className={className} role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

type AuthClientError = { code?: string; status?: number; message?: string };

/**
 * Better Auth errors → copy a customer can act on. Raw technical messages
 * ("Invalid origin", etc.) are logged for developers instead of shown.
 */
export function authErrorMessage(error: AuthClientError, fallback: string, known: Record<string, string> = {}) {
  if (error.code && known[error.code]) return known[error.code]!;
  if (error.code === "USER_BLOCKED") return "Your profile is not active. Contact the bank.";
  if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
  console.warn("[auth]", error.code ?? error.status, error.message);
  return fallback;
}
