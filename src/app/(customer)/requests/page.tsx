"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, Button, toast } from "@heroui/react";
import { useGetMeQuery } from "@/store/api/meApi";
import { useCreateRequestMutation, useGetMyRequestsQuery } from "@/store/api/requestsApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { FormTextField } from "@/components/ui/FormTextField";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Segmented } from "@/components/ui/Segmented";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Money } from "@/components/ui/Money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { errorMessage } from "@/lib/client";
import { formatMoney, takaToPaisa } from "@/lib/money";
import { formatDateTime, maskAccountNumber, titleCase } from "@/lib/format";
import type { BankRequest } from "@/types/api";

const schema = z.object({
  accountId: z.string().min(1, "Choose an account"),
  amount: z.string().refine((v) => {
    try {
      return takaToPaisa(v) > BigInt(0);
    } catch {
      return false;
    }
  }, "Enter an amount like 5000"),
  description: z.string().max(200),
});
type Form = z.infer<typeof schema>;

const columns: Column<BankRequest>[] = [
  { key: "type", header: "Type", cell: (r) => <span className="font-medium">{titleCase(r.type)}</span> },
  { key: "acc", header: "Account", cell: (r) => <span className="amount text-kosh-muted">{maskAccountNumber(r.account.accountNumber)}</span> },
  { key: "amount", header: "Amount", align: "right", cell: (r) => <Money value={r.amount} direction={r.type === "DEPOSIT" ? "in" : "out"} className="font-semibold" /> },
  { key: "date", header: "Requested", cell: (r) => <span className="text-kosh-muted">{formatDateTime(r.createdAt)}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "note", header: "Bank note", hideOnMobile: true, cell: (r) => <span className="text-xs text-kosh-muted">{r.reviewNote ?? (r.status === "PENDING" ? "Waiting for staff review" : "—")}</span> },
];

function RequestsInner() {
  const params = useSearchParams();
  const [type, setType] = useState<"DEPOSIT" | "WITHDRAWAL">(params.get("type") === "WITHDRAWAL" ? "WITHDRAWAL" : "DEPOSIT");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const { data: me } = useGetMeQuery();
  const { data, isLoading } = useGetMyRequestsQuery({ page });
  const [create, state] = useCreateRequestMutation();
  const accounts = (me?.accounts ?? []).filter((a) => a.status === "ACTIVE");

  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { accountId: "", amount: "", description: "" } });
  const firstId = accounts[0]?.id;
  useEffect(() => {
    if (firstId && !form.getValues("accountId")) form.setValue("accountId", firstId);
  }, [firstId, form]);

  async function onSubmit(v: Form) {
    setError(null);
    try {
      await create({ accountId: v.accountId, type, amount: takaToPaisa(v.amount).toString(), description: v.description }).unwrap();
      toast.success(`${titleCase(type)} request sent`, { description: "A staff member will review it shortly." });
      form.reset({ accountId: v.accountId, amount: "", description: "" });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader title="Deposit & withdraw" description="Requests are reviewed by Kosh staff. Money moves only when a request is approved." />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Panel className="h-fit p-5">
          <Segmented
            ariaLabel="Request type"
            value={type}
            onChange={setType}
            options={[{ value: "DEPOSIT", label: "Deposit" }, { value: "WITHDRAWAL", label: "Withdraw" }]}
            className="w-full [&>button]:flex-1 [&>button]:justify-center"
          />
          {error && (
            <Alert status="danger" className="mt-4">
              <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
            </Alert>
          )}
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
            <NativeSelect
              label="Account"
              {...form.register("accountId")}
              error={form.formState.errors.accountId?.message}
              options={accounts.map((a) => ({ value: a.id, label: `${a.nickname ?? titleCase(a.type)} ${maskAccountNumber(a.accountNumber)} — ${formatMoney(a.balance)}` }))}
            />
            <FormTextField control={form.control} name="amount" label="Amount (৳)" inputMode="decimal" placeholder="0.00" />
            <FormTextField control={form.control} name="description" label="Note (optional)" placeholder={type === "DEPOSIT" ? "e.g. Salary cash" : "e.g. Travel cash"} />
            <p className="text-xs text-kosh-muted">
              {type === "WITHDRAWAL" ? "Withdrawals must leave the minimum balance (৳500). The balance is checked again at approval." : "Bring the cash to any branch; staff confirm and approve it."}
            </p>
            <Button type="submit" fullWidth isPending={state.isLoading} isDisabled={!accounts.length}>
              Send {type === "DEPOSIT" ? "deposit" : "withdrawal"} request
            </Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="Your requests" description="Most recent first." />
          <div className="mt-3">
            <DataTable
              columns={columns}
              rows={data?.items}
              rowKey={(r) => r.id}
              isLoading={isLoading}
              emptyTitle="No requests yet"
              page={page}
              pageCount={data ? Math.ceil(data.total / data.pageSize) : undefined}
              onPageChange={setPage}
            />
          </div>
        </Panel>
      </div>
    </>
  );
}

export default function RequestsPage() {
  return (
    <Suspense>
      <RequestsInner />
    </Suspense>
  );
}
