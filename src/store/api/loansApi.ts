import { baseApi } from "./baseApi";
import { qs } from "./qs";
import type { LoanApplyBody, LoanDetail, LoanNote, LoanStatus, LoanSummary, Paginated, ReviewLoanDetail, ReviewLoanRow } from "@/types/api";

export const loansApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // customer
    getMyLoans: build.query<LoanSummary[], void>({
      query: () => "/loans",
      providesTags: [{ type: "Loan", id: "MINE" }],
    }),
    getMyLoan: build.query<LoanDetail, string>({
      query: (id) => `/loans/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Loan", id }],
    }),
    applyLoan: build.mutation<LoanSummary, LoanApplyBody>({
      query: (body) => ({ url: "/loans", method: "POST", body }),
      invalidatesTags: [{ type: "Loan", id: "MINE" }, { type: "Loan", id: "QUEUE" }, "Notification"],
    }),
    repayLoan: build.mutation<{ replayed: boolean; completed?: boolean }, { id: string; pin: string; idempotencyKey: string }>({
      query: ({ id, ...body }) => ({ url: `/loans/${id}/repay`, method: "POST", body }),
      invalidatesTags: (_r, _e, a) => [{ type: "Loan", id: a.id }, { type: "Loan", id: "MINE" }, "Me", "Account", { type: "Transaction", id: "LIST" }, "Stats", "Notification"],
    }),
    // staff + admin
    getLoanQueue: build.query<Paginated<ReviewLoanRow> & { counts: Partial<Record<LoanStatus, number>> }, { status?: LoanStatus; page: number }>({
      query: ({ status, page }) => `/staff/loans${qs({ status, page, pageSize: 20 })}`,
      providesTags: [{ type: "Loan", id: "QUEUE" }],
    }),
    getLoanReview: build.query<ReviewLoanDetail, string>({
      query: (id) => `/staff/loans/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Loan", id: `REVIEW-${id}` }],
    }),
    addLoanNote: build.mutation<LoanNote, { id: string; note: string }>({
      query: ({ id, note }) => ({ url: `/staff/loans/${id}/notes`, method: "POST", body: { note } }),
      invalidatesTags: (_r, _e, a) => [{ type: "Loan", id: `REVIEW-${a.id}` }, { type: "Loan", id: "QUEUE" }],
    }),
    forwardLoan: build.mutation<unknown, string>({
      query: (id) => ({ url: `/staff/loans/${id}/forward`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [{ type: "Loan", id: `REVIEW-${id}` }, { type: "Loan", id: "QUEUE" }, "Audit"],
    }),
    decideLoan: build.mutation<unknown, { id: string; action: "approve" } | { id: string; action: "reject"; reason: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/loans/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, a) => [{ type: "Loan", id: `REVIEW-${a.id}` }, { type: "Loan", id: "QUEUE" }, "Account", { type: "Transaction", id: "LIST" }, "Stats", "Audit"],
    }),
  }),
});

export const {
  useGetMyLoansQuery, useGetMyLoanQuery, useApplyLoanMutation, useRepayLoanMutation,
  useGetLoanQueueQuery, useGetLoanReviewQuery, useAddLoanNoteMutation, useForwardLoanMutation, useDecideLoanMutation,
} = loansApi;
