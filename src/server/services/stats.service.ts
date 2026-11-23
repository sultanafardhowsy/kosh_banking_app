import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { startOfDhakaDay } from "@/lib/time";

/**
 * Analytics. Monthly buckets are computed in Bangladesh time
 * ("createdAt" is stored as UTC). Money is returned as paisa strings via serialize().
 */
const MONTHS = 6;

/** "YYYY-MM" keys for the last N months (Dhaka), oldest first. */
function monthKeys(n = MONTHS, now = new Date()) {
  const local = new Date(now.getTime() + 6 * 3600_000);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** UTC instant of the first day (00:00 Dhaka) of the oldest month in the window. */
function windowStart(n = MONTHS, now = new Date()) {
  const [y, m] = monthKeys(n, now)[0]!.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1) - 6 * 3600_000);
}

const MONTH_SQL = Prisma.sql`to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM')`;

type MonthTypeRow = { month: string; type: string; count: number; total: bigint };

async function monthlyByType(where: Prisma.Sql) {
  return db.$queryRaw<MonthTypeRow[]>`
    SELECT ${MONTH_SQL} AS month, type::text AS type, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::bigint AS total
    FROM transactions
    WHERE ${where}
    GROUP BY 1, 2`;
}

function pick(rows: MonthTypeRow[], month: string, type: string) {
  return rows.find((r) => r.month === month && r.type === type) ?? { count: 0, total: BigInt(0) };
}

function pctChange(curr: bigint, prev: bigint) {
  if (prev === BigInt(0)) return curr > BigInt(0) ? 100 : 0;
  return Number(((curr - prev) * BigInt(10000)) / prev) / 100;
}

// ───────────────────────── Admin ─────────────────────────

export async function adminStats(now = new Date()) {
  const start = windowStart(MONTHS, now);
  const keys = monthKeys(MONTHS, now);
  const today = startOfDhakaDay(now);
  const since30 = new Date(now.getTime() - 30 * 86_400_000);

  const [
    rows, customers, newCustomers, accountsByType, loansByStatus, todayAgg,
    pendingRequests, openFlags, overdue, loanBook,
  ] = await Promise.all([
    monthlyByType(Prisma.sql`status IN ('COMPLETED', 'REVERSED') AND "createdAt" >= ${start}`),
    db.user.count({ where: { role: "CUSTOMER", status: "ACTIVE" } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: since30 } } }),
    db.account.groupBy({ by: ["type"], where: { status: { not: "CLOSED" } }, _count: { _all: true }, _sum: { balance: true } }),
    db.loan.groupBy({ by: ["status"], _count: { _all: true }, _sum: { principal: true } }),
    db.transaction.aggregate({ where: { createdAt: { gte: today }, status: "COMPLETED" }, _count: { _all: true }, _sum: { amount: true } }),
    db.depositWithdrawalRequest.count({ where: { status: "PENDING" } }),
    db.transaction.count({ where: { isFlagged: true, flagResolvedAt: null } }),
    db.loanInstallment.count({ where: { status: { in: ["DUE", "OVERDUE"] }, dueDate: { lt: now } } }),
    db.loan.aggregate({ where: { status: "ACTIVE" }, _sum: { remainingBalance: true } }),
  ]);

  const monthly = keys.map((month) => {
    const t = pick(rows, month, "TRANSFER");
    const d = pick(rows, month, "DEPOSIT");
    const w = pick(rows, month, "WITHDRAWAL");
    const ld = pick(rows, month, "LOAN_DISBURSEMENT");
    const lr = pick(rows, month, "LOAN_REPAYMENT");
    const all = rows.filter((r) => r.month === month);
    return {
      month,
      transferVolume: t.total,
      transferCount: t.count,
      totalVolume: all.reduce((s, r) => s + r.total, BigInt(0)),
      totalCount: all.reduce((s, r) => s + r.count, 0),
      deposits: d.total,
      withdrawals: w.total,
      depositCount: d.count,
      withdrawalCount: w.count,
      loanCount: ld.count + lr.count,
    };
  });

  const curr = monthly[monthly.length - 1]!;
  const prev = monthly[monthly.length - 2]!;
  const deposits = accountsByType.reduce((s, a) => s + (a._sum.balance ?? BigInt(0)), BigInt(0));
  const loanCount = (s: string) => loansByStatus.find((l) => l.status === s)?._count._all ?? 0;

  return {
    kpis: {
      activeCustomers: customers,
      newCustomers30d: newCustomers,
      totalDeposits: deposits,
      accounts: accountsByType.reduce((s, a) => s + a._count._all, 0),
      txnsToday: todayAgg._count._all,
      volumeToday: todayAgg._sum.amount ?? BigInt(0),
      monthVolume: curr.totalVolume,
      monthVolumeTrend: pctChange(curr.totalVolume, prev.totalVolume),
      pendingRequests,
      loansAwaiting: loanCount("PENDING") + loanCount("UNDER_REVIEW"),
      openFlags,
      overdueInstallments: overdue,
      loanBook: loanBook._sum.remainingBalance ?? BigInt(0),
    },
    monthly,
    accountDistribution: (["SAVINGS", "CURRENT", "BUSINESS"] as const).map((type) => {
      const r = accountsByType.find((a) => a.type === type);
      return { type, count: r?._count._all ?? 0, balance: r?._sum.balance ?? BigInt(0) };
    }),
    loanStats: (["PENDING", "UNDER_REVIEW", "ACTIVE", "COMPLETED", "REJECTED"] as const).map((status) => {
      const r = loansByStatus.find((l) => l.status === status);
      return { status, count: r?._count._all ?? 0, principal: r?._sum.principal ?? BigInt(0) };
    }),
  };
}

// ───────────────────────── Staff ─────────────────────────

export async function staffOverview(now = new Date()) {
  const today = startOfDhakaDay(now);
  const [pendingRequests, loansPending, unverified, txnsToday, openFlags, requests, loans, customers] = await Promise.all([
    db.depositWithdrawalRequest.count({ where: { status: "PENDING" } }),
    db.loan.count({ where: { status: "PENDING" } }),
    db.user.count({ where: { role: "CUSTOMER", isVerified: false, status: "ACTIVE" } }),
    db.transaction.count({ where: { createdAt: { gte: today }, status: "COMPLETED" } }),
    db.transaction.count({ where: { isFlagged: true, flagResolvedAt: null } }),
    db.depositWithdrawalRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, type: true, amount: true, createdAt: true, requestedBy: { select: { name: true } } },
    }),
    db.loan.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, loanType: true, principal: true, createdAt: true, user: { select: { name: true } } },
    }),
    db.user.findMany({
      where: { role: "CUSTOMER", isVerified: false, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true },
    }),
  ]);
  return { kpis: { pendingRequests, loansPending, unverified, txnsToday, openFlags }, requests, loans, customers };
}

// ───────────────────────── Customer ─────────────────────────

export async function customerStats(userId: string, accountId?: string, now = new Date()) {
  const own = await db.account.findMany({ where: { userId }, select: { id: true } });
  const ids = own.map((a) => a.id);
  if (accountId && !ids.includes(accountId)) throw new AppError("NOT_FOUND", "Account not found");
  const scope = accountId ? [accountId] : ids;
  const keys = monthKeys(MONTHS, now);
  const start = windowStart(MONTHS, now);
  if (!scope.length) {
    return { monthly: keys.map((month) => ({ month, spending: BigInt(0), deposits: BigInt(0), income: BigInt(0) })), distribution: [] };
  }

  // Ledger-based: what actually left / entered the customer's balance
  const ledger = await db.$queryRaw<{ month: string; direction: string; type: string; total: bigint }[]>`
    SELECT ${Prisma.sql`to_char((le."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM')`} AS month,
           le.direction::text AS direction, t.type::text AS type, COALESCE(SUM(le.amount), 0)::bigint AS total
    FROM ledger_entries le
    JOIN transactions t ON t.id = le."transactionId"
    WHERE le."accountId" IN (${Prisma.join(scope)}) AND le."createdAt" >= ${start}
    GROUP BY 1, 2, 3`;

  // Internal moves between the customer's own accounts aren't spending or income
  const internal = accountId
    ? []
    : await db.$queryRaw<{ month: string; total: bigint }[]>`
        SELECT ${MONTH_SQL} AS month, COALESCE(SUM(amount), 0)::bigint AS total
        FROM transactions
        WHERE type = 'TRANSFER' AND status = 'COMPLETED' AND "createdAt" >= ${start}
          AND "senderAccountId" IN (${Prisma.join(scope)}) AND "receiverAccountId" IN (${Prisma.join(scope)})
        GROUP BY 1`;

  const monthly = keys.map((month) => {
    const rows = ledger.filter((r) => r.month === month);
    const sum = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((s, r) => s + r.total, BigInt(0));
    const moved = internal.find((r) => r.month === month)?.total ?? BigInt(0);
    return {
      month,
      spending: sum((r) => r.direction === "DEBIT" && r.type !== "REVERSAL") - moved,
      deposits: sum((r) => r.direction === "CREDIT" && r.type === "DEPOSIT"),
      income: sum((r) => r.direction === "CREDIT") - moved,
    };
  });

  const dist = await db.transaction.groupBy({
    by: ["type"],
    where: { createdAt: { gte: start }, status: { in: ["COMPLETED", "REVERSED"] }, OR: [{ senderAccountId: { in: scope } }, { receiverAccountId: { in: scope } }] },
    _count: { _all: true },
    _sum: { amount: true },
  });

  return {
    monthly,
    distribution: dist.map((d) => ({ type: d.type, count: d._count._all, amount: d._sum.amount ?? BigInt(0) })).sort((a, b) => b.count - a.count),
  };
}
