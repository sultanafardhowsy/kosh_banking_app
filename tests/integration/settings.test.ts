import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { getSettings } from "@/server/services/settings.service";
import { hasTestDb, resetDb } from "../helpers/factory";

describe.skipIf(!hasTestDb)("bank settings initialization (integration)", () => {
  beforeEach(resetDb);

  it("creates defaults once when concurrent requests find no settings row", async () => {
    await db.bankSettings.delete({ where: { id: 1 } });

    const results = await Promise.all(
      Array.from({ length: 8 }, () => getSettings()),
    );

    expect(results).toHaveLength(8);
    expect(results.every((settings) => settings.id === 1)).toBe(true);
    expect(results[0]).toMatchObject(DEFAULT_SETTINGS);
    expect(await db.bankSettings.count()).toBe(1);
  });
});
