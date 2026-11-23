import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type TransactionFilters = {
  accountId: string; // "" = all accounts
  q: string;
  type: "ALL" | "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "LOAN_DISBURSEMENT" | "LOAN_REPAYMENT" | "CARD_PAYMENT" | "REVERSAL";
  status: "ALL" | "PENDING" | "COMPLETED" | "FAILED" | "REVERSED";
  from: string | null; // ISO date
  to: string | null;
};

type TransactionState = {
  filters: TransactionFilters;
  page: number;
  pageSize: number;
};

const initialState: TransactionState = {
  filters: { accountId: "", q: "", type: "ALL", status: "ALL", from: null, to: null },
  page: 1,
  pageSize: 20,
};

const transactionSlice = createSlice({
  name: "transaction",
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<Partial<TransactionFilters>>) {
      state.filters = { ...state.filters, ...action.payload };
      state.page = 1; // any filter change resets pagination
    },
    resetFilters(state) {
      state.filters = initialState.filters;
      state.page = 1;
    },
    setPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
    },
    setPageSize(state, action: PayloadAction<number>) {
      state.pageSize = action.payload;
      state.page = 1;
    },
  },
  selectors: {
    selectTxnFilters: (s) => s.filters,
    selectTxnPage: (s) => s.page,
    selectTxnPageSize: (s) => s.pageSize,
  },
});

export const { setFilters, resetFilters, setPage, setPageSize } = transactionSlice.actions;
export const { selectTxnFilters, selectTxnPage, selectTxnPageSize } = transactionSlice.selectors;
export default transactionSlice;
