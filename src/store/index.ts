import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { baseApi } from "./api/baseApi";
import authSlice from "./slices/authSlice";
import accountSlice from "./slices/accountSlice";
import transactionSlice from "./slices/transactionSlice";
import loanSlice from "./slices/loanSlice";
import uiSlice from "./slices/uiSlice";
import cardSlice from "./slices/cardSlice";
import { rtkQueryErrorLogger } from "./middleware/rtkQueryErrorLogger";

const rootReducer = combineSlices(baseApi, authSlice, accountSlice, transactionSlice, loanSlice, cardSlice, uiSlice);

export type RootState = ReturnType<typeof rootReducer>;

/**
 * App Router safe: a NEW store per request/tree (created once inside
 * StoreProvider with useRef) — never a module-level singleton shared
 * between users on the server.
 */
export function makeStore(preloadedState?: Partial<RootState>) {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefault) => getDefault().concat(baseApi.middleware, rtkQueryErrorLogger),
    devTools: process.env.NODE_ENV !== "production",
  });
  setupListeners(store.dispatch); // refetchOnFocus / refetchOnReconnect
  return store;
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
