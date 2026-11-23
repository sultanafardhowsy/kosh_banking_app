import { z } from "zod";
import { handler, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/guards";
import { statementCsv, statementData } from "@/server/services/document.service";
import { renderStatement } from "@/server/pdf/documents";

export const runtime = "nodejs";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const query = z.object({ accountId: z.string().min(1), from: date, to: date, format: z.enum(["csv", "pdf"]).default("pdf") });

/** GET /api/statements?accountId&from&to&format=csv|pdf — own accounts only. */
export const GET = handler(async (req) => {
  const user = await requireRole("CUSTOMER");
  const q = parseQuery(req, query);
  const data = await statementData(user.id, q.accountId, q.from, q.to);
  const name = `kosh-statement-${data.accountNumber}-${q.from}-to-${q.to}`;
  if (q.format === "csv") {
    return new Response(statementCsv(data), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "private, no-store" },
    });
  }
  const pdf = await renderStatement(data);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"`, "Cache-Control": "private, no-store" },
  });
});
