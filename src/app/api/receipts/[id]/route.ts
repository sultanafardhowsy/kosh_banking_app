import { handler } from "@/server/http";
import { requireUser } from "@/server/auth/guards";
import { receiptData } from "@/server/services/document.service";
import { renderReceipt } from "@/server/pdf/documents";

export const runtime = "nodejs";

/** GET /api/receipts/:id — PDF receipt (customers: own transactions only). */
export const GET = handler<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const data = await receiptData(user, id);
  const pdf = await renderReceipt(data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="kosh-receipt-${data.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
