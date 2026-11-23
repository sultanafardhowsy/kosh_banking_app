import { baseApi } from "./baseApi";
import { qs } from "./qs";
import type { CustomerTxn, CustomerTxnDetail, Paginated, TransferBody, TransferPreview, TransferResult, TxnQuery } from "@/types/api";

export const transactionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTransactions: build.query<Paginated<CustomerTxn>, TxnQuery>({
      query: (q) => `/transactions${qs(q)}`,
      providesTags: (r) => [{ type: "Transaction", id: "LIST" }, ...(r?.items ?? []).map((t) => ({ type: "Transaction" as const, id: t.id }))],
    }),
    getTransaction: build.query<CustomerTxnDetail, string>({
      query: (id) => `/transactions/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Transaction", id }],
    }),
    previewTransfer: build.mutation<TransferPreview, Pick<TransferBody, "fromAccountId" | "toAccountNumber" | "amount">>({
      query: (body) => ({ url: "/transfers/preview", method: "POST", body }),
    }),
    transfer: build.mutation<TransferResult, TransferBody>({
      query: (body) => ({ url: "/transfers", method: "POST", body }),
      // A transfer changes balances, history, charts and notifications.
      invalidatesTags: ["Me", { type: "Account", id: "LIST" }, "Account", { type: "Transaction", id: "LIST" }, "Stats", "Notification"],
    }),
  }),
});

export const { useGetTransactionsQuery, useGetTransactionQuery, usePreviewTransferMutation, useTransferMutation } = transactionsApi;
