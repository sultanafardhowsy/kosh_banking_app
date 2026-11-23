import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import {
  listAllTransactions, openAccount, registerCustomer, resolveFlag, setUserStatus, updateAccountAsAdmin, updateSettings, verifyCustomer,
} from "@/server/services/management.service";
import { executeTransfer } from "@/server/services/transfer.service";
import { adminStats, customerStats } from "@/server/services/stats.service";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { codeOf, hasTestDb, key, makeAccount, makeUser, PIN, resetDb, tk } from "../helpers/factory";

const reg = { name: "Mina Rahman", email: "mina@test.local", phone: "+8801711111111", address: "House 1, Road 2, Dhaka", nid: "DEMO-123456", dateOfBirth: "1995-05-05", openAccount: "SAVINGS" as const };

describe.skipIf(!hasTestDb)("staff & admin management (integration)", () => {
  beforeEach(resetDb);

  it("registers a customer with a working bcrypt login, profile, first account and audit rows", async () => {
    const staff = await makeUser("STAFF");
    const r = await registerCustomer(staff, reg);
    const cred = await db.authAccount.findFirstOrThrow({ where: { userId: r.customer.id } });
    expect(await bcrypt.compare(r.temporaryPassword, cred.password!)).toBe(true);
    expect(r.account?.type).toBe("SAVINGS");
    const user = await db.user.findUniqueOrThrow({ where: { id: r.customer.id } });
    expect(user.role).toBe("CUSTOMER");
    expect(user.isVerified).toBe(false);
    expect(await db.auditLog.count({ where: { actorId: staff.id } })).toBe(2);
    expect(await codeOf(registerCustomer(staff, reg))).toBe("ALREADY_EXISTS");
  });

  it("verification + account opening rules", async () => {
    const staff = await makeUser("STAFF");
    const r = await registerCustomer(staff, { ...reg, openAccount: "NONE" });
    const asUser = { ...staff };
    expect(await codeOf(openAccount(asUser, { userId: r.customer.id, type: "CURRENT" }))).toBe("INVALID_STATE"); // not verified yet
    await verifyCustomer(staff, r.customer.id);
    expect(await codeOf(verifyCustomer(staff, r.customer.id))).toBe("INVALID_STATE");
    const acc = await openAccount(staff, { userId: r.customer.id, type: "CURRENT" });
    expect(acc.accountNumber).toMatch(/^201\d{9}$/);
    expect(acc.balance).toBe(BigInt(0));
  });

  it("blocking a user deletes their sessions; admins can't block admins or themselves", async () => {
    const admin = await makeUser("ADMIN");
    const other = await makeUser("ADMIN");
    const cust = await makeUser();
    await db.session.create({ data: { id: "s1", token: "t1", userId: cust.id, expiresAt: new Date(Date.now() + 86_400_000) } });
    await setUserStatus(admin, cust.id, "BLOCKED", "Fraud investigation");
    expect((await db.user.findUniqueOrThrow({ where: { id: cust.id } })).status).toBe("BLOCKED");
    expect(await db.session.count({ where: { userId: cust.id } })).toBe(0);
    expect(await codeOf(setUserStatus(admin, other.id, "BLOCKED", "nope"))).toBe("FORBIDDEN");
    expect(await codeOf(setUserStatus(admin, admin.id, "INACTIVE", "nope"))).toBe("SELF_ACTION_NOT_ALLOWED");
  });

  it("freeze stops transfers; unfreeze restores them; close needs a zero balance", async () => {
    const admin = await makeUser("ADMIN");
    const cust = await makeUser();
    const a = await makeAccount(cust.id, 5_000);
    const b = await makeAccount((await makeUser()).id, 0);
    await updateAccountAsAdmin(admin, a.id, { action: "freeze", reason: "Investigation" });
    const send = () => executeTransfer(cust.id, { fromAccountId: a.id, toAccountNumber: b.accountNumber, amount: tk(100), description: "", pin: PIN, idempotencyKey: key() });
    expect(await codeOf(send())).toBe("ACCOUNT_FROZEN");
    await updateAccountAsAdmin(admin, a.id, { action: "unfreeze", reason: "Cleared" });
    expect(await codeOf(send())).toBe("OK");
    expect(await codeOf(updateAccountAsAdmin(admin, a.id, { action: "close", reason: "Customer request" }))).toBe("INVALID_STATE");
    await updateAccountAsAdmin(admin, b.id, { action: "freeze", reason: "x x x" });
    expect(await codeOf(updateAccountAsAdmin(admin, (await makeAccount(cust.id, 0)).id, { action: "close", reason: "Empty" }))).toBe("OK");
  });

  it("per-account limits can't exceed bank limits and are enforced on transfers", async () => {
    const admin = await makeUser("ADMIN");
    const cust = await makeUser();
    const a = await makeAccount(cust.id, 50_000);
    const b = await makeAccount((await makeUser()).id, 0);
    expect(await codeOf(updateAccountAsAdmin(admin, a.id, { action: "limits", dailyTransferLimit: DEFAULT_SETTINGS.dailyTransferLimit + BigInt(1) }))).toBe("VALIDATION_ERROR");
    await updateAccountAsAdmin(admin, a.id, { action: "limits", dailyTransferLimit: tk(2_000), maxSingleTxn: tk(1_500) });
    expect(await codeOf(executeTransfer(cust.id, { fromAccountId: a.id, toAccountNumber: b.accountNumber, amount: tk(1_600), description: "", pin: PIN, idempotencyKey: key() }))).toBe("LIMIT_EXCEEDED");
  });

  it("settings changes take effect on the next transfer and are audited with old/new values", async () => {
    const admin = await makeUser("ADMIN");
    const cust = await makeUser();
    const a = await makeAccount(cust.id, 10_000);
    const b = await makeAccount((await makeUser()).id, 0);
    await updateSettings(admin, { ...DEFAULT_SETTINGS, transferFeeFlat: tk(20), transferFeePercentBps: 0, transferFeeMax: null });
    const r = await executeTransfer(cust.id, { fromAccountId: a.id, toAccountNumber: b.accountNumber, amount: tk(1_000), description: "", pin: PIN, idempotencyKey: key() });
    expect(r.transaction.fee).toBe(tk(20));
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "SETTINGS_UPDATED" } });
    expect(log.metadata).toMatchObject({ transferFeeFlat: { from: "500", to: "2000" } });
  });

  it("flag resolution keeps the transaction, closes the flag, and lists correctly", async () => {
    const admin = await makeUser("ADMIN");
    const cust = await makeUser();
    const a = await makeAccount(cust.id, 10_000);
    const b = await makeAccount((await makeUser()).id, 0);
    const t = await executeTransfer(cust.id, { fromAccountId: a.id, toAccountNumber: b.accountNumber, amount: tk(9_000), description: "", pin: PIN, idempotencyKey: key() });
    expect(t.transaction.isFlagged).toBe(true);
    expect((await listAllTransactions({ flagged: "open", page: 1, pageSize: 10 })).total).toBe(1);
    await resolveFlag(admin, t.transaction.id, "Customer confirmed");
    expect((await listAllTransactions({ flagged: "open", page: 1, pageSize: 10 })).total).toBe(0);
    expect((await listAllTransactions({ flagged: "resolved", page: 1, pageSize: 10 })).total).toBe(1);
    expect(await codeOf(resolveFlag(admin, t.transaction.id, "again"))).toBe("INVALID_STATE");
  });
});

describe.skipIf(!hasTestDb)("stats (integration)", () => {
  beforeEach(resetDb);

  it("customer stats exclude moves between own accounts and are scoped to the user", async () => {
    const cust = await makeUser();
    const a = await makeAccount(cust.id, 10_000);
    const a2 = await makeAccount(cust.id, 0, { type: "CURRENT" });
    const other = await makeAccount((await makeUser()).id, 0);
    await executeTransfer(cust.id, { fromAccountId: a.id, toAccountNumber: a2.accountNumber, amount: tk(1_000), description: "", pin: PIN, idempotencyKey: key() });
    await executeTransfer(cust.id, { fromAccountId: a.id, toAccountNumber: other.accountNumber, amount: tk(2_000), description: "", pin: PIN, idempotencyKey: key() });
    const s = await customerStats(cust.id);
    const thisMonth = s.monthly[s.monthly.length - 1]!;
    const fees = BigInt(2) * BigInt(500) + BigInt(250) + BigInt(500); // ৳5 + 0.25% each
    expect(thisMonth.spending).toBe(tk(2_000) + fees);
    expect(await codeOf(customerStats((await makeUser()).id, a.id))).toBe("NOT_FOUND");
  });

  it("admin stats count deposits, accounts and loans", async () => {
    const cust = await makeUser();
    await makeAccount(cust.id, 1_000);
    await makeAccount(cust.id, 2_000, { type: "BUSINESS" });
    const s = await adminStats();
    expect(s.kpis.totalDeposits).toBe(tk(3_000));
    expect(s.accountDistribution.find((d) => d.type === "BUSINESS")?.count).toBe(1);
    expect(s.monthly).toHaveLength(6);
    expect(s.monthly[5]!.deposits).toBe(tk(3_000));
  });
});
