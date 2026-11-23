import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Single Prisma client per server instance.
 * Uses the Rust-free client (engineType = "client") with the node-postgres
 * driver adapter — works with Neon's pooled connection string on Vercel.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Transaction client type, for services that run inside `db.$transaction`. */
export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
