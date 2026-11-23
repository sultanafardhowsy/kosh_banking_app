import type { OtpProof } from "./securityApi";
import { baseApi } from "./baseApi";
import { qs } from "./qs";
import type { AdminStats, AuditEntry, EmailLogRow, EmailStatus, BankSettings, BankTxn, Paginated, Role, UserStatus } from "@/types/api";

type AccountAction =
  | { action: "freeze" | "unfreeze" | "close"; reason: string }
  | { action: "limits"; dailyTransferLimit: string | null; maxSingleTxn: string | null };

export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAdminStats: build.query<AdminStats, void>({
      query: () => "/admin/stats",
      providesTags: ["Stats"],
    }),
    setUserStatus: build.mutation<unknown, { id: string; status: UserStatus; reason: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/customers/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, a) => [{ type: "Customer", id: a.id }, { type: "Customer", id: "LIST" }, "Stats", "Audit"],
    }),
    updateAccount: build.mutation<unknown, { id: string; customerId?: string } & AccountAction>({
      query: ({ id, ...rest }) => {
        const { customerId, ...body } = rest;
        void customerId; // only used for cache invalidation
        return { url: `/admin/accounts/${id}`, method: "PATCH", body };
      },
      invalidatesTags: (_r, _e, a) => ["Account", ...(a.customerId ? [{ type: "Customer" as const, id: a.customerId }] : []), "Stats", "Audit"],
    }),
    getSettings: build.query<BankSettings, void>({
      query: () => "/admin/settings",
      providesTags: ["Settings"],
    }),
    updateSettings: build.mutation<unknown, Omit<BankSettings, "updatedAt" | "updatedBy"> & { otp?: OtpProof }>({
      query: (body) => ({ url: "/admin/settings", method: "PUT", body }),
      invalidatesTags: ["Settings", "Audit"],
    }),
    getFlagged: build.query<Paginated<BankTxn>, { state: "open" | "resolved"; page: number }>({
      query: (a) => `/admin/flagged${qs(a)}`,
      providesTags: [{ type: "Transaction", id: "FLAGGED" }],
    }),
    resolveFlag: build.mutation<unknown, { id: string; note: string }>({
      query: ({ id, note }) => ({ url: `/admin/flagged/${id}`, method: "PATCH", body: { note } }),
      invalidatesTags: [{ type: "Transaction", id: "FLAGGED" }, { type: "Transaction", id: "LIST" }, "Stats", "Audit"],
    }),
    reverseTransaction: build.mutation<unknown, { id: string; reason: string; otp?: OtpProof }>({
      query: ({ id, reason, otp }) => ({ url: `/admin/transactions/${id}/reverse`, method: "POST", body: { reason, otp } }),
      invalidatesTags: [{ type: "Transaction", id: "FLAGGED" }, { type: "Transaction", id: "LIST" }, "Account", "Customer", "Stats", "Audit"],
    }),
    getEmailLog: build.query<
      Paginated<EmailLogRow> & { counts: Partial<Record<EmailStatus, number>>; config: { provider: "smtp" | "resend" | "log"; from: string; redirectTo: string | null } },
      { status?: EmailStatus; page: number }
    >({
      query: (a) => `/admin/emails${qs(a)}`,
      providesTags: ["Audit"],
    }),
    getEmail: build.query<EmailLogRow & { html: string }, string>({
      query: (id) => `/admin/emails/${id}`,
    }),
    getAudit: build.query<Paginated<AuditEntry> & { actors: { id: string; name: string; role: Role }[] }, { entity?: string; action?: string; actorId?: string; q?: string; page: number }>({
      query: (a) => `/admin/audit${qs(a)}`,
      providesTags: ["Audit"],
    }),
  }),
});

export const {
  useGetAdminStatsQuery, useSetUserStatusMutation, useUpdateAccountMutation, useGetSettingsQuery, useUpdateSettingsMutation,
  useGetFlaggedQuery, useResolveFlagMutation, useReverseTransactionMutation, useGetAuditQuery, useGetEmailLogQuery, useGetEmailQuery,
} = adminApi;
