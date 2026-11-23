import { baseApi } from "./baseApi";
import { qs } from "./qs";
import type { AdminAccountRow, BankTxn, BankTxnQuery, CustomerDetail, CustomerRow, Paginated, RegisterCustomerBody, StaffOverview, AccountType, AccountStatus, UserStatus } from "@/types/api";

export const staffApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStaffOverview: build.query<StaffOverview, void>({
      query: () => "/staff/overview",
      providesTags: ["Stats", { type: "Request", id: "QUEUE" }, { type: "Loan", id: "QUEUE" }, { type: "Customer", id: "LIST" }],
    }),
    getCustomers: build.query<Paginated<CustomerRow>, { q?: string; status?: UserStatus; verified?: boolean; page: number }>({
      query: ({ verified, ...rest }) => `/staff/customers${qs({ ...rest, verified: verified === undefined ? undefined : String(verified) })}`,
      providesTags: [{ type: "Customer", id: "LIST" }],
    }),
    getCustomer: build.query<CustomerDetail, string>({
      query: (id) => `/staff/customers/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Customer", id }],
    }),
    registerCustomer: build.mutation<{ customer: { id: string; name: string; email: string }; account: { accountNumber: string } | null; temporaryPassword: string }, RegisterCustomerBody>({
      query: (body) => ({ url: "/staff/customers", method: "POST", body }),
      invalidatesTags: [{ type: "Customer", id: "LIST" }, "Stats", "Audit", "Account"],
    }),
    verifyCustomer: build.mutation<unknown, string>({
      query: (id) => ({ url: `/staff/customers/${id}/verify`, method: "PATCH" }),
      invalidatesTags: (_r, _e, id) => [{ type: "Customer", id }, { type: "Customer", id: "LIST" }, "Stats", "Audit"],
    }),
    openAccount: build.mutation<{ id: string; accountNumber: string }, { userId: string; type: AccountType; nickname?: string }>({
      query: (body) => ({ url: "/staff/accounts", method: "POST", body }),
      invalidatesTags: (_r, _e, a) => [{ type: "Customer", id: a.userId }, { type: "Customer", id: "LIST" }, "Account", "Stats", "Audit"],
    }),
    getAllAccounts: build.query<Paginated<AdminAccountRow>, { q?: string; status?: AccountStatus; type?: AccountType; page: number }>({
      query: (a) => `/staff/accounts${qs(a)}`,
      providesTags: ["Account"],
    }),
    getAllTransactions: build.query<Paginated<BankTxn>, BankTxnQuery>({
      query: (a) => `/staff/transactions${qs(a)}`,
      providesTags: [{ type: "Transaction", id: "LIST" }],
    }),
    flagTransaction: build.mutation<unknown, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/staff/transactions/${id}/flag`, method: "POST", body: { reason } }),
      invalidatesTags: [{ type: "Transaction", id: "LIST" }, "Stats", "Audit"],
    }),
  }),
});

export const {
  useGetStaffOverviewQuery, useGetCustomersQuery, useGetCustomerQuery, useRegisterCustomerMutation, useVerifyCustomerMutation,
  useOpenAccountMutation, useGetAllAccountsQuery, useGetAllTransactionsQuery, useFlagTransactionMutation,
} = staffApi;
