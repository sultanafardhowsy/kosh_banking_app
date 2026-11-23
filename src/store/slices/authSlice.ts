import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Me } from "@/types/api";

/** Hydrated from the server session in the role layout (see StoreProvider). */
type AuthState = { user: Me | null };

const initialState: AuthState = { user: null };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<Me | null>) {
      state.user = action.payload;
    },
    clearUser(state) {
      state.user = null;
    },
  },
  selectors: {
    selectUser: (s) => s.user,
    selectRole: (s) => s.user?.role ?? null,
  },
});

export const { setUser, clearUser } = authSlice.actions;
export const { selectUser, selectRole } = authSlice.selectors;
export default authSlice;
