import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** The account chosen in the account switcher (dashboard, transfer "from", history). */
type AccountState = { selectedAccountId: string | null };

const initialState: AccountState = { selectedAccountId: null };

const accountSlice = createSlice({
  name: "account",
  initialState,
  reducers: {
    selectAccount(state, action: PayloadAction<string | null>) {
      state.selectedAccountId = action.payload;
    },
  },
  selectors: {
    selectSelectedAccountId: (s) => s.selectedAccountId,
  },
});

export const { selectAccount } = accountSlice.actions;
export const { selectSelectedAccountId } = accountSlice.selectors;
export default accountSlice;
