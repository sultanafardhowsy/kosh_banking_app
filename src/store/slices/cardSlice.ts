import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** Selected card + whether its details (holder, expiry) are revealed on screen. The full number never exists client-side. */
type CardState = { selectedCardId: string | null; revealed: boolean };

const cardSlice = createSlice({
  name: "card",
  initialState: { selectedCardId: null, revealed: false } as CardState,
  reducers: {
    selectCard(state, action: PayloadAction<string | null>) {
      state.selectedCardId = action.payload;
      state.revealed = false;
    },
    toggleReveal(state) {
      state.revealed = !state.revealed;
    },
  },
  selectors: {
    selectSelectedCardId: (s) => s.selectedCardId,
    selectCardRevealed: (s) => s.revealed,
  },
});

export const { selectCard, toggleReveal } = cardSlice.actions;
export const { selectSelectedCardId, selectCardRevealed } = cardSlice.selectors;
export default cardSlice;
