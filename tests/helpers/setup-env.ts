import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Load .env.test (if present) so TEST_DATABASE_URL / E2E_BASE_URL can live in a file. */
const file = path.resolve(__dirname, "../../.env.test");
if (existsSync(file)) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2];
  }
}

// Integration tests must never touch the dev/prod database.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DIRECT_URL = process.env.TEST_DATABASE_URL;
}
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
