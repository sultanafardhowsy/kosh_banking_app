import "server-only";
import { randomInt } from "node:crypto";
import type { CardNetwork, CardStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { assertNotSelf, type SessionUser } from "@/server/auth/guards";
import { writeAudit } from "@/server/audit";
import { CARD_DEFAULT_DAILY_LIMIT, CARD_VALID_YEARS } from "@/lib/constants";
import { effectiveLimits } from "@/lib/fees";
import { formatMoney } from "@/lib/money";
import { generateTxnReference } from "@/lib/reference";
import { startOfDhakaDay } from "@/lib/time";
import { maskAccountNumber } from "@/lib/format";
import { getSettings } from "./settings.service";
import { collectFraudStats, evaluateFraud } from "./fraud.service";
import { throwPinError, verifyPinInTx, type PinCheck } from "./pin.service";
import { isUniqueViolation, lockAccounts, MONEY_TX_OPTIONS } from "./locks";
import { notify, notifyAdmins, notifyRoles } from "./notification.service";
import { usedTodayFor } from "./transfer.service";

/**
 * Virtual debit cards — SIMULATED. A random, non-real number is generated at
 * approval; only the masked form + last4 are stored. No CVV is generated or stored.
 */

function luhnDigit(body: string) {
  let sum = 0;
  let dbl = true;
  for (let i = body.length - 1; i >= 0; i--) {
    let d = Number(body[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return String((10 - (sum % 10)) % 10);
}

/** Test-range style prefixes (4000… / 5100…) so numbers can never be real. */
function generateMaskedNumber(network: CardNetwork) {
  let body = network === "VISA" ? "4000" : "5100";
  while (body.length < 15) body += randomInt(10).toString();
  const full = body + luhnDigit(body);
  const last4 = full.slice(-4);
  return { masked: `${full.slice(0, 4)} •••• •••• ${last4}`, last4 }; // `full` is discarded here
}

const publicCard = {
  id: true, accountId: true, cardNumberMasked: true, last4: true, cardholderName: true, expiryMonth: true, expiryYear: true,
  network: true, status: true, dailySpendLimit: true, createdAt: true,
  account: { select: { accountNumber: true, type: true, nickname: true, status: true } },
} satisfies Prisma.CardSelect;

/**
 * Compare-and-set on the card's status: the write only happens if the card is still
 * in one of `from`. Without it, two concurrent changes (an admin block and a customer
 * unfreeze, or two staff approvals) could each pass their read-time check and the later
 * write would win — e.g. a BLOCKED card turned back to ACTIVE.
 */
async function transitionCard(
  client: Prisma.TransactionClient | typeof db,
  cardId: string,
  from: CardStatus[],
  data: Prisma.CardUncheckedUpdateManyInput,
  message: string,
) {
  const { count } = await client.card.updateMany({ where: { id: cardId, status: { in: from } }, data });
  if (count !== 1) throw new AppError("INVALID_STATE", message);
  return client.card.findUniqueOrThrow({ where: { id: cardId }, select: publicCard });
}

async function spentToday(client: Prisma.TransactionClient | typeof db, cardId: string, now = new Date()) {
  const agg = await client.transaction.aggregate({
    where: { cardId, type: "CARD_PAYMENT", status: "COMPLETED", createdAt: { gte: startOfDhakaDay(now) } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? BigInt(0);
}

// ───────────────────────── Customer ─────────────────────────

export async function listOwnCards(userId: string) {
  const cards = await db.card.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: publicCard });
  return Promise.all(cards.map(async (c) => ({ ...c, spentToday: c.status === "ACTIVE" || c.status === "FROZEN" ? await spentToday(db, c.id) : BigInt(0) })));
}

export async function listCardTransactions(userId: string, cardId?: string) {
  return db.transaction.findMany({
    where: { type: "CARD_PAYMENT", card: { userId, ...(cardId ? { id: cardId } : {}) } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, reference: true, amount: true, status: true, merchant: true, createdAt: true, cardId: true },
  });
}

export async function requestCard(user: SessionUser, input: { accountId: string; network: CardNetwork }) {
  const account = await db.account.findFirst({ where: { id: input.accountId, userId: user.id } });
  if (!account) throw new AppError("NOT_FOUND", "Account not found");
  if (account.status !== "ACTIVE") throw new AppError("ACCOUNT_FROZEN", "Cards can only be requested for an active account");
  const existing = await db.card.findFirst({ where: { accountId: account.id, status: { in: ["REQUESTED", "ACTIVE", "FROZEN"] } } });
  if (existing) throw new AppError("INVALID_STATE", existing.status === "REQUESTED" ? "A card request for this account is already pending" : "This account already has a card");

  const card = await db.card.create({
    data: {
      accountId: account.id,
      userId: user.id,
      cardNumberMasked: "Pending approval",
      last4: "----",
      cardholderName: user.name.toUpperCase(),
      expiryMonth: 0,
      expiryYear: 0,
      network: input.network,
      status: "REQUESTED",
      dailySpendLimit: CARD_DEFAULT_DAILY_LIMIT,
    },
    select: publicCard,
  });
  await notifyRoles(["STAFF"], { type: "REVIEW_QUEUE", title: "New card request", body: `${user.name} requested a ${input.network === "VISA" ? "Visa" : "Mastercard"}-style card.`, link: "/staff/cards" }, user.id);
  return card;
}

export async function updateOwnCard(userId: string, cardId: string, input: { action: "freeze" | "unfreeze" } | { action: "limit"; dailySpendLimit: bigint }) {
  const card = await db.card.findFirst({ where: { id: cardId, userId } });
  if (!card) throw new AppError("NOT_FOUND", "Card not found");
  if (input.action === "limit") {
    if (card.status !== "ACTIVE" && card.status !== "FROZEN") throw new AppError("INVALID_STATE", "Limits can be set on issued cards only");
    const s = await getSettings();
    if (input.dailySpendLimit > s.dailyTransferLimit) throw new AppError("VALIDATION_ERROR", `The card limit can't exceed ${formatMoney(s.dailyTransferLimit)}`);
    return transitionCard(db, cardId, ["ACTIVE", "FROZEN"], { dailySpendLimit: input.dailySpendLimit }, "Limits can be set on issued cards only");
  }
  const from: CardStatus = input.action === "freeze" ? "ACTIVE" : "FROZEN";
  const to: CardStatus = input.action === "freeze" ? "FROZEN" : "ACTIVE";
  const message = input.action === "freeze" ? "Only active cards can be frozen" : "Only frozen cards can be unfrozen";
  if (card.status !== from) throw new AppError("INVALID_STATE", message);
  return transitionCard(db, cardId, [from], { status: to }, message);
}

/**
 * Simulated merchant payment — the same atomic rules as a transfer:
 * lock account → idempotency → card + account status → PIN → card daily limit →
 * account limits → min balance → debit + CARD_PAYMENT txn + ledger → fraud flags.
 */
export async function payWithCard(user: SessionUser, cardId: string, input: { merchant: string; amount: bigint; pin: string; idempotencyKey: string }, now = new Date()) {
  const prior = await db.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (prior) {
    if (prior.initiatedById !== user.id) throw new AppError("DUPLICATE_REQUEST", "This request was already processed");
    return { replayed: true, transaction: prior };
  }
  const card = await db.card.findFirst({ where: { id: cardId, userId: user.id } });
  if (!card) throw new AppError("NOT_FOUND", "Card not found");

  type Out = { kind: "pin"; check: Extract<PinCheck, { ok: false }> } | { kind: "done"; txn: Prisma.TransactionGetPayload<object>; balanceAfter: bigint };
  let out: Out;
  try {
    out = await db.$transaction(async (tx): Promise<Out> => {
      await lockAccounts(tx, [card.accountId]);
      const again = await tx.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (again) {
        if (again.initiatedById !== user.id) throw new AppError("DUPLICATE_REQUEST", "This request was already processed");
        return { kind: "done", txn: again, balanceAfter: BigInt(-1) };
      }

      const c = await tx.card.findUniqueOrThrow({ where: { id: cardId } });
      if (c.status !== "ACTIVE") throw new AppError("CARD_INACTIVE", c.status === "FROZEN" ? "This card is frozen. Unfreeze it to pay." : "This card can't be used");
      const account = await tx.account.findUniqueOrThrow({ where: { id: c.accountId } });
      if (account.status !== "ACTIVE") throw new AppError("ACCOUNT_FROZEN", "The linked account is frozen");

      const pin = await verifyPinInTx(tx, account, input.pin, user.id, now);
      if (!pin.ok) return { kind: "pin", check: pin };

      const spent = await spentToday(tx, c.id, now);
      if (spent + input.amount > c.dailySpendLimit) {
        throw new AppError("LIMIT_EXCEEDED", `Card daily limit reached. ${formatMoney(c.dailySpendLimit - spent > BigInt(0) ? c.dailySpendLimit - spent : BigInt(0))} left today.`);
      }
      const settings = await getSettings(tx);
      const limits = effectiveLimits(account, settings);
      if (input.amount > limits.maxSingle) throw new AppError("LIMIT_EXCEEDED", `The most you can spend at once is ${formatMoney(limits.maxSingle)}`);
      if ((await usedTodayFor(tx, account.id, now)) + input.amount > limits.daily) throw new AppError("LIMIT_EXCEEDED", "This exceeds the account's daily limit");
      const balanceAfter = account.balance - input.amount;
      if (balanceAfter < settings.minimumBalance) throw new AppError("INSUFFICIENT_FUNDS", `Insufficient balance (minimum ${formatMoney(settings.minimumBalance)} must remain)`);

      const fraud = evaluateFraud(await collectFraudStats(tx, { accountId: account.id, amount: input.amount, balanceBefore: account.balance, now }));
      await tx.account.update({ where: { id: account.id }, data: { balance: balanceAfter } });
      const txn = await tx.transaction.create({
        data: {
          reference: generateTxnReference("CRD", now),
          type: "CARD_PAYMENT",
          amount: input.amount,
          status: "COMPLETED",
          senderAccountId: account.id,
          cardId: c.id,
          merchant: input.merchant,
          description: `Card •••• ${c.last4} at ${input.merchant}`,
          idempotencyKey: input.idempotencyKey,
          isFlagged: fraud.length > 0,
          flagReason: fraud.length ? fraud.join("; ") : null,
          flaggedAt: fraud.length ? now : null,
          initiatedById: user.id,
          createdAt: now,
          ledgerEntries: { create: { accountId: account.id, direction: "DEBIT", amount: input.amount, balanceAfter, createdAt: now } },
        },
      });
      return { kind: "done", txn, balanceAfter };
    }, MONEY_TX_OPTIONS);
  } catch (err) {
    if (isUniqueViolation(err, "idempotencyKey")) {
      const winner = await db.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (winner) {
        if (winner.initiatedById !== user.id) throw new AppError("DUPLICATE_REQUEST", "This request was already processed");
        return { replayed: true, transaction: winner };
      }
    }
    throw err;
  }
  if (out.kind === "pin") return throwPinError(out.check, user.id);
  if (out.balanceAfter < BigInt(0)) return { replayed: true, transaction: out.txn };

  await notify([{ userId: user.id, type: "CARD_UPDATE", title: `Card payment ${formatMoney(out.txn.amount)}`, body: `${input.merchant} · card •••• ${card.last4} · Ref ${out.txn.reference}`, link: `/transactions/${out.txn.id}` }]);
  if (out.txn.isFlagged) await notifyAdmins({ type: "SECURITY", title: "Card payment flagged", body: `${out.txn.reference} · ${formatMoney(out.txn.amount)} — ${out.txn.flagReason}`, link: "/admin/flagged" });
  return { replayed: false, transaction: out.txn, balanceAfter: out.balanceAfter };
}

// ───────────────────────── Staff / Admin ─────────────────────────

export async function listCardsForReview(args: { status?: CardStatus; page: number; pageSize: number }) {
  const where: Prisma.CardWhereInput = args.status ? { status: args.status } : {};
  const [items, total, counts] = await Promise.all([
    db.card.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (args.page - 1) * args.pageSize,
      take: args.pageSize,
      select: { ...publicCard, user: { select: { id: true, name: true, email: true, isVerified: true } }, approvedBy: { select: { name: true } } },
    }),
    db.card.count({ where }),
    db.card.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return { items, total, page: args.page, pageSize: args.pageSize, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) };
}

export async function reviewCard(actor: SessionUser, cardId: string, input: { action: "approve" } | { action: "reject"; reason: string }) {
  const card = await db.card.findUnique({ where: { id: cardId }, include: { account: true } });
  if (!card) throw new AppError("NOT_FOUND", "Card not found");
  assertNotSelf(actor.id, card.userId);
  if (card.status !== "REQUESTED") throw new AppError("INVALID_STATE", "This card request was already decided");

  if (input.action === "reject") {
    const updated = await db.$transaction(async (tx) => {
      const c = await transitionCard(tx, cardId, ["REQUESTED"], { status: "REJECTED", approvedById: actor.id }, "This card request was already decided");
      await writeAudit({ actorId: actor.id, action: "CARD_REJECTED", entity: "Card", entityId: cardId, metadata: { reason: input.reason } }, tx);
      return c;
    });
    await notify([{ userId: card.userId, type: "CARD_UPDATE", title: "Card request declined", body: input.reason, link: "/cards", email: true }]);
    return updated;
  }

  if (card.account.status !== "ACTIVE") throw new AppError("ACCOUNT_FROZEN", "The linked account is not active");
  const { masked, last4 } = generateMaskedNumber(card.network);
  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    const c = await transitionCard(
      tx,
      cardId,
      ["REQUESTED"],
      {
        status: "ACTIVE",
        cardNumberMasked: masked,
        last4,
        expiryMonth: now.getUTCMonth() + 1,
        expiryYear: now.getUTCFullYear() + CARD_VALID_YEARS,
        approvedById: actor.id,
      },
      "This card request was already decided",
    );
    await writeAudit({ actorId: actor.id, action: "CARD_APPROVED", entity: "Card", entityId: cardId, metadata: { last4, accountId: card.accountId } }, tx);
    return c;
  });
  await notify([{ userId: card.userId, type: "CARD_UPDATE", title: "Your virtual card is ready", body: `Card •••• ${last4} linked to ${maskAccountNumber(card.account.accountNumber)}. Simulated card — for demo payments only.`, link: "/cards", email: true }]);
  return updated;
}

/** Staff/Admin freeze or unfreeze any card (e.g. a customer calls in). */
export async function setCardFrozenAsStaff(actor: SessionUser, cardId: string, freeze: boolean) {
  const card = await db.card.findUnique({ where: { id: cardId } });
  if (!card) throw new AppError("NOT_FOUND", "Card not found");
  assertNotSelf(actor.id, card.userId);
  const message = freeze ? "Only active cards can be frozen" : "Only frozen cards can be unfrozen";
  if (card.status !== (freeze ? "ACTIVE" : "FROZEN")) throw new AppError("INVALID_STATE", message);
  return db.$transaction(async (tx) => {
    const c = await transitionCard(tx, cardId, [freeze ? "ACTIVE" : "FROZEN"], { status: freeze ? "FROZEN" : "ACTIVE" }, message);
    await writeAudit({ actorId: actor.id, action: freeze ? "CARD_FROZEN" : "CARD_UNFROZEN", entity: "Card", entityId: cardId }, tx);
    return c;
  });
}

/** Admin: permanent block. A blocked card can never be reactivated. */
export async function blockCard(admin: SessionUser, cardId: string, reason: string) {
  const card = await db.card.findUnique({ where: { id: cardId } });
  if (!card) throw new AppError("NOT_FOUND", "Card not found");
  assertNotSelf(admin.id, card.userId);
  if (card.status !== "ACTIVE" && card.status !== "FROZEN") throw new AppError("INVALID_STATE", "Only issued cards can be blocked");
  const updated = await db.$transaction(async (tx) => {
    const c = await transitionCard(tx, cardId, ["ACTIVE", "FROZEN"], { status: "BLOCKED" }, "Only issued cards can be blocked");
    await writeAudit({ actorId: admin.id, action: "CARD_BLOCKED", entity: "Card", entityId: cardId, metadata: { reason } }, tx);
    return c;
  });
  await notify([{ userId: card.userId, type: "CARD_UPDATE", title: `Card •••• ${card.last4} blocked`, body: reason, link: "/cards", email: true }]);
  return updated;
}
