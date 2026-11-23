"use client";

import { useState } from "react";
import { Button, Dropdown, toast } from "@heroui/react";
import { Check, MoreHorizontal, X } from "lucide-react";
import { useBlockCardMutation, useGetCardQueueQuery, useReviewCardMutation } from "@/store/api/cardsApi";
import { useAppSelector } from "@/store/hooks";
import { selectUser } from "@/store/slices/authSlice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReasonDialog } from "@/components/manage/ReasonDialog";
import { errorMessage } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { formatDate, maskAccountNumber, titleCase } from "@/lib/format";
import type { CardStatus, ReviewCardRow } from "@/types/api";

/** Card requests + issued cards. Staff/admin approve, reject, freeze; admin blocks permanently. */
export function CardQueue({ scope }: { scope: "staff" | "admin" }) {
  const me = useAppSelector(selectUser);
  const [status, setStatus] = useState<CardStatus | "ALL">("REQUESTED");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetCardQueueQuery({ status: status === "ALL" ? undefined : status, page });
  const [review] = useReviewCardMutation();
  const [block] = useBlockCardMutation();
  const [target, setTarget] = useState<{ card: ReviewCardRow; action: "reject" | "block" } | null>(null);
  const c = data?.counts ?? {};

  async function quick(card: ReviewCardRow, action: "approve" | "freeze" | "unfreeze") {
    try {
      await review({ id: card.id, action }).unwrap();
      toast.success(action === "approve" ? `Card issued to ${card.user.name}` : action === "freeze" ? "Card frozen" : "Card unfrozen");
    } catch (e) {
      toast.danger(errorMessage(e));
    }
  }

  const columns: Column<ReviewCardRow>[] = [
    {
      key: "who",
      header: "Customer",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.user.name}</p>
          <p className="text-xs text-kosh-muted">{r.user.email}{!r.user.isVerified && " · unverified"}</p>
        </div>
      ),
    },
    { key: "card", header: "Card", cell: (r) => <span className="amount text-sm">{r.status === "REQUESTED" ? `${r.network === "VISA" ? "Visa" : "Mastercard"} · new` : r.cardNumberMasked}</span> },
    { key: "acc", header: "Account", cell: (r) => <span className="text-kosh-muted"><span className="amount">{maskAccountNumber(r.account.accountNumber)}</span> · {titleCase(r.account.type)}</span> },
    { key: "limit", header: "Daily limit", hideOnMobile: true, align: "right", cell: (r) => <span className="amount">{formatMoney(r.dailySpendLimit, { decimals: false })}</span> },
    { key: "date", header: r0(status), hideOnMobile: true, cell: (r) => <span className="text-kosh-muted">{formatDate(r.createdAt)}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (r) => {
        if (r.user.id === me?.id) return <span className="text-xs text-kosh-muted">Your card</span>;
        if (r.status === "REQUESTED") {
          return (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" isIconOnly aria-label={`Reject card for ${r.user.name}`} onPress={() => setTarget({ card: r, action: "reject" })}><X className="size-4" /></Button>
              <Button size="sm" onPress={() => quick(r, "approve")}><Check className="size-4" /> Issue</Button>
            </div>
          );
        }
        if (r.status !== "ACTIVE" && r.status !== "FROZEN") return null;
        return (
          <Dropdown>
            <Dropdown.Trigger aria-label={`Actions for card ${r.last4}`} className="grid size-8 place-items-center rounded-lg hover:bg-kosh-subtle"><MoreHorizontal className="size-4" /></Dropdown.Trigger>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu onAction={(k) => (k === "block" ? setTarget({ card: r, action: "block" }) : quick(r, k as "freeze" | "unfreeze"))}>
                {r.status === "ACTIVE" ? <Dropdown.Item id="freeze" textValue="Freeze">Freeze card</Dropdown.Item> : <Dropdown.Item id="unfreeze" textValue="Unfreeze">Unfreeze card</Dropdown.Item>}
                {scope === "admin" ? <Dropdown.Item id="block" textValue="Block" variant="danger">Block permanently</Dropdown.Item> : null}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title={scope === "admin" ? "Cards" : "Card requests"} description="Virtual cards are simulated — numbers are random test-range values, stored masked." />
      <Segmented
        ariaLabel="Status"
        value={status}
        onChange={(s) => { setStatus(s); setPage(1); }}
        options={[
          { value: "REQUESTED", label: "Requests", count: c.REQUESTED ?? 0 },
          { value: "ACTIVE", label: "Active", count: c.ACTIVE ?? 0 },
          { value: "FROZEN", label: "Frozen", count: c.FROZEN ?? 0 },
          { value: "BLOCKED", label: "Blocked", count: c.BLOCKED ?? 0 },
          { value: "REJECTED", label: "Rejected", count: c.REJECTED ?? 0 },
          { value: "ALL", label: "All" },
        ]}
        className="mb-4"
      />
      <Panel>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          emptyTitle={status === "REQUESTED" ? "No card requests waiting" : "No cards here"}
          page={page}
          pageCount={data ? Math.ceil(data.total / data.pageSize) : undefined}
          onPageChange={setPage}
        />
      </Panel>
      {target && (
        <ReasonDialog
          open
          onClose={() => setTarget(null)}
          tone="danger"
          title={target.action === "reject" ? `Decline ${target.card.user.name}'s card request?` : `Block card ${target.card.cardNumberMasked}?`}
          description={target.action === "block" ? "Blocking is permanent — the card can never be used again. The customer is notified." : "The customer is notified with your reason."}
          confirmLabel={target.action === "reject" ? "Decline" : "Block card"}
          onConfirm={async (reason) => {
            if (target.action === "reject") await review({ id: target.card.id, action: "reject", reason }).unwrap();
            else await block({ id: target.card.id, reason }).unwrap();
            toast.success(target.action === "reject" ? "Request declined" : "Card blocked");
          }}
        />
      )}
    </>
  );
}

function r0(status: CardStatus | "ALL") {
  return status === "REQUESTED" ? "Requested" : "Since";
}
