import { baseApi } from "./baseApi";
import { qs } from "./qs";
import type { BankRequest, Paginated, RequestStatus } from "@/types/api";

export const requestsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMyRequests: build.query<Paginated<BankRequest>, { page: number }>({
      query: ({ page }) => `/requests${qs({ page, pageSize: 10 })}`,
      providesTags: [{ type: "Request", id: "MINE" }],
    }),
    createRequest: build.mutation<BankRequest, { accountId: string; type: "DEPOSIT" | "WITHDRAWAL"; amount: string; description?: string }>({
      query: (body) => ({ url: "/requests", method: "POST", body }),
      invalidatesTags: [{ type: "Request", id: "MINE" }, { type: "Request", id: "QUEUE" }],
    }),
    // staff + admin
    getRequestQueue: build.query<Paginated<BankRequest>, { status?: RequestStatus; page: number }>({
      query: ({ status, page }) => `/staff/requests${qs({ status, page, pageSize: 20 })}`,
      providesTags: [{ type: "Request", id: "QUEUE" }],
    }),
    reviewRequest: build.mutation<unknown, { id: string; action: "approve" | "reject"; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/staff/requests/${id}`, method: "PATCH", body }),
      invalidatesTags: [{ type: "Request", id: "QUEUE" }, { type: "Request", id: "MINE" }, "Account", { type: "Transaction", id: "LIST" }, "Stats", "Audit"],
    }),
  }),
});

export const { useGetMyRequestsQuery, useCreateRequestMutation, useGetRequestQueueQuery, useReviewRequestMutation } = requestsApi;
