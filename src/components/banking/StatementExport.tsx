"use client";

import { useState } from "react";
import { Button, Modal } from "@heroui/react";
import { Download } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";

const iso = (d: Date) => new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 10); // Dhaka date

/** Pick a period + format, then download from GET /api/statements. */
export function StatementExport({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1))));
  const [to, setTo] = useState(iso(now));
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const valid = from && to && from <= to;
  const href = `/api/statements?accountId=${encodeURIComponent(accountId)}&from=${from}&to=${to}&format=${format}`;
  const input = "h-10 w-full rounded-[var(--field-radius,12px)] border border-kosh-border bg-[var(--field-background)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-kosh-info";

  return (
    <>
      <Button size="sm" variant="outline" onPress={() => setOpen(true)}>
        <Download className="size-4" /> Statement
      </Button>
      <Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog>
            <Modal.Header><Modal.Heading>Download statement</Modal.Heading></Modal.Header>
            <Modal.Body className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={input} /></label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">To<input type="date" value={to} min={from} max={iso(now)} onChange={(e) => setTo(e.target.value)} className={input} /></label>
              </div>
              <Segmented ariaLabel="Format" value={format} onChange={setFormat} options={[{ value: "pdf", label: "PDF" }, { value: "csv", label: "CSV (Excel)" }]} />
              <p className="text-xs text-kosh-muted">Built from the ledger: opening balance, every entry with its running balance, and closing balance (max one year).</p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => setOpen(false)}>Cancel</Button>
              <a href={valid ? href : undefined} aria-disabled={!valid} onClick={() => setOpen(false)} className={`button button--primary button--md ${valid ? "" : "pointer-events-none opacity-50"}`}>
                <Download className="size-4" /> Download {format.toUpperCase()}
              </a>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
