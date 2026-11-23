import { baseApi } from "./baseApi";
import { qs } from "./qs";
import type { CustomerStats } from "@/types/api";

export const statsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCustomerStats: build.query<CustomerStats, { accountId?: string }>({
      query: (a) => `/stats/customer${qs(a)}`,
      providesTags: ["Stats"],
    }),
  }),
});

export const { useGetCustomerStatsQuery } = statsApi;
