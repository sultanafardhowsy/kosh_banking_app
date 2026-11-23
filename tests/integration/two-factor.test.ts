import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  consumeOtp,
  requestOtp,
  verifyOtp,
  withOtp,
} from "@/server/services/otp.service";
import { issueOtp } from "@/server/services/otp-operations";
import { otpPayload } from "@/server/services/otp-payload";
import {
  executeTransfer,
  previewTransfer,
} from "@/server/services/transfer.service";
import {
  hasTestDb,
  key,
  makeAccount,
  makeUser,
  PIN,
  resetDb,
  tk,
} from "../helpers/factory";

const THRESHOLD = tk(25_000);

describe.skipIf(!hasTestDb)(
  "two-factor for sensitive operations (integration)",
  () => {
    beforeEach(async () => {
      await resetDb();
      delete process.env.SMTP_HOST;
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_DEMO_RECIPIENT;
      await db.bankSettings.update({
        where: { id: 1 },
        data: { otpThreshold: THRESHOLD },
      });
    });

    async function setup() {
      const alice = await makeUser();
      const from = await makeAccount(alice.id, 200_000);
      const to = await makeAccount((await makeUser()).id, 0);
      const base = {
        fromAccountId: from.id,
        toAccountNumber: to.accountNumber,
        description: "",
        pin: PIN,
      };
      return { alice, from, to, base };
    }

    it("small transfers need no code; at/above the threshold the server refuses without one", async () => {
      const { alice, base } = await setup();
      expect(
        (await previewTransfer(alice.id, { ...base, amount: tk(24_999) }))
          .otpRequired,
      ).toBe(false);
      expect(
        (await previewTransfer(alice.id, { ...base, amount: THRESHOLD }))
          .otpRequired,
      ).toBe(true);
      await expect(
        executeTransfer(alice.id, {
          ...base,
          amount: tk(1_000),
          idempotencyKey: key(),
        }),
      ).resolves.toMatchObject({ replayed: false });
      await expect(
        executeTransfer(alice.id, {
          ...base,
          amount: THRESHOLD,
          idempotencyKey: key(),
        }),
      ).rejects.toMatchObject({ code: "OTP_REQUIRED" });
    });

    it("the emailed code approves exactly that transfer, once", async () => {
      const { alice, from, base } = await setup();
      const req = {
        purpose: "TRANSFER" as const,
        fromAccountId: base.fromAccountId,
        toAccountNumber: base.toAccountNumber,
        amount: tk(50_000),
      };
      const issued = await issueOtp(alice, req);
      expect(issued.demoCode).toMatch(/^\d{6}$/); // log-only mode → code shown in the UI
      expect(issued.sentTo).toMatch(/^u.+•+@test\.local$/);
      const otp = { challengeId: issued.challengeId, code: issued.demoCode! };

      // same code, different amount → refused (code is bound to the operation)
      await expect(
        executeTransfer(alice.id, {
          ...base,
          amount: tk(60_000),
          otp,
          idempotencyKey: key(),
        }),
      ).rejects.toMatchObject({ code: "OTP_INVALID" });
      const r = await executeTransfer(alice.id, {
        ...base,
        amount: tk(50_000),
        otp,
        idempotencyKey: key(),
      });
      expect(r.transaction.status).toBe("COMPLETED");
      // single use
      await expect(
        executeTransfer(alice.id, {
          ...base,
          amount: tk(50_000),
          otp,
          idempotencyKey: key(),
        }),
      ).rejects.toMatchObject({ code: "OTP_INVALID" });
      expect(
        (await db.account.findUniqueOrThrow({ where: { id: from.id } }))
          .balance,
      ).toBe(tk(200_000) - tk(50_000) - r.transaction.fee);

      // the stored email never contains the real code
      const log = await db.emailLog.findFirstOrThrow({
        where: { userId: alice.id, subject: "Your Kosh security code" },
      });
      expect(log.html).not.toContain(issued.demoCode!);
      expect(log.html).toContain("••••••");
      expect(
        (
          await db.otpChallenge.findUniqueOrThrow({
            where: { id: issued.challengeId },
          })
        ).codeHash,
      ).not.toContain(issued.demoCode!);
    });

    it("a wrong PIN or a failed transfer leaves the code usable; wrong codes lock it after 5 tries", async () => {
      const { alice, base } = await setup();
      const req = {
        purpose: "TRANSFER" as const,
        fromAccountId: base.fromAccountId,
        toAccountNumber: base.toAccountNumber,
        amount: tk(30_000),
      };
      const issued = await issueOtp(alice, req);
      const otp = { challengeId: issued.challengeId, code: issued.demoCode! };

      await expect(
        executeTransfer(alice.id, {
          ...base,
          pin: "9876",
          amount: tk(30_000),
          otp,
          idempotencyKey: key(),
        }),
      ).rejects.toMatchObject({ code: "INVALID_PIN" });
      await expect(
        executeTransfer(alice.id, {
          ...base,
          amount: tk(30_000),
          otp,
          idempotencyKey: key(),
        }),
      ).resolves.toMatchObject({ replayed: false });

      await db.otpChallenge.deleteMany({}); // skip the resend cooldown for the next code
      const second = await issueOtp(alice, req);
      const wrong = second.demoCode === "000000" ? "111111" : "000000";
      for (let i = 4; i >= 1; i--) {
        await expect(
          verifyOtp(alice.id, "TRANSFER", otpPayload.transfer(req), {
            challengeId: second.challengeId,
            code: wrong,
          }),
        ).rejects.toMatchObject({
          code: "OTP_INVALID",
          details: { attemptsLeft: i },
        });
      }
      await expect(
        verifyOtp(alice.id, "TRANSFER", otpPayload.transfer(req), {
          challengeId: second.challengeId,
          code: wrong,
        }),
      ).rejects.toMatchObject({ code: "OTP_LOCKED" });
      // even the right code is useless now
      await expect(
        verifyOtp(alice.id, "TRANSFER", otpPayload.transfer(req), {
          challengeId: second.challengeId,
          code: second.demoCode!,
        }),
      ).rejects.toMatchObject({ code: "OTP_LOCKED" });
    });

    it("codes expire, belong to one user, and can't be requested in a burst", async () => {
      const { alice } = await setup();
      const bob = await makeUser();
      const a = await requestOtp(alice, "PIN_CHANGE", "acc-1", "test");
      await expect(
        requestOtp(alice, "PIN_CHANGE", "acc-1", "test"),
      ).rejects.toMatchObject({ code: "RATE_LIMITED" }); // 30 s cooldown
      await expect(
        verifyOtp(bob.id, "PIN_CHANGE", "acc-1", {
          challengeId: a.challengeId,
          code: a.demoCode!,
        }),
      ).rejects.toMatchObject({ code: "OTP_INVALID" });
      await db.otpChallenge.update({
        where: { id: a.challengeId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await expect(
        verifyOtp(alice.id, "PIN_CHANGE", "acc-1", {
          challengeId: a.challengeId,
          code: a.demoCode!,
        }),
      ).rejects.toMatchObject({ code: "OTP_EXPIRED" });
    });

    it("concurrent use of one code: exactly one wins", async () => {
      const { alice } = await setup();
      const a = await requestOtp(alice, "SETTINGS", "x", "test");
      const id = await verifyOtp(alice.id, "SETTINGS", "x", {
        challengeId: a.challengeId,
        code: a.demoCode!,
      });
      const results = await Promise.allSettled([
        consumeOtp(id),
        consumeOtp(id),
        consumeOtp(id),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    });

    it("withOtp: no code → OTP_REQUIRED and the operation never runs; a failing operation keeps the code", async () => {
      const admin = await makeUser("ADMIN");
      let runs = 0;
      await expect(
        withOtp(admin, "REVERSAL", "t1", undefined, async () => ++runs),
      ).rejects.toMatchObject({ code: "OTP_REQUIRED" });
      const a = await requestOtp(admin, "REVERSAL", "t1", "test");
      const proof = { challengeId: a.challengeId, code: a.demoCode! };
      await expect(
        withOtp(admin, "REVERSAL", "t1", proof, async () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
      await expect(
        withOtp(admin, "REVERSAL", "t1", proof, async () => ++runs),
      ).resolves.toBe(1);
      await expect(
        withOtp(admin, "REVERSAL", "t1", proof, async () => ++runs),
      ).rejects.toMatchObject({ code: "OTP_INVALID" });
      expect(runs).toBe(1);
    });

    it("only the right role can ask for each kind of code", async () => {
      const { alice } = await setup();
      const staff = await makeUser("STAFF");
      await expect(
        issueOtp(alice, { purpose: "REVERSAL", transactionId: "x" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        issueOtp(staff, { purpose: "SETTINGS", settings: {} }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const other = await makeAccount((await makeUser()).id, 10);
      await expect(
        issueOtp(alice, { purpose: "PIN_CHANGE", accountId: other.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  },
);
