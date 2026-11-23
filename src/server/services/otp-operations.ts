import "server-only";
import type { OtpPurpose } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/guards";
import { formatMoney } from "@/lib/money";
import { maskAccountNumber } from "@/lib/format";
import { previewTransfer } from "./transfer.service";
import { requestOtp } from "./otp.service";
import { otpPayload } from "./otp-payload";

export { otpPayload, transferNeedsOtp } from "./otp-payload";

export type OtpRequest =
  | {
      purpose: "TRANSFER";
      fromAccountId: string;
      toAccountNumber: string;
      amount: bigint;
    }
  | { purpose: "PIN_CHANGE"; accountId: string }
  | { purpose: "REVERSAL"; transactionId: string }
  | { purpose: "SETTINGS"; settings: Record<string, unknown> };

/** POST /api/otp — checks the caller may do the operation, then emails the code. */
export async function issueOtp(user: SessionUser, req: OtpRequest) {
  const roleFor: Record<OtpPurpose, SessionUser["role"]> = {
    TRANSFER: "CUSTOMER",
    PIN_CHANGE: "CUSTOMER",
    REVERSAL: "ADMIN",
    SETTINGS: "ADMIN",
  };
  if (user.role !== roleFor[req.purpose])
    throw new AppError("FORBIDDEN", "You can't do that");

  switch (req.purpose) {
    case "TRANSFER": {
      const p = await previewTransfer(user.id, req); // ownership, recipient, limits — same checks as the real transfer
      return requestOtp(
        user,
        "TRANSFER",
        otpPayload.transfer(req),
        `a transfer of ${formatMoney(p.total)} to ${p.recipient.name} (${p.recipient.accountNumber})`,
      );
    }
    case "PIN_CHANGE": {
      const acc = await db.account.findFirst({
        where: { id: req.accountId, userId: user.id },
        select: { accountNumber: true },
      });
      if (!acc) throw new AppError("NOT_FOUND", "Account not found");
      return requestOtp(
        user,
        "PIN_CHANGE",
        otpPayload.pinChange(req.accountId),
        `changing the transaction PIN on ${maskAccountNumber(acc.accountNumber)}`,
      );
    }
    case "REVERSAL": {
      const t = await db.transaction.findUnique({
        where: { id: req.transactionId },
        select: { reference: true, amount: true },
      });
      if (!t) throw new AppError("NOT_FOUND", "Transaction not found");
      return requestOtp(
        user,
        "REVERSAL",
        otpPayload.reversal(req.transactionId),
        `reversing ${t.reference} (${formatMoney(t.amount)})`,
      );
    }
    case "SETTINGS":
      return requestOtp(
        user,
        "SETTINGS",
        otpPayload.settings(req.settings),
        "changing bank-wide limits and fees",
      );
  }
}
