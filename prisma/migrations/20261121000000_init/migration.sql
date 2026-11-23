-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('SAVINGS', 'CURRENT', 'BUSINESS');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'LOAN_DISBURSEMENT', 'LOAN_REPAYMENT', 'CARD_PAYMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('PERSONAL', 'HOME', 'AUTO', 'EDUCATION', 'BUSINESS');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('SALARIED', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'STUDENT', 'UNEMPLOYED', 'RETIRED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('DUE', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "CardNetwork" AS ENUM ('VISA', 'MASTERCARD');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'FROZEN', 'BLOCKED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TRANSFER_SENT', 'TRANSFER_RECEIVED', 'REQUEST_APPROVED', 'REQUEST_REJECTED', 'LOAN_UPDATE', 'LOAN_APPROVED', 'LOAN_REJECTED', 'INSTALLMENT_DUE', 'ACCOUNT_UPDATE', 'CARD_UPDATE', 'SECURITY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('PIN_FAILED', 'PIN_LOCKED', 'PIN_CHANGED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "nid" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "nickname" TEXT,
    "transactionPinHash" TEXT,
    "pinAttempts" INTEGER NOT NULL DEFAULT 0,
    "pinLockedUntil" TIMESTAMP(3),
    "dailyTransferLimit" BIGINT,
    "maxSingleTxn" BIGINT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "fee" BIGINT NOT NULL DEFAULT 0,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "senderAccountId" TEXT,
    "receiverAccountId" TEXT,
    "description" TEXT,
    "idempotencyKey" TEXT,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "flaggedById" TEXT,
    "flaggedAt" TIMESTAMP(3),
    "flagResolvedAt" TIMESTAMP(3),
    "reversedTxnId" TEXT,
    "cardId" TEXT,
    "merchant" TEXT,
    "initiatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_withdrawal_requests" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "loanType" "LoanType" NOT NULL,
    "principal" BIGINT NOT NULL,
    "interestRateBps" INTEGER NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "emiAmount" BIGINT,
    "totalPayable" BIGINT,
    "monthlyIncome" BIGINT NOT NULL,
    "employmentStatus" "EmploymentStatus" NOT NULL,
    "description" TEXT,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "remainingBalance" BIGINT NOT NULL DEFAULT 0,
    "forwardedById" TEXT,
    "forwardedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "disbursementTxnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_installments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountDue" BIGINT NOT NULL,
    "principalPart" BIGINT NOT NULL,
    "interestPart" BIGINT NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'DUE',
    "paidTxnId" TEXT,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "loan_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_notes" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "dailyTransferLimit" BIGINT NOT NULL,
    "maxSingleTransaction" BIGINT NOT NULL,
    "minimumBalance" BIGINT NOT NULL,
    "transferFeeFlat" BIGINT NOT NULL,
    "transferFeePercentBps" INTEGER NOT NULL,
    "transferFeeMax" BIGINT,
    "otpThreshold" BIGINT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "type" "SecurityEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardNumberMasked" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "cardholderName" TEXT NOT NULL,
    "expiryMonth" INTEGER NOT NULL,
    "expiryYear" INTEGER NOT NULL,
    "network" "CardNetwork" NOT NULL DEFAULT 'VISA',
    "status" "CardStatus" NOT NULL DEFAULT 'REQUESTED',
    "dailySpendLimit" BIGINT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "auth_accounts_userId_idx" ON "auth_accounts"("userId");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_userId_key" ON "customer_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_accountNumber_key" ON "accounts"("accountNumber");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "accounts_status_idx" ON "accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotencyKey_key" ON "transactions"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reversedTxnId_key" ON "transactions"("reversedTxnId");

-- CreateIndex
CREATE INDEX "transactions_senderAccountId_createdAt_idx" ON "transactions"("senderAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_receiverAccountId_createdAt_idx" ON "transactions"("receiverAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_type_status_idx" ON "transactions"("type", "status");

-- CreateIndex
CREATE INDEX "transactions_isFlagged_idx" ON "transactions"("isFlagged");

-- CreateIndex
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");

-- CreateIndex
CREATE INDEX "ledger_entries_accountId_createdAt_idx" ON "ledger_entries"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_entries_transactionId_idx" ON "ledger_entries"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_withdrawal_requests_transactionId_key" ON "deposit_withdrawal_requests"("transactionId");

-- CreateIndex
CREATE INDEX "deposit_withdrawal_requests_status_createdAt_idx" ON "deposit_withdrawal_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "deposit_withdrawal_requests_accountId_idx" ON "deposit_withdrawal_requests"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "loans_disbursementTxnId_key" ON "loans"("disbursementTxnId");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE INDEX "loans_userId_idx" ON "loans"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_installments_paidTxnId_key" ON "loan_installments"("paidTxnId");

-- CreateIndex
CREATE INDEX "loan_installments_status_dueDate_idx" ON "loan_installments"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "loan_installments_loanId_installmentNo_key" ON "loan_installments"("loanId", "installmentNo");

-- CreateIndex
CREATE INDEX "loan_notes_loanId_idx" ON "loan_notes"("loanId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "security_events_accountId_type_createdAt_idx" ON "security_events"("accountId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "cards_userId_idx" ON "cards"("userId");

-- CreateIndex
CREATE INDEX "cards_status_idx" ON "cards"("status");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_senderAccountId_fkey" FOREIGN KEY ("senderAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receiverAccountId_fkey" FOREIGN KEY ("receiverAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reversedTxnId_fkey" FOREIGN KEY ("reversedTxnId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_withdrawal_requests" ADD CONSTRAINT "deposit_withdrawal_requests_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_withdrawal_requests" ADD CONSTRAINT "deposit_withdrawal_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_withdrawal_requests" ADD CONSTRAINT "deposit_withdrawal_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_withdrawal_requests" ADD CONSTRAINT "deposit_withdrawal_requests_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_forwardedById_fkey" FOREIGN KEY ("forwardedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_disbursementTxnId_fkey" FOREIGN KEY ("disbursementTxnId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_paidTxnId_fkey" FOREIGN KEY ("paidTxnId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_notes" ADD CONSTRAINT "loan_notes_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_notes" ADD CONSTRAINT "loan_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_settings" ADD CONSTRAINT "bank_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

