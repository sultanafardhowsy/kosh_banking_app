import { z } from "zod";
import { handler, ok, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { db } from "@/server/db";
import { emailConfig } from "@/server/email/email.service";

const query = z.object({
  status: z.enum(["SENT", "FAILED", "LOGGED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** GET /api/admin/emails — every email sent/logged, newest first (bodies fetched per item). Admin only. */
export const GET = handler(async (req) => {
  await requireRole("ADMIN");
  const q = parseQuery(req, query);
  const where = q.status ? { status: q.status } : {};
  const [items, total, counts] = await Promise.all([
    db.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: { id: true, toAddress: true, originalTo: true, subject: true, status: true, provider: true, error: true, notificationType: true, createdAt: true, user: { select: { name: true } } },
    }),
    db.emailLog.count({ where }),
    db.emailLog.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const cfg = emailConfig();
  return ok({
    items, total, page: q.page, pageSize: q.pageSize,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    config: { provider: cfg.provider, from: cfg.from, redirectTo: cfg.redirectTo },
  });
});
