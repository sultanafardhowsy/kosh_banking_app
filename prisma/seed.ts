/**
 * Kosh demo seed (Phase 2).
 *
 *   1 admin · 2 staff · 15 customers · 25 accounts
 *   ~6 months of backdated activity: approved deposits/withdrawals, transfers
 *   (with fees), loan disbursements and EMI repayments — every money movement
 *   has a Transaction + LedgerEntry, and every account's final balance equals
 *   its ledger. Fraud rules run on seeded transfers; one flagged transfer is reversed.
 *   Loans in every persisted status, pending/rejected requests, notifications, audit log.
 *
 * Deterministic (seeded RNG) except account numbers / references.
 * Run: npm run db:seed   — resets ALL data. Safe to re-run.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient, type AccountType, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { DEFAULT_OTP_THRESHOLD, DEFAULT_SETTINGS } from "../src/lib/constants";
import { DEMO_PASSWORD } from "../src/lib/demo-accounts";
import { generateAccountNumber, generateTxnReference } from "../src/lib/reference";
import { computeTransferFee } from "../src/lib/fees";
import { buildSchedule } from "../src/lib/emi";
import { evaluateFraud } from "../src/lib/fraud-rules";
import { formatMoney } from "../src/lib/money";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! }),
});

// ───────────────────────── helpers ─────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261121);
const randInt = (a: number, b: number) => Math.floor(rand() * (b - a + 1)) + a;
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const chance = (p: number) => rand() < p;
/** taka → paisa, rounded to a "human" amount (multiples of 10 taka) */
const taka = (n: number) => BigInt(Math.round(n)) * BigInt(100);
const roundTaka = (min: number, max: number, step = 10) => taka(Math.round(randInt(min, max) / step) * step);

const DAY = 86_400_000;
const NOW = new Date();
const SAFE_END = new Date(NOW.getTime() - 10 * 60_000);
const START = new Date(NOW.getTime() - 182 * DAY);
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY);
/** a time on a given day, between 09:00 and 21:00 Dhaka (UTC+6) */
function atBankHours(day: Date) {
  const d = new Date(day);
  d.setUTCHours(randInt(3, 15), randInt(0, 59), randInt(0, 59), 0);
  return d;
}
const id = () => randomUUID().replace(/-/g, "").slice(0, 25);

const usedRefs = new Set<string>();
function ref(prefix: string, at: Date) {
  let r: string;
  do r = generateTxnReference(prefix, at);
  while (usedRefs.has(r));
  usedRefs.add(r);
  return r;
}
const usedNumbers = new Set<string>();
function accountNumber(type: AccountType) {
  let n: string;
  do n = generateAccountNumber(type);
  while (usedNumbers.has(n));
  usedNumbers.add(n);
  return n;
}

const MIN_BALANCE = DEFAULT_SETTINGS.minimumBalance;
const FEE_SETTINGS = {
  transferFeeFlat: DEFAULT_SETTINGS.transferFeeFlat,
  transferFeePercentBps: DEFAULT_SETTINGS.transferFeePercentBps,
  transferFeeMax: DEFAULT_SETTINGS.transferFeeMax,
};

// ───────────────────────── roster ─────────────────────────
type AccSpec = { type: AccountType; nickname: string; opening: number; status?: "FROZEN" | "CLOSED" };
type CustSpec = {
  key: string;
  name: string;
  email: string;
  salary: number; // monthly deposit (taka)
  joinedDaysAgo?: number;
  status?: "BLOCKED" | "INACTIVE";
  verified?: boolean;
  accounts: AccSpec[];
};

const CUSTOMERS: CustSpec[] = [
  { key: "nusrat", name: "Nusrat Jahan", email: "customer@kosh.demo", salary: 95_000, accounts: [
    { type: "SAVINGS", nickname: "Everyday Savings", opening: 180_000 },
    { type: "CURRENT", nickname: "Current", opening: 40_000 },
    { type: "BUSINESS", nickname: "Jahan Crafts", opening: 350_000 },
  ] },
  { key: "rafi", name: "Rafiul Karim", email: "rafi@kosh.demo", salary: 45_000, accounts: [{ type: "SAVINGS", nickname: "Savings", opening: 30_000 }] },
  { key: "ayesha", name: "Ayesha Siddiqua", email: "ayesha@kosh.demo", salary: 70_000, accounts: [
    { type: "SAVINGS", nickname: "Savings", opening: 90_000 },
    { type: "CURRENT", nickname: "Salary", opening: 20_000 },
  ] },
  { key: "imran", name: "Imran Hossain", email: "imran@kosh.demo", salary: 60_000, accounts: [
    { type: "CURRENT", nickname: "Personal", opening: 35_000 },
    { type: "BUSINESS", nickname: "Hossain Traders", opening: 600_000 },
  ] },
  { key: "sadia", name: "Sadia Afrin", email: "sadia@kosh.demo", salary: 38_000, accounts: [{ type: "SAVINGS", nickname: "Savings", opening: 25_000 }] },
  { key: "kamrul", name: "Kamrul Hasan", email: "kamrul@kosh.demo", salary: 60_000, accounts: [
    { type: "SAVINGS", nickname: "Savings", opening: 50_000 },
    { type: "CURRENT", nickname: "Current", opening: 15_000 },
  ] },
  { key: "taslima", name: "Taslima Begum", email: "taslima@kosh.demo", salary: 32_000, accounts: [{ type: "SAVINGS", nickname: "Savings", opening: 22_000 }] },
  { key: "mehedi", name: "Mehedi Hasan", email: "mehedi@kosh.demo", salary: 55_000, accounts: [
    { type: "BUSINESS", nickname: "Mehedi Electronics", opening: 420_000 },
    { type: "CURRENT", nickname: "Current", opening: 30_000, status: "FROZEN" },
  ] },
  { key: "fatema", name: "Fatema Khatun", email: "fatema@kosh.demo", salary: 52_000, accounts: [
    { type: "SAVINGS", nickname: "Savings", opening: 60_000 },
    { type: "CURRENT", nickname: "Household", opening: 12_000 },
  ] },
  { key: "arif", name: "Arif Chowdhury", email: "arif@kosh.demo", salary: 85_000, status: "BLOCKED", accounts: [
    { type: "SAVINGS", nickname: "Savings", opening: 120_000 },
    { type: "CURRENT", nickname: "Current", opening: 25_000 },
  ] },
  { key: "shirin", name: "Shirin Akter", email: "shirin@kosh.demo", salary: 41_000, accounts: [{ type: "SAVINGS", nickname: "Savings", opening: 28_000 }] },
  { key: "zahid", name: "Zahid Rahman", email: "zahid@kosh.demo", salary: 66_000, accounts: [
    { type: "CURRENT", nickname: "Current", opening: 45_000 },
    { type: "SAVINGS", nickname: "Rainy-day fund", opening: 80_000 },
  ] },
  { key: "nadia", name: "Nadia Islam", email: "nadia@kosh.demo", salary: 36_000, joinedDaysAgo: 20, verified: false, accounts: [{ type: "SAVINGS", nickname: "Savings", opening: 10_000 }] },
  { key: "sabbir", name: "Sabbir Ahmed", email: "sabbir@kosh.demo", salary: 47_000, accounts: [
    { type: "SAVINGS", nickname: "Savings", opening: 40_000 },
    { type: "CURRENT", nickname: "Old current", opening: 0, status: "CLOSED" },
  ] },
  { key: "lamia", name: "Lamia Haque", email: "lamia@kosh.demo", salary: 18_000, status: "INACTIVE", verified: false, accounts: [{ type: "SAVINGS", nickname: "Savings", opening: 3_000 }] },
];

const AREAS = ["Dhanmondi", "Mirpur", "Uttara", "Gulshan", "Mohammadpur", "Banani", "Bashundhara", "Motijheel", "Old Dhaka", "Khilgaon"];
const TRANSFER_NOTES = ["Rent share", "Dinner", "Groceries", "Family support", "Tuition fee", "Gift", "Loan return", "Electricity bill", "Supplier payment", "Shopping", "Tickets", "Internet bill", ""];

// ───────────────────────── in-memory model ─────────────────────────
type AccRow = {
  id: string; userId: string; custKey: string; type: AccountType; nickname: string; number: string;
  opening: bigint; status: "ACTIVE" | "FROZEN" | "CLOSED"; openedAt: Date; balance: bigint;
  transferHistory: { at: Date; amount: bigint }[];
};
type TxnRow = Prisma.TransactionCreateManyInput & { id: string };
type LedgerRow = Prisma.LedgerEntryCreateManyInput;

const txns: TxnRow[] = [];
const reversalTxns: TxnRow[] = [];
const ledger: LedgerRow[] = [];
const requests: Prisma.DepositWithdrawalRequestCreateManyInput[] = [];
const audit: Prisma.AuditLogCreateManyInput[] = [];
const notifications: Prisma.NotificationCreateManyInput[] = [];

type Ev =
  | { at: Date; kind: "OPEN"; acc: AccRow }
  | { at: Date; kind: "DEPOSIT" | "WITHDRAWAL"; acc: AccRow; amount: bigint; desc: string }
  | { at: Date; kind: "TRANSFER"; from: AccRow; to: AccRow; amount: bigint; desc: string; evId: string }
  | { at: Date; kind: "REVERSE"; ofEvId: string; reason: string }
  | { at: Date; kind: "DISBURSE"; loanId: string; acc: AccRow; amount: bigint }
  | { at: Date; kind: "REPAY"; loanId: string; installmentId: string; acc: AccRow; amount: bigint }
  | { at: Date; kind: "CARD"; cardId: string; last4: string; acc: AccRow; amount: bigint; merchant: string };

async function main() {
  console.log("Resetting…");
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE ledger_entries, loan_installments, loan_notes, deposit_withdrawal_requests, loans, transactions,
     cards, security_events, notifications, email_logs, otp_challenges, audit_logs, accounts, customer_profiles, bank_settings, sessions,
     auth_accounts, verifications, users RESTART IDENTITY CASCADE`,
  );

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const pinHash = await bcrypt.hash("1234", 10);

  // ── staff & admin
  const users: Prisma.UserCreateManyInput[] = [];
  const authRows: Prisma.AuthAccountCreateManyInput[] = [];
  const addUser = (u: Omit<Prisma.UserCreateManyInput, "id"> & { id?: string }) => {
    const row = { id: u.id ?? id(), emailVerified: true, ...u };
    users.push(row);
    authRows.push({ id: `cred_${row.id}`, accountId: row.id!, providerId: "credential", userId: row.id!, password: passwordHash, createdAt: row.createdAt as Date });
    return row.id!;
  };
  const adminId = addUser({ name: "Farhana Islam", email: "admin@kosh.demo", role: "ADMIN", isVerified: true, createdAt: daysAgo(400) });
  const staffIds = [
    addUser({ name: "Tanvir Ahmed", email: "staff@kosh.demo", role: "STAFF", isVerified: true, createdAt: daysAgo(300) }),
    addUser({ name: "Mahmud Hasan", email: "staff2@kosh.demo", role: "STAFF", isVerified: true, createdAt: daysAgo(250) }),
  ];
  const staff = () => pick(staffIds);

  // ── customers + accounts
  const custIds: Record<string, string> = {};
  const profiles: Prisma.CustomerProfileCreateManyInput[] = [];
  const accounts: AccRow[] = [];

  CUSTOMERS.forEach((c, i) => {
    const joined = c.joinedDaysAgo ? daysAgo(c.joinedDaysAgo) : new Date(START.getTime() - randInt(5, 60) * DAY);
    const verified = c.verified ?? true;
    const uid = addUser({ name: c.name, email: c.email, role: "CUSTOMER", status: c.status ?? "ACTIVE", isVerified: verified, createdAt: joined });
    custIds[c.key] = uid;
    const verifier = staff();
    profiles.push({
      userId: uid,
      phone: `+88017${String(10000000 + i * 7919).slice(0, 8)}`,
      address: `House ${randInt(1, 90)}, Road ${randInt(1, 30)}, ${pick(AREAS)}, Dhaka`,
      nid: `DEMO-${String(1000000000 + i * 104729)}`,
      dateOfBirth: new Date(Date.UTC(randInt(1975, 2002), randInt(0, 11), randInt(1, 28))),
      verifiedById: verified ? verifier : null,
      verifiedAt: verified ? new Date(joined.getTime() + DAY) : null,
      createdAt: joined,
    });
    if (verified) audit.push({ actorId: verifier, action: "CUSTOMER_VERIFIED", entity: "User", entityId: uid, createdAt: new Date(joined.getTime() + DAY) });

    for (const a of c.accounts) {
      const openedAt = c.joinedDaysAgo ? new Date(joined.getTime() + 2 * DAY) : new Date(START.getTime() + randInt(0, 3) * DAY);
      accounts.push({
        id: id(), userId: uid, custKey: c.key, type: a.type, nickname: a.nickname, number: accountNumber(a.type),
        opening: taka(a.opening), status: a.status ?? "ACTIVE", openedAt: atBankHours(openedAt), balance: BigInt(0), transferHistory: [],
      });
    }
  });

  const accsOf = (key: string) => accounts.filter((a) => a.custKey === key);
  const acc = (key: string, type: AccountType) => accsOf(key).find((a) => a.type === type)!;
  const custOf = (a: AccRow) => CUSTOMERS.find((c) => c.key === a.custKey)!;

  // ── loans (definitions; money events generated below)
  type LoanDef = {
    id: string; key: string; acc: AccRow; loanType: "PERSONAL" | "HOME" | "AUTO" | "EDUCATION" | "BUSINESS";
    principal: bigint; rateBps: number; months: number; income: bigint;
    employment: "SALARIED" | "SELF_EMPLOYED" | "BUSINESS_OWNER"; desc: string;
    status: "PENDING" | "UNDER_REVIEW" | "REJECTED" | "ACTIVE" | "COMPLETED";
    appliedAt: Date; disbursedAt?: Date; paidCount?: number; overdue?: boolean; rejection?: string;
  };
  const loanDefs: LoanDef[] = [
    { id: id(), key: "nusrat", acc: acc("nusrat", "SAVINGS"), loanType: "PERSONAL", principal: taka(300_000), rateBps: 1100, months: 24, income: taka(95_000), employment: "SALARIED", desc: "Home renovation", status: "ACTIVE", appliedAt: daysAgo(160), disbursedAt: daysAgo(152), paidCount: 5 },
    { id: id(), key: "kamrul", acc: acc("kamrul", "SAVINGS"), loanType: "AUTO", principal: taka(450_000), rateBps: 1250, months: 12, income: taka(60_000), employment: "SALARIED", desc: "Used car purchase", status: "ACTIVE", appliedAt: daysAgo(110), disbursedAt: daysAgo(100), paidCount: 2, overdue: true },
    { id: id(), key: "imran", acc: acc("imran", "BUSINESS"), loanType: "BUSINESS", principal: taka(800_000), rateBps: 1350, months: 18, income: taka(180_000), employment: "BUSINESS_OWNER", desc: "Inventory expansion before Eid", status: "ACTIVE", appliedAt: daysAgo(75), disbursedAt: daysAgo(68), paidCount: 2 },
    { id: id(), key: "taslima", acc: acc("taslima", "SAVINGS"), loanType: "EDUCATION", principal: taka(60_000), rateBps: 900, months: 4, income: taka(32_000), employment: "SALARIED", desc: "Diploma course fee", status: "COMPLETED", appliedAt: daysAgo(178), disbursedAt: daysAgo(172), paidCount: 4 },
    { id: id(), key: "shirin", acc: acc("shirin", "SAVINGS"), loanType: "PERSONAL", principal: taka(80_000), rateBps: 1200, months: 12, income: taka(41_000), employment: "SALARIED", desc: "Medical expenses for family", status: "PENDING", appliedAt: daysAgo(2) },
    { id: id(), key: "rafi", acc: acc("rafi", "SAVINGS"), loanType: "EDUCATION", principal: taka(120_000), rateBps: 950, months: 18, income: taka(45_000), employment: "SALARIED", desc: "Master's tuition", status: "PENDING", appliedAt: daysAgo(1) },
    { id: id(), key: "zahid", acc: acc("zahid", "CURRENT"), loanType: "HOME", principal: taka(2_500_000), rateBps: 1050, months: 60, income: taka(66_000), employment: "SALARIED", desc: "Flat down-payment top-up", status: "UNDER_REVIEW", appliedAt: daysAgo(9) },
    { id: id(), key: "fatema", acc: acc("fatema", "SAVINGS"), loanType: "PERSONAL", principal: taka(150_000), rateBps: 1200, months: 12, income: taka(52_000), employment: "SALARIED", desc: "Wedding expenses", status: "UNDER_REVIEW", appliedAt: daysAgo(6) },
    { id: id(), key: "lamia", acc: acc("lamia", "SAVINGS"), loanType: "PERSONAL", principal: taka(200_000), rateBps: 1400, months: 24, income: taka(18_000), employment: "SELF_EMPLOYED", desc: "Start a home bakery", status: "REJECTED", appliedAt: daysAgo(40), rejection: "EMI would exceed 50% of stated monthly income." },
    { id: id(), key: "sadia", acc: acc("sadia", "SAVINGS"), loanType: "AUTO", principal: taka(900_000), rateBps: 1250, months: 36, income: taka(38_000), employment: "SALARIED", desc: "New car", status: "REJECTED", appliedAt: daysAgo(25), rejection: "Insufficient repayment capacity and short account history." },
  ];

  // ── build event list
  const events: Ev[] = [];
  for (const a of accounts) events.push({ at: a.openedAt, kind: "OPEN", acc: a });

  const transferable = accounts.filter((a) => a.status !== "CLOSED");
  for (const a of accounts) {
    if (a.status === "CLOSED") continue;
    const c = custOf(a);
    const from = Math.max(a.openedAt.getTime() + DAY, START.getTime());
    const isBiz = a.type === "BUSINESS";
    const perMonth = isBiz ? 10 : a.type === "CURRENT" ? 7 : 5;
    // inactive/blocked users stop around 3 weeks / 10 days ago
    const end = c.status === "INACTIVE" ? daysAgo(30).getTime() : c.status === "BLOCKED" ? daysAgo(10).getTime() : SAFE_END.getTime();
    if (a.status === "FROZEN") {
      /* frozen 12 days ago: activity stops there */
    }
    const stop = a.status === "FROZEN" ? Math.min(end, daysAgo(12).getTime()) : end;

    for (let t = from; t < stop; t += DAY) {
      const day = new Date(t);
      const dom = day.getUTCDate();
      // income
      if (!isBiz && dom === 1 && (a.type === "CURRENT" || accsOf(a.custKey).length === 1 || a.type === "SAVINGS")) {
        if (a === accsOf(a.custKey).find((x) => x.type !== "BUSINESS")) {
          events.push({ at: atBankHours(day), kind: "DEPOSIT", acc: a, amount: taka(c.salary + randInt(-2, 2) * 500), desc: "Salary deposit" });
        }
      }
      if (isBiz && chance(3 / 30)) events.push({ at: atBankHours(day), kind: "DEPOSIT", acc: a, amount: roundTaka(30_000, 150_000, 1000), desc: pick(["Cash sales deposit", "Client payment", "Wholesale receipts"]) });
      // withdrawals
      if (chance((isBiz ? 3 : 3.2) / 30)) events.push({ at: atBankHours(day), kind: "WITHDRAWAL", acc: a, amount: roundTaka(3_000, isBiz ? 90_000 : 24_000, 500), desc: pick(["Cash withdrawal", "ATM-style cash out", "Branch withdrawal"]) });
      // transfers out
      if (chance(perMonth / 30)) {
        const ownOther = accsOf(a.custKey).filter((x) => x !== a && x.status === "ACTIVE");
        const to = ownOther.length && chance(0.15) ? pick(ownOther) : pick(transferable.filter((x) => x.custKey !== a.custKey));
        events.push({ at: atBankHours(day), kind: "TRANSFER", from: a, to, amount: roundTaka(300, isBiz ? 80_000 : 18_000), desc: isBiz ? pick(["Supplier payment", "Staff salary", "Logistics", "Rent", "Utility bill"]) : pick(TRANSFER_NOTES), evId: id() });
      }
    }
  }

  // Scripted moments for the demo
  // 1) A burst + a large transfer from Mehedi's current account right before it got frozen (flagged).
  const mehediCur = acc("mehedi", "CURRENT");
  for (let i = 0; i < 6; i++) {
    events.push({ at: new Date(daysAgo(13).getTime() + i * 90_000), kind: "TRANSFER", from: mehediCur, to: pick(transferable.filter((x) => x.custKey !== "mehedi" && x.status === "ACTIVE")), amount: roundTaka(1_000, 3_000), desc: "", evId: id() });
  }
  // 2) Arif sends most of his savings to Sadia (flagged) — admin reverses it next day; Arif later blocked.
  const bigEv = id();
  events.push({ at: atBankHours(daysAgo(14)), kind: "TRANSFER", from: acc("arif", "SAVINGS"), to: acc("sadia", "SAVINGS"), amount: BigInt(0) /* set at apply time: 85% of balance */, desc: "Urgent", evId: bigEv });
  events.push({ at: atBankHours(daysAgo(13)), kind: "REVERSE", ofEvId: bigEv, reason: "Customer reported account takeover; confirmed by call-back" });
  // 3) Nusrat: a few very recent transfers so her dashboard is lively.
  const nus = acc("nusrat", "SAVINGS");
  [3, 2, 1, 0].forEach((d) => {
    const at = d === 0 ? new Date(NOW.getTime() - 2 * 3600_000) : atBankHours(daysAgo(d));
    events.push({ at, kind: "TRANSFER", from: nus, to: pick([acc("rafi", "SAVINGS"), acc("ayesha", "SAVINGS"), acc("fatema", "CURRENT")]), amount: roundTaka(800, 6_500), desc: pick(["Dinner", "Groceries", "Rent share", "Gift"]), evId: id() });
  });
  events.push({ at: atBankHours(daysAgo(1)), kind: "TRANSFER", from: acc("ayesha", "SAVINGS"), to: nus, amount: taka(12_500), desc: "Trip split", evId: id() });

  // Loans → disbursement + repayment events + installment rows
  const loanRows: Prisma.LoanCreateManyInput[] = [];
  const installmentRows: (Prisma.LoanInstallmentCreateManyInput & { id: string })[] = [];
  const loanNotes: Prisma.LoanNoteCreateManyInput[] = [];
  const loanDisbTxn: Record<string, string> = {};

  for (const L of loanDefs) {
    const userId = custIds[L.key]!;
    const base: Prisma.LoanCreateManyInput = {
      id: L.id, userId, accountId: L.acc.id, loanType: L.loanType, principal: L.principal, interestRateBps: L.rateBps,
      durationMonths: L.months, monthlyIncome: L.income, employmentStatus: L.employment, description: L.desc,
      status: L.status, remainingBalance: BigInt(0), createdAt: L.appliedAt,
    };
    const reviewer = staff();
    if (L.status !== "PENDING") {
      loanNotes.push({ loanId: L.id, authorId: reviewer, note: "Income documents checked against deposits on file.", createdAt: new Date(L.appliedAt.getTime() + 0.6 * DAY) });
      loanNotes.push({ loanId: L.id, authorId: reviewer, note: L.status === "REJECTED" ? "Debt-to-income looks high — forwarding for admin decision." : "Repayment history and balances look healthy. Recommend approval.", createdAt: new Date(L.appliedAt.getTime() + 1.2 * DAY) });
      base.forwardedById = reviewer;
      base.forwardedAt = new Date(L.appliedAt.getTime() + 1.3 * DAY);
      audit.push({ actorId: reviewer, action: "LOAN_FORWARDED", entity: "Loan", entityId: L.id, createdAt: base.forwardedAt as Date });
    }
    if (L.status === "REJECTED") {
      base.approvedById = adminId;
      base.decidedAt = new Date(L.appliedAt.getTime() + 2.5 * DAY);
      base.rejectionReason = L.rejection;
      audit.push({ actorId: adminId, action: "LOAN_REJECTED", entity: "Loan", entityId: L.id, metadata: { reason: L.rejection }, createdAt: base.decidedAt as Date });
      notifications.push({ userId, type: "LOAN_REJECTED", title: "Loan application rejected", body: L.rejection!, link: `/loans/${L.id}`, isRead: true, createdAt: base.decidedAt as Date });
    }
    if (L.status === "ACTIVE" || L.status === "COMPLETED") {
      const sched = buildSchedule(L.principal, L.rateBps, L.months, L.disbursedAt!);
      base.approvedById = adminId;
      base.decidedAt = L.disbursedAt;
      base.emiAmount = sched.emi;
      base.totalPayable = sched.totalPayable;
      audit.push({ actorId: adminId, action: "LOAN_APPROVED", entity: "Loan", entityId: L.id, metadata: { principal: L.principal.toString() }, createdAt: L.disbursedAt! });
      events.push({ at: L.disbursedAt!, kind: "DISBURSE", loanId: L.id, acc: L.acc, amount: L.principal });
      let remaining = sched.totalPayable;
      sched.rows.forEach((r) => {
        const instId = id();
        const paid = r.installmentNo <= (L.paidCount ?? 0) && r.dueDate < SAFE_END;
        const overdue = !paid && r.dueDate < NOW;
        installmentRows.push({ id: instId, loanId: L.id, installmentNo: r.installmentNo, dueDate: r.dueDate, amountDue: r.amountDue, principalPart: r.principalPart, interestPart: r.interestPart, status: paid ? "PAID" : overdue ? "OVERDUE" : "DUE" });
        if (paid) {
          remaining -= r.amountDue;
          events.push({ at: new Date(r.dueDate.getTime() - randInt(0, 2) * DAY + randInt(3, 12) * 3600_000), kind: "REPAY", loanId: L.id, installmentId: instId, acc: L.acc, amount: r.amountDue });
        }
      });
      base.remainingBalance = L.status === "COMPLETED" ? BigInt(0) : remaining;
    }
    loanRows.push(base);
  }

  // ── virtual cards (simulated) + card payments
  const MERCHANTS = ["Shwapno", "Daraz", "Foodpanda", "Pathao", "Aarong", "Bata", "Unimart", "Grameenphone", "Star Cineplex", "Chaldal"];
  const cardRows: Prisma.CardCreateManyInput[] = [];
  const cardFor = (key: string, type: AccountType, status: "ACTIVE" | "FROZEN" | "BLOCKED" | "REQUESTED" | "REJECTED", network: "VISA" | "MASTERCARD", issuedDaysAgo: number) => {
    const a = acc(key, type);
    const last4 = String(randInt(1000, 9999));
    const issued = daysAgo(issuedDaysAgo);
    const isIssued = status === "ACTIVE" || status === "FROZEN" || status === "BLOCKED";
    const row: Prisma.CardCreateManyInput = {
      id: id(), accountId: a.id, userId: a.userId, cardholderName: custOf(a).name.toUpperCase(), network, status,
      cardNumberMasked: isIssued ? `${network === "VISA" ? "4000" : "5100"} •••• •••• ${last4}` : "Pending approval",
      last4: isIssued ? last4 : "----",
      expiryMonth: isIssued ? issued.getUTCMonth() + 1 : 0,
      expiryYear: isIssued ? issued.getUTCFullYear() + 3 : 0,
      dailySpendLimit: taka(25_000), approvedById: status === "REQUESTED" ? null : staff(), createdAt: new Date(issued.getTime() - 2 * DAY),
    };
    cardRows.push(row);
    if (isIssued) {
      audit.push({ actorId: row.approvedById!, action: "CARD_APPROVED", entity: "Card", entityId: row.id!, metadata: { last4 }, createdAt: issued });
      // ~3 payments a week until today (or until frozen/blocked)
      const stopAt = status === "ACTIVE" ? SAFE_END.getTime() : daysAgo(12).getTime();
      for (let t = issued.getTime() + DAY; t < stopAt; t += DAY) {
        if (chance(3 / 7)) events.push({ at: atBankHours(new Date(t)), kind: "CARD", cardId: row.id!, last4, acc: a, amount: roundTaka(150, 4_500), merchant: pick(MERCHANTS) });
      }
    }
    return row;
  };
  cardFor("nusrat", "SAVINGS", "ACTIVE", "VISA", 70);
  cardFor("nusrat", "BUSINESS", "REQUESTED", "MASTERCARD", 1);
  cardFor("ayesha", "SAVINGS", "REQUESTED", "VISA", 2);
  cardFor("imran", "CURRENT", "FROZEN", "MASTERCARD", 50);
  const arifCard = cardFor("arif", "SAVINGS", "BLOCKED", "VISA", 60);
  audit.push({ actorId: adminId, action: "CARD_BLOCKED", entity: "Card", entityId: arifCard.id!, metadata: { reason: "Account takeover reported" }, createdAt: daysAgo(10) });
  cardFor("fatema", "CURRENT", "ACTIVE", "VISA", 40);
  cardFor("sadia", "SAVINGS", "REJECTED", "VISA", 15);

  // ── apply chronologically
  events.sort((a, b) => a.at.getTime() - b.at.getTime() || (a.kind === "OPEN" ? -1 : 0));
  const txnByEv = new Map<string, TxnRow>();
  const instPaid = new Map<string, { txnId: string; at: Date }>();
  let skipped = 0;

  const addLedger = (txnId: string, a: AccRow, direction: "DEBIT" | "CREDIT", amount: bigint, at: Date) => {
    a.balance = direction === "CREDIT" ? a.balance + amount : a.balance - amount;
    ledger.push({ transactionId: txnId, accountId: a.id, direction, amount, balanceAfter: a.balance, createdAt: at });
  };

  for (const ev of events) {
    if (ev.at > SAFE_END) continue;
    switch (ev.kind) {
      case "OPEN": {
        audit.push({ actorId: staff(), action: "ACCOUNT_CREATED", entity: "Account", entityId: ev.acc.id, metadata: { type: ev.acc.type }, createdAt: ev.at });
        if (ev.acc.opening > BigInt(0)) {
          const t: TxnRow = { id: id(), reference: ref("DEP", ev.at), type: "DEPOSIT", amount: ev.acc.opening, status: "COMPLETED", receiverAccountId: ev.acc.id, description: "Opening deposit", initiatedById: ev.acc.userId, createdAt: ev.at };
          txns.push(t);
          addLedger(t.id, ev.acc, "CREDIT", ev.acc.opening, ev.at);
        }
        break;
      }
      case "DEPOSIT":
      case "WITHDRAWAL": {
        const isDep = ev.kind === "DEPOSIT";
        if (!isDep && ev.acc.balance - ev.amount < MIN_BALANCE) { skipped++; break; }
        const requestedAt = new Date(ev.at.getTime() - randInt(1, 5) * 3600_000);
        const reviewer = staff();
        const t: TxnRow = { id: id(), reference: ref(isDep ? "DEP" : "WDR", ev.at), type: ev.kind, amount: ev.amount, status: "COMPLETED", senderAccountId: isDep ? null : ev.acc.id, receiverAccountId: isDep ? ev.acc.id : null, description: ev.desc, initiatedById: ev.acc.userId, createdAt: ev.at };
        txns.push(t);
        addLedger(t.id, ev.acc, isDep ? "CREDIT" : "DEBIT", ev.amount, ev.at);
        const reqId = id();
        requests.push({ id: reqId, accountId: ev.acc.id, type: ev.kind, amount: ev.amount, description: ev.desc, status: "APPROVED", requestedById: ev.acc.userId, reviewedById: reviewer, reviewedAt: ev.at, transactionId: t.id, createdAt: requestedAt });
        audit.push({ actorId: reviewer, action: `${ev.kind}_APPROVED`, entity: "DepositWithdrawalRequest", entityId: reqId, metadata: { amount: ev.amount.toString(), transactionId: t.id }, createdAt: ev.at });
        if (ev.acc.custKey === "nusrat") notifications.push({ userId: ev.acc.userId, type: "REQUEST_APPROVED", title: `${isDep ? "Deposit" : "Withdrawal"} approved`, body: `${formatMoney(ev.amount)} · Ref ${t.reference}`, link: `/transactions/${t.id}`, createdAt: ev.at });
        break;
      }
      case "TRANSFER": {
        const { from, to } = ev;
        if (from.status === "CLOSED" || to.status === "CLOSED") { skipped++; break; }
        // the live service refuses transfers to frozen accounts / blocked or inactive users
        const toCust = custOf(to);
        const cutoff = to.status === "FROZEN" ? daysAgo(12) : toCust.status === "BLOCKED" ? daysAgo(10) : toCust.status === "INACTIVE" ? daysAgo(30) : null;
        if (cutoff && ev.at >= cutoff) { skipped++; break; }
        let amount = ev.amount;
        if (amount === BigInt(0)) amount = ((from.balance - MIN_BALANCE) * BigInt(85)) / BigInt(100) / BigInt(100) * BigInt(100);
        const fee = computeTransferFee(amount, FEE_SETTINGS);
        if (from.balance - amount - fee < MIN_BALANCE) { skipped++; break; }

        const recent30 = from.transferHistory.filter((h) => h.at.getTime() >= ev.at.getTime() - 30 * DAY);
        const reasons = evaluateFraud({
          amount,
          balanceBefore: from.balance,
          recentTransferCount: from.transferHistory.filter((h) => h.at.getTime() >= ev.at.getTime() - 10 * 60_000).length + 1,
          avgAmount30d: recent30.length ? recent30.reduce((s, h) => s + h.amount, BigInt(0)) / BigInt(recent30.length) : null,
          sampleCount30d: recent30.length,
          failedPinsLastHour: 0,
        });
        const t: TxnRow = {
          id: id(), reference: ref("TXN", ev.at), type: "TRANSFER", amount, fee, status: "COMPLETED", senderAccountId: from.id, receiverAccountId: to.id,
          description: ev.desc || null, idempotencyKey: `seed-${ev.evId}`, initiatedById: from.userId, createdAt: ev.at,
          isFlagged: reasons.length > 0, flagReason: reasons.length ? reasons.join("; ") : null, flaggedAt: reasons.length ? ev.at : null,
          // older auto-flags were reviewed and cleared by an admin
          flagResolvedAt: reasons.length && ev.at < daysAgo(45) ? new Date(ev.at.getTime() + DAY) : null,
        };
        txns.push(t);
        txnByEv.set(ev.evId, t);
        addLedger(t.id, from, "DEBIT", amount + fee, ev.at);
        addLedger(t.id, to, "CREDIT", amount, ev.at);
        from.transferHistory.push({ at: ev.at, amount });
        if (to.custKey === "nusrat") notifications.push({ userId: to.userId, type: "TRANSFER_RECEIVED", title: `Received ${formatMoney(amount)}`, body: `From ${custOf(from).name.split(" ")[0]} · Ref ${t.reference}`, link: `/transactions/${t.id}`, createdAt: ev.at });
        if (from.custKey === "nusrat") notifications.push({ userId: from.userId, type: "TRANSFER_SENT", title: `Sent ${formatMoney(amount)}`, body: `To ${custOf(to).name.split(" ")[0]} · Fee ${formatMoney(fee)} · Ref ${t.reference}`, link: `/transactions/${t.id}`, createdAt: ev.at });
        break;
      }
      case "REVERSE": {
        const orig = txnByEv.get(ev.ofEvId);
        if (!orig) { skipped++; break; }
        const from = accounts.find((a) => a.id === orig.senderAccountId)!;
        const to = accounts.find((a) => a.id === orig.receiverAccountId)!;
        const amount = orig.amount as bigint;
        const fee = (orig.fee ?? BigInt(0)) as bigint;
        if (to.balance < amount) { skipped++; break; }
        const r: TxnRow = { id: id(), reference: ref("REV", ev.at), type: "REVERSAL", amount, fee, status: "COMPLETED", senderAccountId: to.id, receiverAccountId: from.id, description: `Reversal of ${orig.reference}: ${ev.reason}`, reversedTxnId: orig.id, initiatedById: adminId, createdAt: ev.at };
        reversalTxns.push(r);
        orig.status = "REVERSED";
        orig.flagResolvedAt = ev.at;
        addLedger(r.id, to, "DEBIT", amount, ev.at);
        addLedger(r.id, from, "CREDIT", amount + fee, ev.at);
        audit.push({ actorId: adminId, action: "TRANSACTION_REVERSED", entity: "Transaction", entityId: orig.id, metadata: { reason: ev.reason, reversalId: r.id }, createdAt: ev.at });
        break;
      }
      case "DISBURSE": {
        const t: TxnRow = { id: id(), reference: ref("LND", ev.at), type: "LOAN_DISBURSEMENT", amount: ev.amount, status: "COMPLETED", receiverAccountId: ev.acc.id, description: "Loan disbursement", initiatedById: adminId, createdAt: ev.at };
        txns.push(t);
        loanDisbTxn[ev.loanId] = t.id;
        addLedger(t.id, ev.acc, "CREDIT", ev.amount, ev.at);
        if (ev.acc.custKey === "nusrat") notifications.push({ userId: ev.acc.userId, type: "LOAN_APPROVED", title: "Loan approved & disbursed", body: `${formatMoney(ev.amount)} credited to your savings account.`, link: `/loans/${ev.loanId}`, isRead: true, createdAt: ev.at });
        break;
      }
      case "CARD": {
        if (ev.acc.status !== "ACTIVE" || ev.acc.balance - ev.amount < MIN_BALANCE) { skipped++; break; }
        const t: TxnRow = { id: id(), reference: ref("CRD", ev.at), type: "CARD_PAYMENT", amount: ev.amount, status: "COMPLETED", senderAccountId: ev.acc.id, cardId: ev.cardId, merchant: ev.merchant, description: `Card •••• ${ev.last4} at ${ev.merchant}`, initiatedById: ev.acc.userId, createdAt: ev.at };
        txns.push(t);
        addLedger(t.id, ev.acc, "DEBIT", ev.amount, ev.at);
        break;
      }
      case "REPAY": {
        // Repayments are honoured even if they dip close to the minimum (the account is topped up by salary).
        const t: TxnRow = { id: id(), reference: ref("LNR", ev.at), type: "LOAN_REPAYMENT", amount: ev.amount, status: "COMPLETED", senderAccountId: ev.acc.id, description: "Loan EMI", initiatedById: ev.acc.userId, createdAt: ev.at };
        txns.push(t);
        addLedger(t.id, ev.acc, "DEBIT", ev.amount, ev.at);
        instPaid.set(ev.installmentId, { txnId: t.id, at: ev.at });
        break;
      }
    }
  }

  // sanity: no balance below zero, ledger == balance
  for (const a of accounts) {
    if (a.balance < BigInt(0)) throw new Error(`Negative balance on ${a.custKey}/${a.type}`);
  }
  for (const row of installmentRows) {
    const p = instPaid.get(row.id);
    if (p) Object.assign(row, { paidTxnId: p.txnId, paidAt: p.at });
  }
  for (const l of loanRows) if (loanDisbTxn[l.id!]) l.disbursementTxnId = loanDisbTxn[l.id!];

  // ── manual flags by staff (open, for the review queue)
  const candidates = txns.filter((t) => t.type === "TRANSFER" && !t.isFlagged && (t.createdAt as Date) > daysAgo(10));
  for (const t of candidates.slice(-2)) {
    const by = staff();
    Object.assign(t, { isFlagged: true, flagReason: "Manual flag by staff: recipient name doesn't match the stated purpose", flaggedById: by, flaggedAt: new Date((t.createdAt as Date).getTime() + 3600_000) });
    audit.push({ actorId: by, action: "TRANSACTION_FLAGGED", entity: "Transaction", entityId: t.id, createdAt: t.flaggedAt as Date });
  }

  // ── pending + rejected requests
  const pendingSpecs: [string, AccountType, "DEPOSIT" | "WITHDRAWAL", number, string][] = [
    ["nusrat", "CURRENT", "DEPOSIT", 25_000, "Cash from freelance project"],
    ["rafi", "SAVINGS", "WITHDRAWAL", 8_000, "Cash for travel"],
    ["fatema", "CURRENT", "DEPOSIT", 15_000, "Household savings"],
    ["imran", "BUSINESS", "WITHDRAWAL", 75_000, "Supplier cash payment"],
    ["zahid", "SAVINGS", "DEPOSIT", 40_000, "Bonus"],
    ["nadia", "SAVINGS", "DEPOSIT", 5_000, "First deposit top-up"],
  ];
  pendingSpecs.forEach(([k, type, rtype, amt, desc], i) => {
    const a = acc(k, type);
    requests.push({ id: id(), accountId: a.id, type: rtype, amount: taka(amt), description: desc, status: "PENDING", requestedById: a.userId, createdAt: new Date(NOW.getTime() - (i * 5 + 1) * 3600_000) });
  });
  const rejectedSpecs: [string, AccountType, "DEPOSIT" | "WITHDRAWAL", number, string][] = [
    ["sabbir", "SAVINGS", "WITHDRAWAL", 60_000, "Withdrawal would breach the minimum balance at review time."],
    ["kamrul", "CURRENT", "WITHDRAWAL", 30_000, "Signature on the slip did not match our records."],
    ["nusrat", "BUSINESS", "DEPOSIT", 500_000, "Source of funds document missing — please resubmit with invoice."],
  ];
  rejectedSpecs.forEach(([k, type, rtype, amt, note], i) => {
    const a = acc(k, type);
    const at = daysAgo(8 + i * 9);
    const reviewer = staff();
    const reqId = id();
    requests.push({ id: reqId, accountId: a.id, type: rtype, amount: taka(amt), status: "REJECTED", requestedById: a.userId, reviewedById: reviewer, reviewNote: note, reviewedAt: new Date(at.getTime() + 4 * 3600_000), createdAt: at });
    audit.push({ actorId: reviewer, action: `${rtype}_REJECTED`, entity: "DepositWithdrawalRequest", entityId: reqId, metadata: { note }, createdAt: new Date(at.getTime() + 4 * 3600_000) });
    if (k === "nusrat") notifications.push({ userId: a.userId, type: "REQUEST_REJECTED", title: "Deposit request rejected", body: note, link: "/requests", isRead: true, createdAt: new Date(at.getTime() + 4 * 3600_000) });
  });

  // ── status changes (audit)
  audit.push({ actorId: adminId, action: "ACCOUNT_FROZEN", entity: "Account", entityId: mehediCur.id, metadata: { reason: "Burst of small transfers — under investigation" }, createdAt: daysAgo(12) });
  audit.push({ actorId: adminId, action: "USER_BLOCKED", entity: "User", entityId: custIds.arif!, metadata: { reason: "Account takeover reported" }, createdAt: daysAgo(10) });
  audit.push({ actorId: adminId, action: "USER_DEACTIVATED", entity: "User", entityId: custIds.lamia!, metadata: { reason: "Customer request" }, createdAt: daysAgo(30) });
  audit.push({ actorId: adminId, action: "SETTINGS_UPDATED", entity: "BankSettings", entityId: "1", metadata: { transferFeePercentBps: 25 }, createdAt: daysAgo(90) });
  audit.push({ actorId: staff(), action: "ACCOUNT_CLOSED", entity: "Account", entityId: acc("sabbir", "CURRENT").id, createdAt: daysAgo(45) });

  // Upcoming EMI reminder + welcome for Nusrat
  const nusId = custIds.nusrat!;
  const nextDue = installmentRows.filter((r) => r.loanId === loanDefs[0]!.id && r.status === "DUE").sort((a, b) => (a.installmentNo - b.installmentNo))[0];
  if (nextDue) notifications.push({ userId: nusId, type: "INSTALLMENT_DUE", title: "EMI due soon", body: `Installment #${nextDue.installmentNo} of ${formatMoney(nextDue.amountDue as bigint)} is due on ${(nextDue.dueDate as Date).toISOString().slice(0, 10)}.`, link: `/loans/${loanDefs[0]!.id}`, createdAt: daysAgo(0.2) });
  const kamrulOverdue = installmentRows.find((r) => r.loanId === loanDefs[1]!.id && r.status === "OVERDUE");
  if (kamrulOverdue) notifications.push({ userId: custIds.kamrul!, type: "INSTALLMENT_DUE", title: "EMI overdue", body: `Installment #${kamrulOverdue.installmentNo} is overdue. Please repay to avoid penalties.`, link: `/loans/${loanDefs[1]!.id}`, createdAt: daysAgo(1) });

  // Only Nusrat's latest notifications stay unread
  const nusNotes = notifications.filter((n) => n.userId === nusId).sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());
  nusNotes.forEach((n, i) => { n.isRead = n.isRead || i >= 5; });
  const keepNus = new Set(nusNotes.slice(0, 40));
  const finalNotifications = notifications.filter((n) => n.userId !== nusId || keepNus.has(n));

  // ───────────────────────── write ─────────────────────────
  console.log(`Writing ${users.length} users, ${accounts.length} accounts, ${txns.length + reversalTxns.length} transactions, ${ledger.length} ledger rows…`);
  const chunk = async <T,>(rows: T[], fn: (batch: T[]) => Promise<unknown>, size = 500) => {
    for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
  };

  await db.user.createMany({ data: users });
  await db.authAccount.createMany({ data: authRows });
  await db.customerProfile.createMany({ data: profiles });
  await db.bankSettings.create({ data: { id: 1, ...DEFAULT_SETTINGS, otpThreshold: DEFAULT_OTP_THRESHOLD, updatedById: adminId } });
  await db.account.createMany({
    data: accounts.map((a) => ({
      id: a.id, accountNumber: a.number, userId: a.userId, type: a.type, nickname: a.nickname, balance: a.balance,
      status: a.status, transactionPinHash: pinHash, createdById: staffIds[0], createdAt: a.openedAt,
    })),
  });
  await db.card.createMany({ data: cardRows });
  txns.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
  await chunk(txns, (b) => db.transaction.createMany({ data: b }));
  await chunk(reversalTxns, (b) => db.transaction.createMany({ data: b }));
  await chunk(ledger, (b) => db.ledgerEntry.createMany({ data: b }), 1000);
  await chunk(requests, (b) => db.depositWithdrawalRequest.createMany({ data: b }));
  await db.loan.createMany({ data: loanRows });
  await db.loanInstallment.createMany({ data: installmentRows });
  await db.loanNote.createMany({ data: loanNotes });
  await chunk(finalNotifications, (b) => db.notification.createMany({ data: b }));
  await chunk(audit, (b) => db.auditLog.createMany({ data: b }), 1000);

  // ── verify: every balance equals its last ledger entry and the ledger sum
  const mismatches = await db.$queryRaw<{ id: string }[]>`
    SELECT a.id FROM accounts a
    LEFT JOIN (
      SELECT "accountId", SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END) AS net
      FROM ledger_entries GROUP BY "accountId"
    ) l ON l."accountId" = a.id
    WHERE a.balance <> COALESCE(l.net, 0)`;
  if (mismatches.length) throw new Error(`Ledger mismatch on ${mismatches.length} accounts`);

  const flagged = txns.filter((t) => t.isFlagged).length;
  console.log(`✔ Seeded (${skipped} generated events skipped by balance rules). Flagged: ${flagged}. Ledger verified.`);
  console.log(`  Demo password: ${DEMO_PASSWORD} · transaction PIN for every account: 1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
