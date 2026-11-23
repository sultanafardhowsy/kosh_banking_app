import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture what Nodemailer would send — no real SMTP traffic in tests.
type Mail = { to: string; subject: string; html: string; text: string; from: string };
const sendMail = vi.fn<(m: Mail) => Promise<{ messageId: string; rejected: string[] }>>(async () => ({ messageId: "<m-1@test>", rejected: [] }));
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => ({ sendMail })) } }));

import { db } from "@/server/db";
import { notify } from "@/server/services/notification.service";
import { createRequest } from "@/server/services/request.service";
import { applyForLoan, addLoanNote, forwardLoan } from "@/server/services/loan.service";
import { submitKycProfile, verifyCustomer } from "@/server/services/management.service";
import { executeTransfer } from "@/server/services/transfer.service";
import { loanApplySchema } from "@/lib/validators/money";
import { hasTestDb, key, makeAccount, makeUser, PIN, resetDb, tk } from "../helpers/factory";

const ENV_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "RESEND_API_KEY", "EMAIL_DEMO_RECIPIENT", "EMAIL_FROM"] as const;
const saved: Record<string, string | undefined> = {};

describe.skipIf(!hasTestDb)("notifications & email (integration)", () => {
  beforeEach(async () => {
    await resetDb();
    for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    sendMail.mockClear();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    vi.unstubAllGlobals();
  });

  it("without a provider, important notifications are kept in the email log; routine ones aren't emailed", async () => {
    const u = await makeUser();
    await notify([
      { userId: u.id, type: "TRANSFER_RECEIVED", title: "Received ৳500", body: "From Rafiul K.", link: "/transactions/x" },
      { userId: u.id, type: "CARD_UPDATE", title: "Card payment ৳120", body: "Shwapno" },
      { userId: u.id, type: "CARD_UPDATE", title: "Your virtual card is ready", body: "Card •••• 1234", email: true },
    ]);
    expect(await db.notification.count({ where: { userId: u.id } })).toBe(3);
    const logs = await db.emailLog.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => [l.status, l.provider])).toEqual([["LOGGED", "log"], ["LOGGED", "log"]]);
    expect(logs[0]!.html).toContain("Received ৳500");
    expect(logs[0]!.html).toContain("/transactions/x");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("respects the user's email opt-out, and blocked users only get security emails", async () => {
    const off = await makeUser();
    await db.user.update({ where: { id: off.id }, data: { emailNotifications: false } });
    const blocked = await makeUser("CUSTOMER", "BLOCKED");
    await notify([
      { userId: off.id, type: "TRANSFER_SENT", title: "Sent", body: "x" },
      { userId: blocked.id, type: "ACCOUNT_UPDATE", title: "Account frozen", body: "x" },
      { userId: blocked.id, type: "SECURITY", title: "PIN locked", body: "x" },
    ]);
    expect(await db.emailLog.count({ where: { userId: off.id } })).toBe(0);
    expect((await db.emailLog.findMany({ where: { userId: blocked.id } })).map((l) => l.subject)).toEqual(["PIN locked — Kosh"]);
  });

  it("SMTP via Nodemailer: sends HTML + text, and the demo redirect routes it to one real inbox", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_USER = "bank@example.test";
    process.env.SMTP_PASS = "secret";
    process.env.EMAIL_DEMO_RECIPIENT = "me@example.test";
    const u = await makeUser();
    await notify([{ userId: u.id, type: "REQUEST_APPROVED", title: "Deposit approved", body: "৳5,000 on •••• 1234", link: "/transactions/t1" }]);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0]![0];
    expect(mail.to).toBe("me@example.test");
    expect(mail.subject).toBe(`Deposit approved — Kosh [for ${u.email}]`);
    expect(mail.from).toBe("Kosh <bank@example.test>");
    expect(mail.text).toContain("৳5,000");
    const log = await db.emailLog.findFirstOrThrow({ where: { userId: u.id } });
    expect([log.status, log.provider, log.toAddress, log.originalTo, log.providerId]).toEqual(["SENT", "smtp", "me@example.test", u.email, "<m-1@test>"]);
  });

  it("a failing provider is logged as FAILED and never breaks the banking action", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    sendMail.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    const alice = await makeUser();
    const a = await makeAccount(alice.id, 5_000);
    const b = await makeAccount((await makeUser()).id, 0);
    const r = await executeTransfer(alice.id, { fromAccountId: a.id, toAccountNumber: b.accountNumber, amount: tk(100), description: "", pin: PIN, idempotencyKey: key() });
    expect(r.transaction.status).toBe("COMPLETED");
    const logs = await db.emailLog.findMany({ orderBy: { createdAt: "asc" } });
    expect(logs).toHaveLength(2); // sent + received
    expect(logs.some((l) => l.status === "FAILED" && l.error?.includes("ECONNREFUSED"))).toBe(true);
  });

  it("Resend: posts to the API with the key and records the provider id", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email_abc" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const u = await makeUser();
    await notify([{ userId: u.id, type: "LOAN_APPROVED", title: "Loan approved & disbursed", body: "৳60,000 credited." }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_123");
    expect(JSON.parse(String(init.body)).to).toEqual([u.email]);
    expect((await db.emailLog.findFirstOrThrow({ where: { userId: u.id } })).providerId).toBe("email_abc");
  });

  it("staff are alerted to new requests and loan applications; admins to loans awaiting a decision", async () => {
    const staff = await makeUser("STAFF");
    const admin = await makeUser("ADMIN");
    const cust = await makeUser();
    const acc = await makeAccount(cust.id, 5_000);

    await createRequest(cust, { accountId: acc.id, type: "DEPOSIT", amount: tk(1_000) });
    const loan = await applyForLoan(cust, loanApplySchema.parse({
      loanType: "PERSONAL", accountId: acc.id, principal: String(tk(50_000)), durationMonths: 6, monthlyIncome: String(tk(40_000)), employmentStatus: "SALARIED", description: "Laptop for work",
    }));
    const staffAlerts = await db.notification.findMany({ where: { userId: staff.id, type: "REVIEW_QUEUE" }, orderBy: { createdAt: "asc" } });
    expect(staffAlerts.map((n) => n.title)).toEqual(["New deposit request", "New loan application"]);
    expect(await db.notification.count({ where: { userId: cust.id, type: "REVIEW_QUEUE" } })).toBe(0);
    // queue alerts are in-app only — no email noise for staff
    expect(await db.emailLog.count({ where: { userId: staff.id } })).toBe(0);

    await addLoanNote(staff, loan.id, "Checked");
    await forwardLoan(staff, loan.id);
    const adminAlert = await db.notification.findFirstOrThrow({ where: { userId: admin.id, type: "REVIEW_QUEUE" } });
    expect(adminAlert.link).toBe(`/admin/loans/${loan.id}`);
  });

  it("a self-signup customer fills in KYC, staff get one alert, and verification then locks it", async () => {
    const staff = await makeUser("STAFF");
    const cust = await makeUser();
    await db.user.update({ where: { id: cust.id }, data: { isVerified: false } });
    const session = { id: cust.id, name: cust.name, email: cust.email, role: "CUSTOMER" as const, status: "ACTIVE" as const, isVerified: false };
    const kyc = { phone: "+8801711000000", address: "House 1, Road 2, Dhanmondi", nid: "1990123456", dateOfBirth: "1995-04-02" };

    await expect(verifyCustomer(staff, cust.id)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(submitKycProfile(session, { ...kyc, dateOfBirth: "2015-01-01" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await submitKycProfile(session, kyc);
    await submitKycProfile(session, { ...kyc, address: "Corrected address, Dhaka" }); // edit before verification
    expect(await db.notification.count({ where: { userId: staff.id, title: "Customer ready for verification" } })).toBe(1);

    await verifyCustomer(staff, cust.id);
    await expect(submitKycProfile({ ...session, isVerified: true }, kyc)).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect((await db.customerProfile.findUniqueOrThrow({ where: { userId: cust.id } })).address).toBe("Corrected address, Dhaka");
  });
});
