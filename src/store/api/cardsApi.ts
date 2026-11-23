import { baseApi } from "./baseApi";
import { qs } from "./qs";
import type { CardRow, CardPayment, CardStatus, Paginated, ReviewCardRow } from "@/types/api";

export const cardsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMyCards: build.query<{ cards: CardRow[]; payments: CardPayment[] }, void>({
      query: () => "/cards",
      providesTags: [{ type: "Card", id: "MINE" }],
    }),
    requestCard: build.mutation<CardRow, { accountId: string; network: "VISA" | "MASTERCARD" }>({
      query: (body) => ({ url: "/cards", method: "POST", body }),
      invalidatesTags: [{ type: "Card", id: "MINE" }, { type: "Card", id: "QUEUE" }],
    }),
    updateCard: build.mutation<CardRow, { id: string; action: "freeze" | "unfreeze" } | { id: string; action: "limit"; dailySpendLimit: string }>({
      query: ({ id, ...body }) => ({ url: `/cards/${id}`, method: "PATCH", body }),
      invalidatesTags: [{ type: "Card", id: "MINE" }, { type: "Card", id: "QUEUE" }],
    }),
    payWithCard: build.mutation<{ replayed: boolean }, { id: string; merchant: string; amount: string; pin: string; idempotencyKey: string }>({
      query: ({ id, ...body }) => ({ url: `/cards/${id}/pay`, method: "POST", body }),
      // a card payment moves money: cards, balances, history, charts, notifications
      invalidatesTags: [{ type: "Card", id: "MINE" }, "Me", "Account", { type: "Transaction", id: "LIST" }, "Stats", "Notification"],
    }),
    // staff + admin
    getCardQueue: build.query<Paginated<ReviewCardRow> & { counts: Partial<Record<CardStatus, number>> }, { status?: CardStatus; page: number }>({
      query: (a) => `/staff/cards${qs(a)}`,
      providesTags: [{ type: "Card", id: "QUEUE" }],
    }),
    reviewCard: build.mutation<unknown, { id: string; action: "approve" | "freeze" | "unfreeze" } | { id: string; action: "reject"; reason: string }>({
      query: ({ id, ...body }) => ({ url: `/staff/cards/${id}`, method: "PATCH", body }),
      invalidatesTags: [{ type: "Card", id: "QUEUE" }, { type: "Card", id: "MINE" }, "Audit"],
    }),
    blockCard: build.mutation<unknown, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/admin/cards/${id}/block`, method: "PATCH", body: { reason } }),
      invalidatesTags: [{ type: "Card", id: "QUEUE" }, { type: "Card", id: "MINE" }, "Audit"],
    }),
  }),
});

export const {
  useGetMyCardsQuery, useRequestCardMutation, useUpdateCardMutation, usePayWithCardMutation,
  useGetCardQueueQuery, useReviewCardMutation, useBlockCardMutation,
} = cardsApi;
