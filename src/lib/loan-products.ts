/**
 * Loan products. The rate is decided by the bank (here), never sent by the client.
 * Amounts in taka for readability; converted to paisa where used.
 */
export const LOAN_PRODUCTS = {
  PERSONAL: { label: "Personal", rateBps: 1200, minTaka: 10_000, maxTaka: 1_000_000, minMonths: 6, maxMonths: 36 },
  HOME: { label: "Home", rateBps: 950, minTaka: 200_000, maxTaka: 5_000_000, minMonths: 12, maxMonths: 60 },
  AUTO: { label: "Auto", rateBps: 1100, minTaka: 100_000, maxTaka: 3_000_000, minMonths: 12, maxMonths: 60 },
  EDUCATION: { label: "Education", rateBps: 800, minTaka: 10_000, maxTaka: 1_500_000, minMonths: 6, maxMonths: 48 },
  BUSINESS: { label: "Business", rateBps: 1350, minTaka: 50_000, maxTaka: 5_000_000, minMonths: 6, maxMonths: 60 },
} as const;

export type LoanProductKey = keyof typeof LOAN_PRODUCTS;

export const EMPLOYMENT_LABELS = {
  SALARIED: "Salaried",
  SELF_EMPLOYED: "Self-employed",
  BUSINESS_OWNER: "Business owner",
  STUDENT: "Student",
  UNEMPLOYED: "Unemployed",
  RETIRED: "Retired",
} as const;

/** Affordability guide shown to staff: EMI as a share of monthly income. */
export const MAX_EMI_TO_INCOME_PCT = 50;
