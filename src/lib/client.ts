"use client";

import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { SerializedError } from "@reduxjs/toolkit";
import { isApiErrorBody, messageForError } from "./error-messages";

type RtkError = FetchBaseQueryError | SerializedError | undefined | unknown;

/** Friendly message from an RTK Query error (for inline form errors). */
export function errorMessage(err: RtkError): string {
  if (!err) return "";
  const e = err as FetchBaseQueryError;
  if (e.status === "FETCH_ERROR") return "Network error — check your connection.";
  if ("data" in e) return messageForError(e.data);
  return (err as SerializedError).message ?? "Something went wrong";
}

export function errorCode(err: RtkError): string | null {
  const data = (err as FetchBaseQueryError | undefined)?.data;
  return isApiErrorBody(data) ? data.error.code : null;
}

export function errorDetails<T = Record<string, unknown>>(err: RtkError): T | null {
  const data = (err as FetchBaseQueryError | undefined)?.data;
  return isApiErrorBody(data) ? ((data.error.details as T) ?? null) : null;
}

/** One key per user intent — reuse it on retries so the server never double-charges. */
export const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
