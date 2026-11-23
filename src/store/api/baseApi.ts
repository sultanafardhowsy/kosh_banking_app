import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const TAG_TYPES = [
  "Me",
  "Account",
  "Transaction",
  "Loan",
  "Request",
  "Stats",
  "Notification",
  "Customer",
  "Settings",
  "Card",
  "Audit",
] as const;

/**
 * One API slice for the whole app. Each feature adds its endpoints with
 * `baseApi.injectEndpoints(...)` in its own file (accountsApi, transactionsApi, ...).
 * Amounts come back as strings (BigInt-safe) — format with `formatMoney`.
 */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    credentials: "same-origin",
  }),
  tagTypes: TAG_TYPES,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: () => ({}),
});
