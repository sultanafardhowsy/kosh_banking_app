import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatAmount, type MoneyInput } from "@/lib/money";

/**
 * Server-rendered PDFs (receipts & statements). Built-in Helvetica has no ৳
 * glyph, so PDFs print "BDT". All data is simulated — every page says so.
 */
const NAVY = "#0B1533";
const MUTED = "#5B6478";
const BORDER = "#E4E7EF";
const BLUE = "#2F6BFF";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: NAVY },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  brand: { fontSize: 20, fontFamily: "Helvetica-Bold", color: NAVY },
  brandDot: { color: BLUE },
  tag: { fontSize: 8, color: MUTED, textAlign: "right" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  muted: { color: MUTED },
  hero: { backgroundColor: NAVY, color: "#FFFFFF", borderRadius: 8, padding: 18, marginVertical: 16 },
  heroAmount: { fontSize: 26, fontFamily: "Helvetica-Bold", marginTop: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: BORDER },
  label: { color: MUTED },
  th: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: NAVY, paddingBottom: 5, marginTop: 12, fontFamily: "Helvetica-Bold", fontSize: 8, color: MUTED },
  tr: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: BORDER, fontSize: 8.5 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: MUTED, flexDirection: "row", justifyContent: "space-between" },
  summary: { flexDirection: "row", gap: 10, marginTop: 12 },
  box: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 10 },
  boxValue: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 3 },
});

export const bdt = (v: MoneyInput) => `BDT ${formatAmount(v)}`;
const dt = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(d);
const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(d);

function Header({ right }: { right: string }) {
  return (
    <View style={s.header}>
      <Text style={s.brand}>
        Kosh<Text style={s.brandDot}>.</Text>
      </Text>
      <View>
        <Text style={s.tag}>{right}</Text>
        <Text style={s.tag}>Simulated bank — no real money</Text>
      </View>
    </View>
  );
}

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text style={{ maxWidth: "80%" }}>Kosh · simulated bank · generated {dt(new Date())} (Dhaka)</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

export type ReceiptData = {
  reference: string;
  typeLabel: string;
  status: string;
  amount: bigint;
  fee: bigint;
  createdAt: Date;
  from: string;
  to: string;
  description: string | null;
  reversalNote?: string | null;
};

export async function renderReceipt(r: ReceiptData) {
  return renderToBuffer(
    <Document title={`Kosh receipt ${r.reference}`} author="Kosh (simulated)">
      <Page size="A5" style={s.page}>
        <Header right="Transaction receipt" />
        <Text style={s.title}>{r.typeLabel}</Text>
        <Text style={s.muted}>{dt(r.createdAt)}</Text>
        <View style={s.hero}>
          <Text style={{ fontSize: 9, color: "#C7D2FE" }}>Amount</Text>
          <Text style={s.heroAmount}>{bdt(r.amount)}</Text>
          <Text style={{ fontSize: 9, marginTop: 6, color: "#C7D2FE" }}>Status: {r.status}</Text>
        </View>
        {(
          [
            ["Reference", r.reference],
            ["From", r.from],
            ["To", r.to],
            ["Amount", bdt(r.amount)],
            ["Fee", bdt(r.fee)],
            ["Total debited", bdt(r.amount + r.fee)],
            ...(r.description ? [["Note", r.description]] : []),
            ...(r.reversalNote ? [["Reversal", r.reversalNote]] : []),
          ] as [string, string][]
        ).map(([k, v]) => (
          <View key={k} style={s.row}>
            <Text style={s.label}>{k}</Text>
            <Text style={{ maxWidth: 220, textAlign: "right" }}>{v}</Text>
          </View>
        ))}
        <Text style={{ marginTop: 16, fontSize: 8, color: MUTED }}>
          This receipt is generated from the bank ledger. Kosh is a demonstration system; no real money was moved.
        </Text>
        <Footer />
      </Page>
    </Document>,
  );
}

export type StatementLine = { date: Date; reference: string; description: string; debit: bigint | null; credit: bigint | null; balance: bigint };
export type StatementData = {
  holder: string;
  accountNumber: string;
  accountType: string;
  from: Date;
  to: Date;
  opening: bigint;
  closing: bigint;
  totalCredits: bigint;
  totalDebits: bigint;
  lines: StatementLine[];
};

export async function renderStatement(d: StatementData) {
  const cols = [62, 112, 150, 62, 62, 70] as const;
  return renderToBuffer(
    <Document title={`Kosh statement ${d.accountNumber}`} author="Kosh (simulated)">
      <Page size="A4" style={s.page}>
        <Header right="Account statement" />
        <Text style={s.title}>{d.holder}</Text>
        <Text style={s.muted}>
          {d.accountType} account {d.accountNumber.replace(/(\d{4})(?=\d)/g, "$1 ")} · {day(d.from)} – {day(d.to)}
        </Text>
        <View style={s.summary}>
          {(
            [
              ["Opening balance", bdt(d.opening)],
              ["Money in", bdt(d.totalCredits)],
              ["Money out", bdt(d.totalDebits)],
              ["Closing balance", bdt(d.closing)],
            ] as const
          ).map(([k, v]) => (
            <View key={k} style={s.box}>
              <Text style={s.label}>{k}</Text>
              <Text style={s.boxValue}>{v}</Text>
            </View>
          ))}
        </View>
        <View style={s.th} fixed>
          {["Date", "Reference", "Description", "Debit", "Credit", "Balance"].map((h, i) => (
            <Text key={h} style={{ width: cols[i], textAlign: i >= 3 ? "right" : "left" }}>{h}</Text>
          ))}
        </View>
        {d.lines.length === 0 && <Text style={{ marginTop: 12, color: MUTED }}>No transactions in this period.</Text>}
        {d.lines.map((l, idx) => (
          <View key={idx} style={s.tr} wrap={false}>
            <Text style={{ width: cols[0] }}>{day(l.date)}</Text>
            <Text style={{ width: cols[1], fontSize: 7.5 }}>{l.reference}</Text>
            <Text style={{ width: cols[2] }}>{l.description}</Text>
            <Text style={{ width: cols[3], textAlign: "right" }}>{l.debit != null ? formatAmount(l.debit) : ""}</Text>
            <Text style={{ width: cols[4], textAlign: "right" }}>{l.credit != null ? formatAmount(l.credit) : ""}</Text>
            <Text style={{ width: cols[5], textAlign: "right" }}>{formatAmount(l.balance)}</Text>
          </View>
        ))}
        <Footer />
      </Page>
    </Document>,
  );
}
