import { createSlice, isFulfilled, isPending, isRejected, type PayloadAction, type UnknownAction } from "@reduxjs/toolkit";

type UiState = {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  /** Number of RTK Query mutations in flight — drives the global top progress bar. */
  pendingMutations: number;
};

const initialState: UiState = {
  sidebarCollapsed: false,
  mobileNavOpen: false,
  pendingMutations: 0,
};

/** RTK Query mutation thunks carry `meta.arg.type === "mutation"`. */
const isMutation = (action: UnknownAction) =>
  (action as { meta?: { arg?: { type?: string } } }).meta?.arg?.type === "mutation";

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setMobileNavOpen(state, action: PayloadAction<boolean>) {
      state.mobileNavOpen = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Centralized loading: count every mutation start/finish.
    builder
      .addMatcher(
        (a) => isPending(a) && isMutation(a),
        (state) => {
          state.pendingMutations += 1;
        },
      )
      .addMatcher(
        (a) => (isFulfilled(a) || isRejected(a)) && isMutation(a),
        (state) => {
          state.pendingMutations = Math.max(0, state.pendingMutations - 1);
        },
      );
  },
  selectors: {
    selectSidebarCollapsed: (s) => s.sidebarCollapsed,
    selectMobileNavOpen: (s) => s.mobileNavOpen,
    selectGlobalLoading: (s) => s.pendingMutations > 0,
  },
});

export const { toggleSidebar, setMobileNavOpen } = uiSlice.actions;
export const { selectSidebarCollapsed, selectMobileNavOpen, selectGlobalLoading } = uiSlice.selectors;
export default uiSlice;
