import "server-only";
import { Prisma } from "@prisma/client";
import type { Tx } from "@/server/db";

/**
 * Row-lock bank accounts for the rest of the DB transaction.
 * Ids are locked in sorted order so two transfers between the same pair
 * (A→B and B→A) always lock in the same sequence — no deadlocks.
 * After this returns, re-read the rows: under READ COMMITTED every following
 * statement sees the latest committed balance.
 */
export async function lockAccounts(tx: Tx, ids: string[]) {
  const unique = [...new Set(ids)].sort();
  if (!unique.length) return;
  await tx.$queryRaw`SELECT id FROM accounts WHERE id IN (${Prisma.join(unique)}) ORDER BY id FOR UPDATE`;
}

/** Lock a single row of another table by id (e.g. a pending request) — table name is a fixed literal. */
export async function lockRequest(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM deposit_withdrawal_requests WHERE id = ${id} FOR UPDATE`;
}

export async function lockTransaction(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM transactions WHERE id = ${id} FOR UPDATE`;
}

/** Interactive transaction options for money operations. */
export const MONEY_TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 10_000,
  timeout: 20_000,
} as const;

export function isUniqueViolation(err: unknown, field?: string) {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  if (!field) return true;
  // Classic engine: meta.target. Driver adapters (our setup): meta.driverAdapterError.cause.constraint.fields
  const meta = err.meta as
    | { target?: string[] | string; driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } }
    | undefined;
  const fields = [
    ...(Array.isArray(meta?.target) ? meta.target : meta?.target ? [meta.target] : []),
    ...(meta?.driverAdapterError?.cause?.constraint?.fields ?? []),
  ].map((f) => f.replace(/"/g, ""));
  return fields.some((f) => f === field || f.includes(field));
}
