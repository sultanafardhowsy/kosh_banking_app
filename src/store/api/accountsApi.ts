import type { OtpProof } from "./securityApi";
import { baseApi } from "./baseApi";
import { qs } from "./qs";
import type { AccountDetail, Statement } from "@/types/api";

export const accountsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAccounts: build.query<AccountDetail[], void>({
      query: () => "/accounts",
      providesTags: (r) => [{ type: "Account", id: "LIST" }, ...(r ?? []).map((a) => ({ type: "Account" as const, id: a.id }))],
    }),
    getStatement: build.query<Statement, { id: string; page: number; pageSize?: number }>({
      query: ({ id, page, pageSize = 20 }) => `/accounts/${id}${qs({ page, pageSize })}`,
      providesTags: (_r, _e, a) => [{ type: "Account", id: a.id }, { type: "Transaction", id: "LIST" }],
    }),
    setPin: build.mutation<{ ok: boolean }, { accountId: string; currentPin?: string; newPin: string; confirmPin: string; otp?: OtpProof }>({
      query: ({ accountId, ...body }) => ({ url: `/accounts/${accountId}/pin`, method: "POST", body }),
      invalidatesTags: (_r, _e, a) => [{ type: "Account", id: a.accountId }, { type: "Account", id: "LIST" }, "Me", "Notification"],
    }),
  }),
});

export const { useGetAccountsQuery, useGetStatementQuery, useSetPinMutation } = accountsApi;
