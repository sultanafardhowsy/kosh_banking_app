"use client";

import { useEffect, useMemo } from "react";
import { Dropdown } from "@heroui/react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useGetMeQuery } from "@/store/api/meApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAccount, selectSelectedAccountId } from "@/store/slices/accountSlice";
import { maskAccountNumber, titleCase } from "@/lib/format";
import { SkeletonBlock } from "@/components/ui/Skeletons";

/** Customer topbar control: picks the account used across dashboard/transfer/history. */
export function AccountSwitcher() {
  const { data, isLoading } = useGetMeQuery();
  const selectedId = useAppSelector(selectSelectedAccountId);
  const dispatch = useAppDispatch();
  const accounts = useMemo(() => data?.accounts ?? [], [data]);

  // Default to the first account once loaded.
  useEffect(() => {
    if (!selectedId && accounts.length) dispatch(selectAccount(accounts[0]!.id));
  }, [selectedId, accounts, dispatch]);

  if (isLoading) return <SkeletonBlock className="h-9 w-40" />;
  if (!accounts.length) return null;

  const current = accounts.find((a) => a.id === selectedId) ?? accounts[0]!;

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label="Switch account"
        className="flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-kosh-border bg-kosh-surface px-3 text-sm outline-none hover:bg-kosh-subtle focus-visible:ring-2 focus-visible:ring-kosh-info md:w-auto md:justify-start"
      >
        <span className="font-medium">{current.nickname ?? titleCase(current.type)}</span>
        <span className="amount text-kosh-muted">{maskAccountNumber(current.accountNumber)}</span>
        <ChevronsUpDown className="size-3.5 text-kosh-muted" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start" className="min-w-64">
        <Dropdown.Menu onAction={(key) => dispatch(selectAccount(String(key)))}>
          {accounts.map((a) => (
            <Dropdown.Item key={a.id} id={a.id} textValue={a.accountNumber}>
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{a.nickname ?? `${titleCase(a.type)} account`}</p>
                  <p className="amount text-xs text-kosh-muted">{maskAccountNumber(a.accountNumber)}</p>
                </div>
                {a.id === current.id && <Check className="size-4" />}
              </div>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
