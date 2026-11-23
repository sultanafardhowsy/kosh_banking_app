import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, CreditCard, HandCoins, RotateCcw, Wallet } from "lucide-react";
import type { CustomerTxn, TransactionType } from "@/types/api";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, formatDateTime } from "@/lib/format";

export const TXN_TYPE_LABEL: Record<TransactionType, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  TRANSFER: "Transfer",
  LOAN_DISBURSEMENT: "Loan disbursement",
  LOAN_REPAYMENT: "Loan repayment",
  CARD_PAYMENT: "Card payment",
  REVERSAL: "Reversal",
};

export function TxnIcon({ type, direction }: { type: TransactionType; direction: CustomerTxn["direction"] }) {
  const Icon =
    type === "DEPOSIT" ? Banknote
    : type === "WITHDRAWAL" ? Wallet
    : type === "LOAN_DISBURSEMENT" || type === "LOAN_REPAYMENT" ? HandCoins
    : type === "CARD_PAYMENT" ? CreditCard
    : type === "REVERSAL" ? RotateCcw
    : direction === "internal" ? ArrowLeftRight
    : direction === "in" ? ArrowDownLeft
    : ArrowUpRight;
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full",
        direction === "in" ? "bg-[var(--kosh-success-bg)] text-kosh-money-in" : "bg-kosh-subtle text-kosh-text",
      )}
    >
      <Icon className="size-[18px]" />
    </span>
  );
}

/** One transaction line, used on the dashboard and in history lists. */
export function TxnRow({ t, href = true }: { t: CustomerTxn; href?: boolean }) {
  const body = (
    <div className="flex items-center gap-3">
      <TxnIcon type={t.type} direction={t.direction} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{t.counterparty}</p>
        <p className="truncate text-xs text-kosh-muted">
          {t.description ? `${t.description} · ` : ""}
          {formatDateTime(t.createdAt)}
        </p>
      </div>
      <div className="text-right">
        <Money
          value={t.net}
          direction={t.direction === "internal" ? undefined : t.direction}
          className={cn("text-sm font-semibold", t.status === "REVERSED" && "line-through opacity-60")}
        />
        {t.status !== "COMPLETED" ? (
          <div className="mt-0.5">
            <StatusBadge status={t.status} className="text-[10px]" />
          </div>
        ) : (
          <p className="text-[11px] text-kosh-muted">{TXN_TYPE_LABEL[t.type]}</p>
        )}
      </div>
    </div>
  );
  return href ? (
    <Link href={`/transactions/${t.id}`} className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-kosh-subtle">
      {body}
    </Link>
  ) : (
    body
  );
}
