import { baseApi } from "./baseApi";

/** What a two-factor code approves — the same fields the operation itself sends. */
export type OtpRequestBody =
  | {
      purpose: "TRANSFER";
      fromAccountId: string;
      toAccountNumber: string;
      amount: string;
    }
  | { purpose: "PIN_CHANGE"; accountId: string }
  | { purpose: "REVERSAL"; transactionId: string }
  | { purpose: "SETTINGS"; settings: Record<string, unknown> };

export type OtpChallenge = {
  challengeId: string;
  expiresAt: string;
  sentTo: string;
  demoCode?: string;
};
export type OtpProof = { challengeId: string; code: string };

export const securityApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Not cached and no tags: every call emails a fresh code.
    requestOtp: build.mutation<OtpChallenge, OtpRequestBody>({
      query: (body) => ({ url: "/otp", method: "POST", body }),
    }),
  }),
});

export const { useRequestOtpMutation } = securityApi;
