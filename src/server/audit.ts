import "server-only";
import type { Prisma } from "@prisma/client";
import { db, type Tx } from "@/server/db";

/**
 * Every Admin/Staff mutation writes one AuditLog row.
 * Pass `tx` to write it inside the same DB transaction as the change itself.
 */
export async function writeAudit(
  entry: {
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    metadata?: Prisma.InputJsonValue;
  },
  tx: Tx | typeof db = db,
) {
  return tx.auditLog.create({ data: entry });
}
