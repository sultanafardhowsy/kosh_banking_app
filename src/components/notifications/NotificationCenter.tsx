"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Label, Switch, toast } from "@heroui/react";
import { ArrowDownLeft, ArrowUpRight, Bell, CheckCheck, CircleCheck, CircleX, CreditCard, HandCoins, ListChecks, Mail, ShieldAlert } from "lucide-react";
import {
  useGetNotificationsQuery, useGetPreferencesQuery, useMarkAllReadMutation, useMarkNotificationReadMutation, useUpdatePreferencesMutation,
} from "@/store/api/notificationsApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeletons";
import { errorMessage } from "@/lib/client";
import { cn, formatDateTime } from "@/lib/format";
import type { AppNotification } from "@/types/api";

function iconFor(type: string) {
  if (type === "TRANSFER_RECEIVED") return ArrowDownLeft;
  if (type === "TRANSFER_SENT") return ArrowUpRight;
  if (type === "REQUEST_APPROVED") return CircleCheck;
  if (type === "REQUEST_REJECTED" || type === "LOAN_REJECTED") return CircleX;
  if (type.startsWith("LOAN") || type === "INSTALLMENT_DUE") return HandCoins;
  if (type === "CARD_UPDATE") return CreditCard;
  if (type === "REVIEW_QUEUE") return ListChecks;
  if (type === "SECURITY") return ShieldAlert;
  return Bell;
}

const PROVIDER_NOTE = {
  smtp: "Sent by email to",
  resend: "Sent by email to",
  log: "Email delivery isn't configured on this server yet — emails are kept in the bank's email log for",
} as const;

/** Shared by customers, staff and admins (each role has its own route). */
export function NotificationCenter() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetNotificationsQuery({ page, unread: filter === "unread" });
  const { data: prefs } = useGetPreferencesQuery();
  const [updatePrefs, prefsState] = useUpdatePreferencesMutation();
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll, markAllState] = useMarkAllReadMutation();
  const pages = data ? Math.ceil(data.total / data.pageSize) : 1;

  function open(n: AppNotification) {
    if (!n.isRead) markRead(n.id);
    if (n.link) router.push(n.link);
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description={data ? `${data.unread} unread` : undefined}
        actions={
          <Button variant="outline" size="sm" onPress={() => markAll()} isPending={markAllState.isLoading} isDisabled={!data?.unread}>
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        }
      />

      {prefs && (
        <Panel className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-kosh-subtle"><Mail className="size-4" /></span>
            <div>
              <p className="text-sm font-medium">Email me about important activity</p>
              <p className="text-xs text-kosh-muted">
                Transfers, approvals, loan decisions, account and security changes. {PROVIDER_NOTE[prefs.emailProvider]} {prefs.email}.
              </p>
            </div>
          </div>
          <Switch
            className="flex flex-row-reverse items-center gap-2"
            isSelected={prefs.emailNotifications}
            isDisabled={prefsState.isLoading}
            onChange={async (on) => {
              try {
                await updatePrefs({ emailNotifications: on }).unwrap();
                toast.success(on ? "Email notifications on" : "Email notifications off");
              } catch (e) {
                toast.danger(errorMessage(e));
              }
            }}
          >
            <Switch.Control><Switch.Thumb /></Switch.Control>
            <Switch.Content><Label className="text-sm">{prefs.emailNotifications ? "On" : "Off"}</Label></Switch.Content>
          </Switch>
        </Panel>
      )}

      <Segmented
        ariaLabel="Filter"
        value={filter}
        onChange={(v) => { setFilter(v); setPage(1); }}
        options={[{ value: "all", label: "All" }, { value: "unread", label: "Unread", count: data?.unread }]}
        className="mb-4"
      />
      <Panel>
        {isLoading ? (
          <TableSkeleton />
        ) : !data?.items.length ? (
          <EmptyState icon={<Bell />} title={filter === "unread" ? "You're all caught up" : "No notifications yet"} />
        ) : (
          <ul className="divide-y divide-kosh-border">
            {data.items.map((n) => {
              const Icon = iconFor(n.type);
              return (
                <li key={n.id}>
                  <button type="button" onClick={() => open(n)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-kosh-subtle">
                    <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full", n.isRead ? "bg-kosh-subtle text-kosh-muted" : "bg-kosh-navy text-kosh-accent-soft")}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", n.isRead ? "text-kosh-muted" : "font-semibold")}>{n.title}</span>
                      <span className="mt-0.5 block text-sm text-kosh-muted">{n.body}</span>
                      <span className="mt-1 block text-xs text-kosh-muted">{formatDateTime(n.createdAt)}</span>
                    </span>
                    {!n.isRead && <span className="mt-2 size-2 shrink-0 rounded-full bg-kosh-accent" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-kosh-border px-5 py-3 text-sm">
            <span className="text-kosh-muted">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" isDisabled={page <= 1} onPress={() => setPage(page - 1)}>Previous</Button>
              <Button size="sm" variant="outline" isDisabled={page >= pages} onPress={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}
