/**
 * HTTP-level security checks against a running server with the demo seed loaded.
 *   E2E_BASE_URL=http://localhost:3000 npm test
 * Better Auth allows 3 sign-ins per 10 s per IP, so logins are spaced out.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "@/lib/demo-accounts";

const BASE = process.env.E2E_BASE_URL;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function login(email: string) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE! },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
  if (!res.ok) throw new Error(`login ${email} → ${res.status} ${await res.text()}`);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

function api(cookie: string | null) {
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Origin: BASE!, ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  };
}

describe.skipIf(!BASE)("API security (e2e)", () => {
  let customer: ReturnType<typeof api>;
  let rafi: ReturnType<typeof api>;
  let staff: ReturnType<typeof api>;
  let admin: ReturnType<typeof api>;
  const anon = api(null);
  let nusratAccounts: { id: string; accountNumber: string; balance: string }[] = [];
  let rafiAccount: { id: string; accountNumber: string };

  beforeAll(async () => {
    customer = api(await login("customer@kosh.demo"));
    staff = api(await login("staff@kosh.demo"));
    admin = api(await login("admin@kosh.demo"));
    await sleep(10_500);
    rafi = api(await login("rafi@kosh.demo"));
    nusratAccounts = (await customer("GET", "/api/me")).json.accounts;
    rafiAccount = (await rafi("GET", "/api/me")).json.accounts[0];
  }, 60_000);

  it("unauthenticated calls get 401", async () => {
    expect((await anon("GET", "/api/me")).status).toBe(401);
    expect((await anon("POST", "/api/transfers", {})).status).toBe(401);
  });

  it("customer calling staff/admin APIs gets 403", async () => {
    expect((await customer("GET", "/api/staff/requests")).status).toBe(403);
    expect((await customer("POST", "/api/admin/transactions/x/reverse", { reason: "test" })).status).toBe(403);
    expect((await customer("POST", "/api/staff/transactions/x/flag", { reason: "test" })).status).toBe(403);
  });

  it("staff can't use admin-only APIs or make customer transfers", async () => {
    expect((await staff("POST", "/api/admin/transactions/x/reverse", { reason: "test" })).status).toBe(403);
    expect((await staff("POST", "/api/transfers", {})).status).toBe(403);
    expect((await staff("GET", "/api/staff/requests?status=PENDING")).status).toBe(200);
    expect((await admin("GET", "/api/staff/requests")).status).toBe(200);
  });

  it("customer A can't move money from customer B's account", async () => {
    const r = await rafi("POST", "/api/transfers", {
      fromAccountId: nusratAccounts[0]!.id,
      toAccountNumber: rafiAccount.accountNumber,
      amount: "10000",
      pin: "1234",
      idempotencyKey: `e2e-${Date.now()}-steal`,
    });
    expect(r.status).toBe(404);
    expect(r.json.error.code).toBe("NOT_FOUND");
  });

  it("invalid input is a typed 422", async () => {
    const r = await customer("POST", "/api/transfers", { fromAccountId: "x", toAccountNumber: "12", amount: "12.5", pin: "1", idempotencyKey: "short" });
    expect(r.status).toBe(422);
    expect(r.json.error.code).toBe("VALIDATION_ERROR");
  });

  it("preview → transfer → retry with the same key returns the same transaction; tampered fee ignored", async () => {
    const from = nusratAccounts[0]!;
    const body = { fromAccountId: from.id, toAccountNumber: rafiAccount.accountNumber, amount: "150000" };
    const preview = await customer("POST", "/api/transfers/preview", body);
    expect(preview.status).toBe(200);
    expect(preview.json.fee).toBe("875"); // ৳5 + 0.25% of ৳1,500

    const idempotencyKey = `e2e-${Date.now()}-ok`;
    const first = await customer("POST", "/api/transfers", { ...body, pin: "1234", idempotencyKey, fee: "0", description: "e2e test" });
    expect(first.status).toBe(201);
    expect(first.json.transaction.fee).toBe("875");
    const again = await customer("POST", "/api/transfers", { ...body, pin: "1234", idempotencyKey });
    expect(again.status).toBe(200);
    expect(again.json.replayed).toBe(true);
    expect(again.json.transaction.id).toBe(first.json.transaction.id);
  });

  it("wrong PIN returns INVALID_PIN with attempts left", async () => {
    const r = await customer("POST", "/api/transfers", {
      fromAccountId: nusratAccounts[1]!.id,
      toAccountNumber: rafiAccount.accountNumber,
      amount: "1000",
      pin: "0000",
      idempotencyKey: `e2e-${Date.now()}-pin`,
    });
    expect(r.status).toBe(422);
    expect(r.json.error.code).toBe("INVALID_PIN");
    expect(r.json.error.details.attemptsLeft).toBe(4);
    // reset the counter with a correct PIN so re-runs stay clean
    await customer("POST", "/api/transfers/preview", { fromAccountId: nusratAccounts[1]!.id, toAccountNumber: rafiAccount.accountNumber, amount: "1000" });
    await customer("POST", "/api/transfers", { fromAccountId: nusratAccounts[1]!.id, toAccountNumber: rafiAccount.accountNumber, amount: "1000", pin: "1234", idempotencyKey: `e2e-${Date.now()}-pinok` });
  });

  it("customer request → staff approves; staff can't approve twice", async () => {
    const created = await customer("POST", "/api/requests", { accountId: nusratAccounts[0]!.id, type: "DEPOSIT", amount: "500000", description: "e2e" });
    expect(created.status).toBe(201);
    const approve = await staff("PATCH", `/api/staff/requests/${created.json.id}`, { action: "approve" });
    expect(approve.status).toBe(200);
    const twice = await staff("PATCH", `/api/staff/requests/${created.json.id}`, { action: "approve" });
    expect(twice.status).toBe(409);
    expect(twice.json.error.code).toBe("INVALID_STATE");
  });

  it("/api/me never exposes PIN hashes", async () => {
    const me = await customer("GET", "/api/me");
    expect(me.status).toBe(200);
    expect(me.json.accounts.every((a: { hasPin: boolean }) => a.hasPin)).toBe(true);
    expect(JSON.stringify(me.json)).not.toContain("transactionPinHash");
  });

  it("Phase 4/5 routes: roles and ownership", async () => {
    // staff can't decide loans; customers can't see the review queue
    expect((await staff("PATCH", "/api/admin/loans/x", { action: "approve" })).status).toBe(403);
    expect((await customer("GET", "/api/staff/loans")).status).toBe(403);
    expect((await customer("GET", "/api/staff/loans/x")).status).toBe(403);

    // Nusrat's loan / transaction / statement are invisible to Rafi
    const loans = (await customer("GET", "/api/loans")).json as { id: string }[];
    expect(loans.length).toBeGreaterThan(0);
    expect((await rafi("GET", `/api/loans/${loans[0]!.id}`)).status).toBe(404);
    expect((await rafi("POST", `/api/loans/${loans[0]!.id}/repay`, { pin: "1234", idempotencyKey: `e2e-${Date.now()}-repay` })).status).toBe(404);
    const txns = (await customer("GET", "/api/transactions?pageSize=1")).json.items as { id: string }[];
    const theirs = (await rafi("GET", `/api/transactions/${txns[0]!.id}`));
    // only a 404 unless the txn happens to involve Rafi
    expect([200, 404]).toContain(theirs.status);
    expect((await rafi("GET", `/api/accounts/${nusratAccounts[0]!.id}`)).status).toBe(404);
    expect((await rafi("GET", `/api/transactions?accountId=${nusratAccounts[0]!.id}`)).status).toBe(404);

    // a customer can't pick their own interest rate
    const apply = await rafi("POST", "/api/loans", {
      loanType: "PERSONAL", accountId: rafiAccount.id, principal: "5000000", durationMonths: 12,
      monthlyIncome: "4500000", employmentStatus: "SALARIED", description: "e2e rate tamper", interestRateBps: 1,
    });
    if (apply.status === 201) expect(apply.json.interestRateBps).toBe(1200);
    else expect(apply.json.error.code).toBe("INVALID_STATE"); // Rafi already has a pending application in the seed
  });

  it("Phase 6/7 routes: admin-only and staff-only boundaries", async () => {
    for (const [method, path, body] of [
      ["PATCH", "/api/admin/customers/x", { status: "BLOCKED", reason: "test" }],
      ["PATCH", "/api/admin/accounts/x", { action: "freeze", reason: "test" }],
      ["PUT", "/api/admin/settings", {}],
      ["GET", "/api/admin/settings", undefined],
      ["GET", "/api/admin/audit", undefined],
      ["GET", "/api/admin/stats", undefined],
      ["GET", "/api/admin/flagged", undefined],
    ] as const) {
      expect((await staff(method, path, body)).status, `staff ${method} ${path}`).toBe(403);
      expect((await customer(method, path, body)).status, `customer ${method} ${path}`).toBe(403);
    }
    for (const [method, path] of [["GET", "/api/staff/customers"], ["POST", "/api/staff/accounts"], ["GET", "/api/staff/overview"], ["GET", "/api/staff/transactions"]] as const) {
      expect((await customer(method, path, method === "POST" ? {} : undefined)).status, `customer ${method} ${path}`).toBe(403);
    }
    expect((await customer("GET", "/api/stats/customer")).status).toBe(200);
    expect((await staff("GET", "/api/stats/customer")).status).toBe(403);
    expect((await admin("GET", "/api/admin/stats")).status).toBe(200);
    expect((await staff("GET", "/api/staff/overview")).status).toBe(200);
  });

  it("Phase 8 routes: cards, receipts and statements are scoped", async () => {
    expect((await customer("GET", "/api/staff/cards")).status).toBe(403);
    expect((await staff("PATCH", "/api/admin/cards/x/block", { reason: "test" })).status).toBe(403);
    expect((await staff("POST", "/api/cards", { accountId: "x" })).status).toBe(403);
    const mine = (await customer("GET", "/api/cards")).json as { cards: { id: string; cardNumberMasked: string }[] };
    expect(JSON.stringify(mine)).not.toMatch(/\d{16}/);
    const active = mine.cards.find((c) => /\d{4}$/.test(c.cardNumberMasked));
    if (active) {
      expect((await rafi("PATCH", `/api/cards/${active.id}`, { action: "freeze" })).status).toBe(404);
      expect((await rafi("POST", `/api/cards/${active.id}/pay`, { merchant: "Test", amount: "100", pin: "1234", idempotencyKey: `e2e-${Date.now()}-card` })).status).toBe(404);
    }
    // A cash deposit into Nusrat's account can't involve Rafi → his receipt request must 404, hers is a PDF
    const dep = (await customer("GET", "/api/transactions?type=DEPOSIT&pageSize=1")).json.items as { id: string }[];
    expect((await customer("GET", `/api/receipts/${dep[0]!.id}`)).status).toBe(200);
    expect((await rafi("GET", `/api/receipts/${dep[0]!.id}`)).status).toBe(404);
    expect((await rafi("GET", `/api/statements?accountId=${nusratAccounts[0]!.id}&from=2026-01-01&to=2026-01-31`)).status).toBe(404);
  });

  it("notifications & email: every role has its own inbox; the email log and KYC are role-gated", async () => {
    for (const who of [customer, staff, admin]) {
      expect((await who("GET", "/api/notifications")).status).toBe(200);
      const prefs = await who("GET", "/api/me/preferences");
      expect(prefs.status).toBe(200);
      expect(typeof prefs.json.emailNotifications).toBe("boolean");
    }
    expect((await staff("PATCH", "/api/me/preferences", { emailNotifications: "yes" })).status).toBe(422);
    expect((await customer("GET", "/api/admin/emails")).status).toBe(403);
    expect((await staff("GET", "/api/admin/emails")).status).toBe(403);
    const log = await admin("GET", "/api/admin/emails?page=1");
    expect(log.status).toBe(200);
    expect(["smtp", "resend", "log"]).toContain(log.json.config.provider);
    // a verified customer can't rewrite KYC; staff have no customer profile endpoint
    expect((await customer("PATCH", "/api/me/profile", { phone: "+8801711000000", address: "Somewhere 12", nid: "12345678", dateOfBirth: "1990-01-01" })).status).toBe(409);
    expect((await staff("GET", "/api/me/profile")).status).toBe(403);
  });

  it("Google sign-in is only offered when configured", async () => {
    const res = await fetch(`${BASE}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE! },
      body: JSON.stringify({ provider: "google", callbackURL: "/login" }),
    });
    const html = await (await fetch(`${BASE}/login`)).text();
    if (process.env.GOOGLE_CLIENT_ID) {
      expect((await res.json()).url).toMatch(/^https:\/\/accounts\.google\.com\//);
      expect(html).toContain("Continue with Google");
    } else {
      expect(res.ok).toBe(false);
      expect(html).not.toContain("Continue with Google");
    }
  });

  it("two-factor: large transfers, PIN changes, reversals and settings need the emailed code", async () => {
    const from = nusratAccounts.find((a) => BigInt(a.balance) > BigInt(4_000_000))!;
    const big = { fromAccountId: from.id, toAccountNumber: rafiAccount.accountNumber, amount: "3000000" }; // ৳30,000 ≥ seeded ৳25,000
    expect((await customer("POST", "/api/transfers/preview", big)).json.otpRequired).toBe(true);
    const noCode = await customer("POST", "/api/transfers", { ...big, pin: "1234", idempotencyKey: `e2e-${Date.now()}-otp0` });
    expect(noCode.status).toBe(428);
    expect(noCode.json.error.code).toBe("OTP_REQUIRED");

    const issued = await customer("POST", "/api/otp", { purpose: "TRANSFER", ...big });
    expect(issued.status).toBe(201);
    if (issued.json.demoCode) {
      // log-only server: the code is shown in the UI, so the whole flow can run here
      const otp = { challengeId: issued.json.challengeId, code: issued.json.demoCode };
      const wrong = await customer("POST", "/api/transfers", { ...big, pin: "1234", idempotencyKey: `e2e-${Date.now()}-otp1`, otp: { ...otp, code: otp.code === "000000" ? "111111" : "000000" } });
      expect(wrong.json.error.code).toBe("OTP_INVALID");
      const ok = await customer("POST", "/api/transfers", { ...big, pin: "1234", idempotencyKey: `e2e-${Date.now()}-otp2`, otp });
      expect(ok.status).toBe(201);
    }

    expect((await customer("POST", "/api/accounts/" + from.id + "/pin", { currentPin: "1234", newPin: "2468", confirmPin: "2468" })).status).toBe(428);
    expect((await admin("POST", "/api/admin/transactions/x/reverse", { reason: "e2e check" })).status).toBe(428);
    const settings = (await admin("GET", "/api/admin/settings")).json;
    const keys = ["dailyTransferLimit", "maxSingleTransaction", "minimumBalance", "transferFeeFlat", "transferFeePercentBps", "transferFeeMax", "otpThreshold"];
    const body = Object.fromEntries(keys.map((k) => [k, settings[k]]));
    expect((await admin("PUT", "/api/admin/settings", body)).status).toBe(428);
    // codes are role-gated
    expect((await customer("POST", "/api/otp", { purpose: "REVERSAL", transactionId: "x" })).status).toBe(403);
    expect((await staff("POST", "/api/otp", { purpose: "TRANSFER", ...big })).status).toBe(403);
  });
});
