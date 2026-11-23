"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Input, Label, Modal, Switch, TextField, toast } from "@heroui/react";
import { CreditCard, Eye, EyeOff, Plus, ShoppingBag, Snowflake } from "lucide-react";
import { useGetMyCardsQuery, usePayWithCardMutation, useRequestCardMutation, useUpdateCardMutation } from "@/store/api/cardsApi";
import { useGetMeQuery } from "@/store/api/meApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCard, selectCardRevealed, selectSelectedCardId, toggleReveal } from "@/store/slices/cardSlice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { PinInput } from "@/components/ui/PinInput";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonBlock } from "@/components/ui/Skeletons";
import { VirtualCard } from "@/components/cards/VirtualCard";
import { errorMessage, newIdempotencyKey } from "@/lib/client";
import { formatMoney, takaToPaisa, toBigInt } from "@/lib/money";
import { cn, formatDateTime, maskAccountNumber, titleCase } from "@/lib/format";
import type { CardRow } from "@/types/api";

const MERCHANTS = ["Shwapno", "Daraz", "Foodpanda", "Pathao", "Aarong", "Chaldal", "Star Cineplex"];

export default function CardsPage() {
  const dispatch = useAppDispatch();
  const { data, isLoading } = useGetMyCardsQuery();
  const { data: me } = useGetMeQuery();
  const selectedId = useAppSelector(selectSelectedCardId);
  const revealed = useAppSelector(selectCardRevealed);
  const [update, updateState] = useUpdateCardMutation();
  const [dialog, setDialog] = useState<"request" | "pay" | "limit" | null>(null);

  const cards = useMemo(() => data?.cards ?? [], [data]);
  const card = cards.find((c) => c.id === selectedId) ?? cards.find((c) => c.status === "ACTIVE") ?? cards[0];
  useEffect(() => {
    if (card && card.id !== selectedId) dispatch(selectCard(card.id));
  }, [card, selectedId, dispatch]);

  const accountsWithoutCard = (me?.accounts ?? []).filter(
    (a) => a.status === "ACTIVE" && !cards.some((c) => c.accountId === a.id && ["REQUESTED", "ACTIVE", "FROZEN"].includes(c.status)),
  );
  const payments = (data?.payments ?? []).filter((p) => !card || p.cardId === card.id);
  const spent = card?.spentToday ? toBigInt(card.spentToday) : BigInt(0);
  const limit = card ? toBigInt(card.dailySpendLimit) : BigInt(1);
  const pct = Number((spent * BigInt(100)) / (limit || BigInt(1)));

  return (
    <>
      <PageHeader
        title="Virtual cards"
        description="Simulated debit cards for demo payments. No real card network is involved."
        actions={accountsWithoutCard.length > 0 && <Button onPress={() => setDialog("request")}><Plus className="size-4" /> Request a card</Button>}
      />

      {isLoading ? (
        <SkeletonBlock className="h-72 rounded-[22px]" />
      ) : !cards.length ? (
        <Panel>
          <EmptyState
            icon={<CreditCard />}
            title="No cards yet"
            description="Request a virtual card for any active account. Staff approve it, then you can make simulated payments."
            action={<Button onPress={() => setDialog("request")} isDisabled={!accountsWithoutCard.length}>Request a card</Button>}
          />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <div className="space-y-4">
            {card && <VirtualCard card={card} revealed={revealed} />}
            {cards.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Your cards">
                {cards.map((c) => (
                  <button
                    key={c.id}
                    role="tab"
                    aria-selected={c.id === card?.id}
                    onClick={() => dispatch(selectCard(c.id))}
                    className={cn("shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition", c.id === card?.id ? "border-kosh-accent bg-kosh-accent/5" : "border-kosh-border hover:bg-kosh-subtle")}
                  >
                    <span className="block font-medium">{c.network === "VISA" ? "Visa" : "Mastercard"} •••• {c.last4 === "----" ? "new" : c.last4}</span>
                    <span className="text-kosh-muted">{c.account.nickname ?? titleCase(c.account.type)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {card && (
            <div className="space-y-6">
              <Panel className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-kosh-muted">Linked to {card.account.nickname ?? titleCase(card.account.type)} <span className="amount">{maskAccountNumber(card.account.accountNumber)}</span></p>
                    <div className="mt-1 flex items-center gap-2"><StatusBadge status={card.status} /></div>
                  </div>
                  {(card.status === "ACTIVE" || card.status === "FROZEN") && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="ghost" onPress={() => dispatch(toggleReveal())}>
                        {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {revealed ? "Hide details" : "Show details"}
                      </Button>
                      <Switch
                        className="flex flex-row-reverse items-center gap-2"
                        isSelected={card.status === "FROZEN"}
                        isDisabled={updateState.isLoading}
                        onChange={async (frozen) => {
                          try {
                            await update({ id: card.id, action: frozen ? "freeze" : "unfreeze" }).unwrap();
                            toast.success(frozen ? "Card frozen" : "Card unfrozen");
                          } catch (e) { toast.danger(errorMessage(e)); }
                        }}
                      >
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="flex items-center gap-1.5 text-sm"><Snowflake className="size-4" /> Freeze</Label></Switch.Content>
                      </Switch>
                    </div>
                  )}
                </div>

                {(card.status === "ACTIVE" || card.status === "FROZEN") && (
                  <>
                    <div className="mt-5">
                      <div className="flex justify-between text-sm">
                        <span className="text-kosh-muted">Spent today</span>
                        <span><Money value={spent} className="font-semibold" /> <span className="text-kosh-muted">of {formatMoney(limit, { decimals: false })}</span></span>
                      </div>
                      <div className="mt-2 h-2.5 rounded-full bg-kosh-subtle" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Daily card limit used">
                        <div className={cn("h-full rounded-full", pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-kosh-accent")} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button onPress={() => setDialog("pay")} isDisabled={card.status !== "ACTIVE"}><ShoppingBag className="size-4" /> Simulate a payment</Button>
                      <Button variant="outline" onPress={() => setDialog("limit")}>Daily limit</Button>
                    </div>
                  </>
                )}
                {card.status === "REQUESTED" && <p className="mt-4 text-sm text-kosh-muted">Your request is with Kosh staff. You&apos;ll get a notification when the card is issued.</p>}
                {card.status === "REJECTED" && <p className="mt-4 text-sm text-kosh-muted">This request was declined — check your notifications for the reason.</p>}
                {card.status === "BLOCKED" && <p className="mt-4 text-sm text-kosh-muted">This card was permanently blocked by the bank. Request a new one if you need a card for this account.</p>}
              </Panel>

              <Panel>
                <PanelHeader title="Card payments" description="Recent simulated purchases on this card." />
                <ul className="mt-3 divide-y divide-kosh-border">
                  {payments.length === 0 && <li><EmptyState title="No payments yet" /></li>}
                  {payments.map((p) => (
                    <li key={p.id}>
                      <Link href={`/transactions/${p.id}`} className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-kosh-subtle">
                        <span className="flex items-center gap-3">
                          <span className="grid size-9 place-items-center rounded-full bg-kosh-subtle"><ShoppingBag className="size-4" /></span>
                          <span>
                            <span className="block text-sm font-medium">{p.merchant}</span>
                            <span className="text-xs text-kosh-muted">{formatDateTime(p.createdAt)}</span>
                          </span>
                        </span>
                        <Money value={p.amount} direction="out" className={cn("text-sm font-semibold", p.status === "REVERSED" && "line-through opacity-60")} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          )}
        </div>
      )}

      {dialog === "request" && <RequestCardDialog accounts={accountsWithoutCard} onClose={() => setDialog(null)} />}
      {dialog === "pay" && card && <PayDialog card={card} onClose={() => setDialog(null)} />}
      {dialog === "limit" && card && <LimitDialog card={card} onClose={() => setDialog(null)} />}
    </>
  );
}

function RequestCardDialog({ accounts, onClose }: { accounts: { id: string; accountNumber: string; type: string; nickname: string | null }[]; onClose: () => void }) {
  const [request, state] = useRequestCardMutation();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [network, setNetwork] = useState<"VISA" | "MASTERCARD">("VISA");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal.Backdrop isOpen onOpenChange={(o) => !o && onClose()}>
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog>
          <Modal.Header><Modal.Heading>Request a virtual card</Modal.Heading></Modal.Header>
          <Modal.Body className="space-y-4">
            <NativeSelect label="Account" value={accountId} onChange={(e) => setAccountId(e.target.value)} options={accounts.map((a) => ({ value: a.id, label: `${a.nickname ?? titleCase(a.type)} ${maskAccountNumber(a.accountNumber)}` }))} />
            <NativeSelect label="Network (cosmetic)" value={network} onChange={(e) => setNetwork(e.target.value as "VISA" | "MASTERCARD")} options={[{ value: "VISA", label: "Visa style" }, { value: "MASTERCARD", label: "Mastercard style" }]} />
            <p className="text-xs text-kosh-muted">Simulated card: the number is random and can&apos;t be used anywhere real. Payments use this account&apos;s PIN and limits.</p>
            {error && <p className="text-sm text-danger">{error}</p>}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={onClose}>Cancel</Button>
            <Button isPending={state.isLoading} onPress={async () => {
              setError(null);
              try { await request({ accountId, network }).unwrap(); toast.success("Card requested", { description: "Staff will review it shortly." }); onClose(); }
              catch (e) { setError(errorMessage(e)); }
            }}>Request card</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function PayDialog({ card, onClose }: { card: CardRow; onClose: () => void }) {
  const [pay, state] = usePayWithCardMutation();
  const [merchant, setMerchant] = useState(MERCHANTS[0]!);
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(newIdempotencyKey);
  let paisa: bigint | null = null;
  try { paisa = amount ? takaToPaisa(amount) : null; } catch { paisa = null; }

  async function submit(code = pin) {
    if (!paisa || code.length !== 4) return;
    setError(null);
    try {
      await pay({ id: card.id, merchant, amount: paisa.toString(), pin: code, idempotencyKey: key }).unwrap();
      toast.success(`Paid ${formatMoney(paisa)} at ${merchant}`);
      onClose();
    } catch (e) { setError(errorMessage(e)); setPin(""); }
  }

  return (
    <Modal.Backdrop isOpen onOpenChange={(o) => !o && !state.isLoading && onClose()}>
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog>
          <Modal.Header><Modal.Heading>Simulate a card payment</Modal.Heading></Modal.Header>
          <Modal.Body className="space-y-4">
            <NativeSelect label="Merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} options={MERCHANTS.map((m) => ({ value: m, label: m }))} />
            <TextField value={amount} onChange={setAmount} fullWidth isInvalid={Boolean(amount) && !paisa}>
              <Label>Amount (৳)</Label>
              <Input inputMode="decimal" placeholder="0.00" autoFocus />
            </TextField>
            <div>
              <p className="mb-2 text-sm font-medium">Account PIN</p>
              <PinInput value={pin} onChange={setPin} onComplete={(v) => submit(v)} isInvalid={Boolean(error)} />
            </div>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={onClose} isDisabled={state.isLoading}>Cancel</Button>
            <Button onPress={() => submit()} isPending={state.isLoading} isDisabled={!paisa || pin.length !== 4}>Pay {paisa ? formatMoney(paisa) : ""}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function LimitDialog({ card, onClose }: { card: CardRow; onClose: () => void }) {
  const [update, state] = useUpdateCardMutation();
  const [value, setValue] = useState(String(toBigInt(card.dailySpendLimit) / BigInt(100)));
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal.Backdrop isOpen onOpenChange={(o) => !o && onClose()}>
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog>
          <Modal.Header><Modal.Heading>Daily card limit</Modal.Heading></Modal.Header>
          <Modal.Body className="space-y-3">
            <TextField value={value} onChange={setValue} fullWidth>
              <Label>Limit per day (৳)</Label>
              <Input inputMode="numeric" />
            </TextField>
            <p className="text-xs text-kosh-muted">Can&apos;t exceed the bank&apos;s daily transfer limit. Account limits still apply.</p>
            {error && <p className="text-sm text-danger">{error}</p>}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={onClose}>Cancel</Button>
            <Button isPending={state.isLoading} onPress={async () => {
              setError(null);
              try { await update({ id: card.id, action: "limit", dailySpendLimit: takaToPaisa(value).toString() }).unwrap(); toast.success("Limit updated"); onClose(); }
              catch (e) { setError(e instanceof Error && e.message === "Invalid amount" ? "Enter a whole amount" : errorMessage(e)); }
            }}>Save</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
