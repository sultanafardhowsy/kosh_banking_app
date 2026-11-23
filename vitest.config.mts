import { defineConfig } from "vitest/config";
import path from "node:path";

const root = import.meta.dirname;

/**
 * - tests/unit         pure logic, no database
 * - tests/integration  real Postgres (row locks, concurrency). Needs TEST_DATABASE_URL —
 *                      a SEPARATE database: every test truncates all tables.
 * - tests/e2e          HTTP against a running server. Needs E2E_BASE_URL + seeded demo data.
 * Suites without their env var are skipped, so `npm test` always works.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "server-only": path.resolve(root, "tests/helpers/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/helpers/setup-env.ts"],
    fileParallelism: false, // integration files share one database
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
