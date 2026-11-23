import { handler, ok } from "@/server/http";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";

/** GET /api/me — current user + (for customers) their accounts. */
export const GET = handler(async () => {
  const user = await requireUser();

  const accounts =
    user.role === "CUSTOMER"
      ? await db.account.findMany({
          where: { userId: user.id }, // always scoped to the session user
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            accountNumber: true,
            type: true,
            balance: true,
            status: true,
            nickname: true,
            transactionPinHash: true,
          },
        })
      : [];

  return ok({
    user,
    accounts: accounts.map(({ transactionPinHash, ...a }) => ({
      ...a,
      hasPin: Boolean(transactionPinHash), // never expose the hash
    })),
  });
});
