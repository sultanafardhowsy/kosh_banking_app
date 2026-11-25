import "server-only";
import { db, type Tx } from "@/server/db";
import { DEFAULT_SETTINGS } from "@/lib/constants";

/** The single BankSettings row (id = 1). Created with defaults if missing. */
export async function getSettings(client: Tx | typeof db = db) {
  const row = await client.bankSettings.findUnique({ where: { id: 1 } });
  if (row) return row;
  await client.bankSettings.createMany({
    data: [{ id: 1, ...DEFAULT_SETTINGS }],
    skipDuplicates: true,
  });
  return client.bankSettings.findUniqueOrThrow({ where: { id: 1 } });
}

export type BankSettingsRow = Awaited<ReturnType<typeof getSettings>>;
