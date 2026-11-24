"use client";

import Link from "next/link";
import { ChevronRight, KeyRound, Lock } from "lucide-react";
import { useGetAccountsQuery } from "@/store/api/accountsApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
import { SkeletonBlock } from "@/components/ui/Skeletons";
import { cn, formatAccountNumber, formatDate, titleCase } from "@/lib/format";

const TYPE_STYLE = {
  SAVINGS: "bg-kosh-navy text-kosh-navy-fg",
  CURRENT: "bg-kosh-surface text-kosh-text border border-kosh-border",
  BUSINESS: "bg-gradient-to-br from-[#0B1220] to-[#0A3A63] text-white",
} as const;

export default function AccountsPage() {
  const { data, isLoading } = useGetAccountsQuery();

  return (
    <>
      <PageHeader title="Accounts" description="Balances, statements and PIN status for each account." />
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-48 rounded-[20px]" />
          ))}
        </div>
      ) : !data?.length ? (
        <Panel>
          <EmptyState title="No accounts yet" description="A Kosh staff member opens accounts after verifying your profile." />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((a) => {
            const onNavy = a.type !== "CURRENT";
            return (
              <Link
                key={a.id}
                href={`/accounts/${a.id}`}
                className={cn("group flex flex-col rounded-[20px] p-5 transition-transform hover:-translate-y-0.5", TYPE_STYLE[a.type])}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={cn("text-xs font-medium uppercase tracking-wider", onNavy ? "text-white/60" : "text-kosh-muted")}>
                      {titleCase(a.type)}
                    </p>
                    <p className="mt-0.5 font-semibold">{a.nickname ?? `${titleCase(a.type)} account`}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <Money value={a.balance} className="mt-6 text-3xl font-semibold" />
                <p className={cn("amount mt-1 text-sm", onNavy ? "text-white/60" : "text-kosh-muted")}>{formatAccountNumber(a.accountNumber)}</p>
                <div className={cn("mt-5 flex items-center justify-between border-t pt-3 text-xs", onNavy ? "border-white/15 text-white/70" : "border-kosh-border text-kosh-muted")}>
                  <span className="inline-flex items-center gap-1.5">
                    {a.pinLocked ? <Lock className="size-3.5" /> : <KeyRound className="size-3.5" />}
                    {a.pinLocked ? "PIN locked" : a.hasPin ? "PIN set" : "No PIN yet"}
                    <span aria-hidden>·</span> Since {formatDate(a.createdAt, { month: "short", year: "numeric", day: undefined })}
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-medium">
                    Statement <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
