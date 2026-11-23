import { baseApi } from "./baseApi";
import { qs } from "./qs";
import type { AppNotification, Paginated } from "@/types/api";

type NotificationPage = Paginated<AppNotification> & { unread: number };

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getNotifications: build.query<NotificationPage, { page: number; unread?: boolean }>({
      query: ({ page, unread }) => `/notifications${qs({ page, pageSize: 20, unread: unread ? "1" : undefined })}`,
      providesTags: ["Notification"],
    }),
    markNotificationRead: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/notifications/${id}`, method: "PATCH" }),
      // optimistic: flip isRead + decrement unread in every cached page
      async onQueryStarted(id, { dispatch, queryFulfilled, getState }) {
        const patches = notificationsApi.util
          .selectInvalidatedBy(getState(), ["Notification"])
          .filter((q) => q.endpointName === "getNotifications")
          .map((q) =>
            dispatch(
              notificationsApi.util.updateQueryData("getNotifications", q.originalArgs as { page: number; unread?: boolean }, (draft) => {
                const n = draft.items.find((x) => x.id === id);
                if (n && !n.isRead) {
                  n.isRead = true;
                  draft.unread = Math.max(0, draft.unread - 1);
                }
              }),
            ),
          );
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
    }),
    getPreferences: build.query<{ emailNotifications: boolean; email: string; emailProvider: "smtp" | "resend" | "log" }, void>({
      query: () => "/me/preferences",
      providesTags: ["Me"],
    }),
    updatePreferences: build.mutation<{ emailNotifications: boolean }, { emailNotifications: boolean }>({
      query: (body) => ({ url: "/me/preferences", method: "PATCH", body }),
      invalidatesTags: ["Me"],
    }),
    markAllRead: build.mutation<{ updated: number }, void>({
      query: () => ({ url: "/notifications/read-all", method: "POST" }),
      invalidatesTags: ["Notification"],
    }),
  }),
});

export const {
  useGetNotificationsQuery, useMarkNotificationReadMutation, useMarkAllReadMutation, useGetPreferencesQuery, useUpdatePreferencesMutation,
} = notificationsApi;
