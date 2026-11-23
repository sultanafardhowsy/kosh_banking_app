import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** Multi-step loan application wizard + currently opened loan. */
export type LoanDraft = {
  loanType: "PERSONAL" | "HOME" | "AUTO" | "EDUCATION" | "BUSINESS";
  accountId: string;
  amount: string; // taka as typed; converted to paisa on submit
  durationMonths: number;
  monthlyIncome: string;
  employmentStatus: "SALARIED" | "SELF_EMPLOYED" | "BUSINESS_OWNER" | "STUDENT" | "UNEMPLOYED" | "RETIRED";
  description: string;
};

type LoanState = {
  wizardStep: number;
  draft: Partial<LoanDraft>;
  selectedLoanId: string | null;
};

const initialState: LoanState = { wizardStep: 0, draft: {}, selectedLoanId: null };

const loanSlice = createSlice({
  name: "loan",
  initialState,
  reducers: {
    updateDraft(state, action: PayloadAction<Partial<LoanDraft>>) {
      state.draft = { ...state.draft, ...action.payload };
    },
    setWizardStep(state, action: PayloadAction<number>) {
      state.wizardStep = action.payload;
    },
    resetWizard(state) {
      state.wizardStep = 0;
      state.draft = {};
    },
    selectLoan(state, action: PayloadAction<string | null>) {
      state.selectedLoanId = action.payload;
    },
  },
  selectors: {
    selectLoanDraft: (s) => s.draft,
    selectWizardStep: (s) => s.wizardStep,
    selectSelectedLoanId: (s) => s.selectedLoanId,
  },
});

export const { updateDraft, setWizardStep, resetWizard, selectLoan } = loanSlice.actions;
export const { selectLoanDraft, selectWizardStep, selectSelectedLoanId } = loanSlice.selectors;
export default loanSlice;
