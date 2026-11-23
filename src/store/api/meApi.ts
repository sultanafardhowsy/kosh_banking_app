import { baseApi } from "./baseApi";
import type { AccountSummary, KycProfile, Me } from "@/types/api";

export type KycInput = { phone: string; address: string; nid: string; dateOfBirth: string };

export const meApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMe: build.query<{ user: Me; accounts: AccountSummary[] }, void>({
      query: () => "/me",
      providesTags: ["Me", { type: "Account", id: "LIST" }],
    }),
    getKycProfile: build.query<{ profile: KycProfile | null; complete: boolean }, void>({
      query: () => "/me/profile",
      providesTags: ["Me"],
    }),
    submitKycProfile: build.mutation<{ profile: KycProfile; complete: boolean }, KycInput>({
      query: (body) => ({ url: "/me/profile", method: "PATCH", body }),
      invalidatesTags: ["Me"],
    }),
  }),
});

export const { useGetMeQuery, useGetKycProfileQuery, useSubmitKycProfileMutation } = meApi;
