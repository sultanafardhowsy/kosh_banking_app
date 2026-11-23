/**
 * Shapes returned by the API (after BigInt → string serialization).
 * Money fields are strings of paisa: "125050" = ৳1,250.50.
 */
export type Money = string;

export type Role = "ADMIN" | "STAFF" | "CUSTOMER";
export type UserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";
export type AccountType = "SAVINGS" | "CURRENT" | "BUSINESS";
export type AccountStatus = "ACTIVE" | "FROZEN" | "CLOSED";

export type Me = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  isVerified: boolean;
};

export type AccountSummary = {
  id: string;
  accountNumber: string;
  type: AccountType;
  balance: Money;
  status: AccountStatus;
  nickname: string | null;
  hasPin: boolean;
};

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };

export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "LOAN_DISBURSEMENT" | "LOAN_REPAYMENT" | "CARD_PAYMENT" | "REVERSAL";
export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED";

export type AccountDetail = AccountSummary & {
  createdAt: string;
  pinLocked?: boolean;
  dailyTransferLimit?: Money | null;
  maxSingleTxn?: Money | null;
};

export type StatementEntry = {
  id: string;
  direction: "DEBIT" | "CREDIT";
  amount: Money;
  balanceAfter: Money;
  createdAt: string;
  transaction: { id: string; reference: string; type: TransactionType; description: string | null; status: TransactionStatus; fee: Money };
};
export type Statement = Paginated<StatementEntry> & { account: AccountDetail; totals: { credits: Money; debits: Money } };

export type CustomerTxn = {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: Money;
  fee: Money;
  net: Money;
  direction: "in" | "out" | "internal";
  description: string | null;
  counterparty: string;
  counterpartyAccount: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  reversedTxnId: string | null;
  createdAt: string;
};
export type CustomerTxnDetail = CustomerTxn & {
  ledger: { accountId: string; direction: "DEBIT" | "CREDIT"; amount: Money; balanceAfter: Money }[];
  reversal: { id: string; reference: string } | null;
  reversalOf: { id: string; reference: string } | null;
};
export type TxnQuery = {
  accountId?: string;
  q?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export type TransferPreview = {
  amount: Money;
  fee: Money;
  total: Money;
  balanceAfter: Money;
  remainingDailyLimit: Money;
  /** Two-factor: this amount needs the emailed code. */
  otpRequired: boolean;
  recipient: { name: string; accountNumber: string; type: AccountType };
};
export type TransferBody = { fromAccountId: string; toAccountNumber: string; amount: Money; description?: string; pin: string; idempotencyKey: string; otp?: { challengeId: string; code: string } };
export type TransferResult = {
  replayed: boolean;
  transaction: { id: string; reference: string; amount: Money; fee: Money; status: TransactionStatus; createdAt: string; description: string | null };
  balanceAfter: Money | null;
  recipient: { name: string; accountNumber: string } | null;
};

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type BankRequest = {
  id: string;
  accountId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: Money;
  description: string | null;
  status: RequestStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  transactionId: string | null;
  createdAt: string;
  account: { accountNumber: string; type: AccountType; nickname?: string | null; balance?: Money; status?: AccountStatus };
  requestedBy?: { id: string; name: string; email: string };
  reviewedBy?: { id: string; name: string } | null;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
};

export type LoanType = "PERSONAL" | "HOME" | "AUTO" | "EDUCATION" | "BUSINESS";
export type LoanStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "ACTIVE" | "COMPLETED";
export type EmploymentStatus = "SALARIED" | "SELF_EMPLOYED" | "BUSINESS_OWNER" | "STUDENT" | "UNEMPLOYED" | "RETIRED";
export type Installment = {
  id: string;
  installmentNo: number;
  dueDate: string;
  amountDue: Money;
  principalPart: Money;
  interestPart: Money;
  status: "DUE" | "PAID" | "OVERDUE";
  paidAt: string | null;
  paidTxnId: string | null;
};
export type LoanSummary = {
  id: string;
  loanType: LoanType;
  principal: Money;
  interestRateBps: number;
  durationMonths: number;
  emiAmount: Money | null;
  totalPayable: Money | null;
  remainingBalance: Money;
  status: LoanStatus;
  createdAt: string;
  decidedAt: string | null;
  rejectionReason: string | null;
  account: { id: string; accountNumber: string; type: AccountType; nickname: string | null };
  nextInstallment?: Installment | null;
  paidCount?: number;
};
export type LoanDetail = LoanSummary & {
  monthlyIncome: Money;
  employmentStatus: EmploymentStatus;
  description: string | null;
  installments: Installment[];
  disbursementTxn: { id: string; reference: string; createdAt: string } | null;
};
export type LoanApplyBody = {
  loanType: LoanType;
  accountId: string;
  principal: Money;
  durationMonths: number;
  monthlyIncome: Money;
  employmentStatus: EmploymentStatus;
  description: string;
};
export type ReviewLoanRow = LoanSummary & {
  monthlyIncome: Money;
  user: { id: string; name: string; email: string; isVerified: boolean };
  forwardedBy: { name: string } | null;
  noteCount: number;
  overdueCount: number;
};
export type LoanNote = { id: string; note: string; createdAt: string; author: { id: string; name: string; role: Role } };
export type ReviewLoanDetail = Omit<LoanDetail, "account"> & {
  user: { id: string; name: string; email: string; isVerified: boolean; status: UserStatus; createdAt: string; profile: { phone: string | null } | null };
  account: { id: string; accountNumber: string; type: AccountType; balance: Money; status: AccountStatus; nickname: string | null };
  notes: LoanNote[];
  forwardedBy: { name: string } | null;
  forwardedAt: string | null;
  approvedBy: { name: string } | null;
  otherLoans: { id: string; loanType: LoanType; principal: Money; status: LoanStatus; remainingBalance: Money }[];
  insight: { emi: Money; emiToIncomePct: number | null; inflow90d: Money };
};

// ── Staff / admin management ─────────────────────────
export type CustomerRow = {
  id: string; name: string; email: string; status: UserStatus; isVerified: boolean; createdAt: string;
  profile: { phone: string | null } | null; accountCount: number; totalBalance: Money; frozenCount: number;
};
export type AuditEntry = {
  id: string; action: string; entity: string; entityId: string; metadata: Record<string, unknown> | null; createdAt: string;
  actor: { id?: string; name: string; role: Role };
};
export type CustomerDetail = {
  id: string; name: string; email: string; status: UserStatus; isVerified: boolean; createdAt: string;
  profile: { phone: string | null; address: string | null; nid: string | null; dateOfBirth: string | null; verifiedAt: string | null; verifiedBy: { name: string } | null } | null;
  accounts: (AccountDetail & { dailyTransferLimit: Money | null; maxSingleTxn: Money | null; pinLocked: boolean })[];
  loans: { id: string; loanType: LoanType; principal: Money; status: LoanStatus; remainingBalance: Money; createdAt: string }[];
  recent: { id: string; reference: string; type: TransactionType; amount: Money; fee: Money; status: TransactionStatus; createdAt: string; senderAccountId: string | null; receiverAccountId: string | null; isFlagged: boolean; flagResolvedAt: string | null }[];
  pendingRequests: number;
  audit: AuditEntry[];
};
export type AdminAccountRow = {
  id: string; accountNumber: string; type: AccountType; balance: Money; status: AccountStatus; nickname: string | null; createdAt: string;
  dailyTransferLimit: Money | null; maxSingleTxn: Money | null;
  user: { id: string; name: string; email: string; status: UserStatus };
};
type Party = { id: string; accountNumber: string; user: { id: string; name: string } } | null;
export type BankTxn = {
  id: string; reference: string; type: TransactionType; amount: Money; fee: Money; status: TransactionStatus; description: string | null;
  isFlagged: boolean; flagReason: string | null; flaggedAt: string | null; flagResolvedAt: string | null; createdAt: string;
  senderAccount: Party; receiverAccount: Party; flaggedBy: { name: string } | null; reversal: { id: string; reference: string } | null;
};
export type BankTxnQuery = {
  q?: string; type?: TransactionType; status?: TransactionStatus; flagged?: "open" | "resolved" | "any"; from?: string; to?: string; page: number;
};
export type BankSettings = {
  dailyTransferLimit: Money; maxSingleTransaction: Money; minimumBalance: Money; transferFeeFlat: Money; transferFeePercentBps: number;
  transferFeeMax: Money | null; otpThreshold: Money | null; updatedAt: string; updatedBy: { name: string } | null;
};
export type RegisterCustomerBody = {
  name: string; email: string; phone: string; address: string; nid: string; dateOfBirth: string; openAccount: "NONE" | AccountType;
};

// ── Stats ─────────────────────────
export type AdminStats = {
  kpis: {
    activeCustomers: number; newCustomers30d: number; totalDeposits: Money; accounts: number; txnsToday: number; volumeToday: Money;
    monthVolume: Money; monthVolumeTrend: number; pendingRequests: number; loansAwaiting: number; openFlags: number;
    overdueInstallments: number; loanBook: Money;
  };
  monthly: { month: string; transferVolume: Money; transferCount: number; totalVolume: Money; totalCount: number; deposits: Money; withdrawals: Money; depositCount: number; withdrawalCount: number; loanCount: number }[];
  accountDistribution: { type: AccountType; count: number; balance: Money }[];
  loanStats: { status: LoanStatus; count: number; principal: Money }[];
};
export type StaffOverview = {
  kpis: { pendingRequests: number; loansPending: number; unverified: number; txnsToday: number; openFlags: number };
  requests: { id: string; type: "DEPOSIT" | "WITHDRAWAL"; amount: Money; createdAt: string; requestedBy: { name: string } }[];
  loans: { id: string; loanType: LoanType; principal: Money; createdAt: string; user: { name: string } }[];
  customers: { id: string; name: string; email: string; createdAt: string }[];
};
export type CustomerStats = {
  monthly: { month: string; spending: Money; deposits: Money; income: Money }[];
  distribution: { type: TransactionType; count: number; amount: Money }[];
};

// ── Virtual cards (simulated) ─────────────────────────
export type CardStatus = "REQUESTED" | "ACTIVE" | "FROZEN" | "BLOCKED" | "REJECTED";
export type CardRow = {
  id: string; accountId: string; cardNumberMasked: string; last4: string; cardholderName: string; expiryMonth: number; expiryYear: number;
  network: "VISA" | "MASTERCARD"; status: CardStatus; dailySpendLimit: Money; createdAt: string; spentToday?: Money;
  account: { accountNumber: string; type: AccountType; nickname: string | null; status: AccountStatus };
};
export type CardPayment = { id: string; reference: string; amount: Money; status: TransactionStatus; merchant: string | null; createdAt: string; cardId: string | null };
export type ReviewCardRow = CardRow & { user: { id: string; name: string; email: string; isVerified: boolean }; approvedBy: { name: string } | null };

// ── Email log ─────────────────────────
export type EmailStatus = "SENT" | "FAILED" | "LOGGED";
export type EmailLogRow = {
  id: string; toAddress: string; originalTo: string; subject: string; status: EmailStatus; provider: string; error: string | null;
  notificationType: string | null; createdAt: string; user: { name: string } | null;
};

export type KycProfile = { phone: string | null; address: string | null; nid: string | null; dateOfBirth: string | null; verifiedAt: string | null };
