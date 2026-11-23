"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, FileDown, RotateCcw } from "lucide-react";
import { useGetTransactionQuery } from "@/store/api/transactionsApi";
import { useGetMeQuery } from "@/store/api/meApi";
import { Panel } from "@/components/ui/Panel";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonBlock } from "@/components/ui/Skeletons";
import { TxnIcon, TXN_TYPE_LABEL } from "@/components/banking/TxnRow";
import { errorCode } from "@/lib/client";
import { formatDateTime, maskAccountNumber, titleCase } from "@/lib/format";

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: t, isLoading, error } = useGetTransactionQuery(id);
  const { data: me } = useGetMeQuery();
  const accName = (accountId: string | null) => {
    const a = me?.accounts.find((x) => x.id === accountId);
    return a ? `${a.nickname ?? titleCase(a.type)} ${maskAccountNumber(a.accountNumber)}` : "—";
  };

  if (errorCode(error) === "NOT_FOUND") {
    return (
      <Panel>
        <EmptyState title="Transaction not found" description="It doesn't exist or isn't on one of your accounts." action={<Link href="/transactions" className="text-kosh-info">Back to transactions</Link>} />
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/transactions" className="inline-flex items-center gap-1.5 text-sm text-kosh-muted hover:text-kosh-text">
        <ArrowLeft className="size-4" /> Transactions
      </Link>

      <Panel className="p-6">
        {isLoading || !t ? (
          <div className="space-y-4">
            <SkeletonBlock className="mx-auto size-12 rounded-full" />
            <SkeletonBlock className="mx-auto h-9 w-48" />
            <SkeletonBlock className="h-40" />
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              <TxnIcon type={t.type} direction={t.direction} />
              <p className="mt-3 text-sm text-kosh-muted">{t.counterparty}</p>
              <Money value={t.net} direction={t.direction === "internal" ? undefined : t.direction} className="mt-1 block text-4xl font-semibold" />
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge status={t.status} />
                <span className="text-xs text-kosh-muted">{TXN_TYPE_LABEL[t.type]}</span>
              </div>
            </div>

            {t.reversal && (
              <Link href={`/transactions/${t.reversal.id}`} className="mt-5 flex items-center gap-2 rounded-xl bg-[var(--kosh-neutral-bg)] px-3 py-2.5 text-sm text-[var(--kosh-neutral-fg)]">
                <RotateCcw className="size-4" /> Reversed by the bank — see <span className="amount font-medium">{t.reversal.reference}</span>
              </Link>
            )}
            {t.reversalOf && (
              <Link href={`/transactions/${t.reversalOf.id}`} className="mt-5 flex items-center gap-2 rounded-xl bg-[var(--kosh-neutral-bg)] px-3 py-2.5 text-sm text-[var(--kosh-neutral-fg)]">
                <RotateCcw className="size-4" /> Reversal of <span className="amount font-medium">{t.reversalOf.reference}</span>
              </Link>
            )}

            <dl className="mt-6 divide-y divide-kosh-border rounded-2xl border border-kosh-border text-sm">
              {(
                [
                  ["Reference", <span key="r" className="amount">{t.reference}</span>],
                  ["Date", formatDateTime(t.createdAt)],
                  ["Amount", <Money key="a" value={t.amount} />],
                  ...(t.fee !== "0" ? [["Fee", <Money key="f" value={t.fee} />]] : []),
                  ...(t.fromAccountId ? [["From", accName(t.fromAccountId)]] : []),
                  ...(t.toAccountId ? [["To", accName(t.toAccountId)]] : t.counterpartyAccount ? [["To", `${t.counterparty} ${t.counterpartyAccount}`]] : []),
                  ...(t.description ? [["Note", t.description]] : []),
                ] as [string, React.ReactNode][]
              ).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-kosh-muted">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>

            <a
              href={`/api/receipts/${t.id}`}
              target="_blank"
              rel="noopener"
              className="button button--outline button--md mt-6 w-full"
            >
              <FileDown className="size-4" /> Download PDF receipt
            </a>

            {t.ledger.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold">Ledger</h2>
                <ul className="mt-2 space-y-2 text-sm">
                  {t.ledger.map((l, i) => (
                    <li key={i} className="flex items-center justify-between rounded-xl bg-kosh-subtle px-3 py-2">
                      <span>
                        <span className="font-medium">{l.direction === "CREDIT" ? "Credit" : "Debit"}</span>{" "}
                        <span className="text-kosh-muted">· {accName(l.accountId)}</span>
                      </span>
                      <span className="text-right">
                        <Money value={l.amount} direction={l.direction === "CREDIT" ? "in" : "out"} className="font-medium" />
                        <span className="block text-xs text-kosh-muted">
                          balance <Money value={l.balanceAfter} />
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
