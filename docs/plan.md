# Digital Banking Management System — Build Plan

> Next.js (App Router) · TypeScript · Redux Toolkit + RTK Query · Prisma + PostgreSQL · Tailwind/HeroUI · Recharts
> Rule #1: correct, atomic, server-enforced banking logic first — UI second.

---

## 1. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 App Router + TypeScript | Route Handlers (`app/api/*`) = backend; single Vercel deploy |
| Database | PostgreSQL (Neon) + Prisma | Real ACID transactions, row locks, relational integrity |
| Auth | Better Auth (credentials + `role`) — or Auth.js v5 if literal NextAuth compliance is preferred | Server-side session checks |
| Global state | Redux Toolkit (slices) | Mandatory |
| Server data | RTK Query (`injectEndpoints`, tags) | Caching, invalidation, sync |
| UI | Tailwind CSS + HeroUI v3, `next-themes` | Design system + dark mode |
| Charts | Recharts | |
| Validation | Zod (shared client + server schemas) | |
| Forms | React Hook Form + `@hookform/resolvers/zod` | |
| PDF | `@react-pdf/renderer` (server-side) | Receipts & statements |
| Hashing | `bcryptjs` | Passwords & transaction PINs |
| Testing | Vitest | Transfer-logic tests |

**Money rule:** store all amounts as integers in minor units (paisa/cents) — `BigInt`/`Int`. Never floats. Format only in the UI.

---

## 2. Database Schema (Prisma models)

### User
`id, name, email (unique), passwordHash, role (ADMIN | STAFF | CUSTOMER), status (ACTIVE | INACTIVE | BLOCKED), isVerified, createdAt, updatedAt`

### CustomerProfile
`userId (unique), phone, address, nid (fake), dateOfBirth, verifiedById?, verifiedAt?`

### Account
`id, accountNumber (unique, generated), userId, type (SAVINGS | CURRENT | BUSINESS), balance, status (ACTIVE | FROZEN | CLOSED), transactionPinHash, pinAttempts, pinLockedUntil?, dailyTransferLimit?, maxSingleTxn?, createdById, createdAt`

### Transaction
`id, reference (unique, e.g. TXN-20261121-8F3K2A), type (DEPOSIT | WITHDRAWAL | TRANSFER | LOAN_DISBURSEMENT | LOAN_REPAYMENT), amount, fee, status (PENDING | COMPLETED | FAILED | REVERSED), senderAccountId?, receiverAccountId?, description, idempotencyKey (unique), isFlagged, flagReason?, flaggedById?, reversedTxnId?, initiatedById, createdAt`

### LedgerEntry
`id, transactionId, accountId, direction (DEBIT | CREDIT), amount, balanceAfter, createdAt`
→ gives both sender and receiver their own record; statements = an account's ledger entries.

### DepositWithdrawalRequest
`id, accountId, type (DEPOSIT | WITHDRAWAL), amount, description, status (PENDING | APPROVED | REJECTED), requestedById, reviewedById?, reviewNote?, reviewedAt?, transactionId?, createdAt`

### Loan
`id, userId, accountId (disbursement target), loanType, principal, interestRate, durationMonths, monthlyIncome, employmentStatus, description, status (PENDING | UNDER_REVIEW | APPROVED | REJECTED | ACTIVE | COMPLETED), remainingBalance, forwardedById?, approvedById?, rejectionReason?, disbursementTxnId?, createdAt`

### LoanInstallment
`id, loanId, installmentNo, dueDate, amountDue, principalPart, interestPart, status (DUE | PAID | OVERDUE), paidTxnId?, paidAt?`

### LoanNote
`id, loanId, authorId, note, createdAt`

### BankSettings (single row)
`dailyTransferLimit, maxSingleTransaction, minimumBalance, transferFeeFlat, transferFeePercent, updatedById, updatedAt`

### Notification
`id, userId, type, title, body, isRead, link?, createdAt`

### AuditLog
`id, actorId, action, entity, entityId, metadata (JSON), createdAt`

**Indexes:** `Transaction(senderAccountId, createdAt)`, `Transaction(receiverAccountId, createdAt)`, `Transaction(type, status)`, `LedgerEntry(accountId, createdAt)`, `Loan(status)`, `Request(status)`.

---

## 3. Transaction Processing Logic

### 3.1 Fund Transfer — `POST /api/transfers`
Body (Zod): `{ fromAccountId, toAccountNumber, amount, description, pin, idempotencyKey }` — no balance, no fee from client.

Inside one `prisma.$transaction(async (tx) => { ... })`:

1. Authenticate session; role must be `CUSTOMER`.
2. **Idempotency:** if `idempotencyKey` exists → return the original transaction.
3. **Lock** both account rows in deterministic id order (`SELECT ... FOR UPDATE` via `tx.$queryRaw`) — prevents race conditions & deadlocks.
4. **Validate:**
   - Sender account owned by current user
   - Sender & receiver `ACTIVE`; user not `BLOCKED`
   - Receiver exists and ≠ sender
   - PIN matches bcrypt hash (increment attempts; lock 15 min after 5 failures)
   - `amount ≤ maxSingleTransaction`
   - Today's completed transfers + amount ≤ `dailyTransferLimit`
   - `balance − (amount + fee) ≥ minimumBalance`
5. Compute fee server-side.
6. Debit sender, credit receiver.
7. Create `Transaction (COMPLETED)` + 2 `LedgerEntry` rows (DEBIT / CREDIT with `balanceAfter`).
8. Run fraud rules → set `isFlagged` / `flagReason`.
9. Commit → create notifications (sent / received).

Any thrown error → full rollback. Money is never deducted from one side only.

Typed error codes: `INSUFFICIENT_FUNDS`, `INVALID_PIN`, `PIN_LOCKED`, `LIMIT_EXCEEDED`, `ACCOUNT_FROZEN`, `RECIPIENT_NOT_FOUND`, `SAME_ACCOUNT`, `DUPLICATE_REQUEST`.

### 3.2 Deposit / Withdrawal
- Customer creates request → `PENDING`.
- Staff/Admin approves → single DB transaction: update request, re-check balance (withdrawal) at approval time, update balance, create Transaction + LedgerEntry.
- Reviewer ≠ requester (`assertNotSelf`).
- Reject → status `REJECTED` + note + notification.

### 3.3 Loans
- Customer applies → `PENDING`.
- Staff reviews, adds notes → `UNDER_REVIEW` → forwards to admin. Staff can't act on their own loan.
- Admin approves → in one DB transaction: `APPROVED` → `LOAN_DISBURSEMENT` transaction credits account → generate EMI schedule (`LoanInstallment` rows) → `ACTIVE`.
- Admin rejects → `REJECTED` + reason + notification.
- Repayment: customer pays next installment → debit account, `LOAN_REPAYMENT` transaction, mark installment `PAID`, reduce `remainingBalance`; `0` → `COMPLETED`.

EMI formula: `EMI = P × r × (1+r)^n / ((1+r)^n − 1)`, `r` = monthly rate.

### 3.4 Reversal (Admin)
Never edit/delete history. Create a compensating opposite transaction, mark original `REVERSED`, link via `reversedTxnId`.

### 3.5 Suspicious Transaction Rules
- Single transaction ≥ 80% of balance
- > 5 transfers within 10 minutes
- Amount ≥ 5× account's 30-day average
- ≥ 3 failed PIN attempts within 1 hour
- Manual flag by staff

Flagged items appear in Admin → Flagged Transactions for review.

---

## 4. Roles & Permissions (enforced at API level)

| Action | Admin | Staff | Customer |
|---|:-:|:-:|:-:|
| Bank-wide dashboard / analytics | ✓ | limited | ✗ |
| Register customers / create accounts | ✓ | ✓ | ✗ |
| Verify customer info | ✓ | ✓ | ✗ |
| Activate / deactivate / block users | ✓ | ✗ | ✗ |
| Freeze/unfreeze accounts, set limits, bank settings | ✓ | ✗ | ✗ |
| View/search all transactions | ✓ | ✓ | own only |
| Flag transactions | ✓ | ✓ | ✗ |
| Approve deposit/withdrawal | ✓ | ✓ (not own) | ✗ |
| Loan notes / forward | ✓ | ✓ (not own) | ✗ |
| Approve / reject loans | ✓ | ✗ | ✗ |
| Transfer, request deposit/withdrawal, apply loan | ✗ | ✗ | ✓ |

**Enforcement:**
- `requireRole(...roles)`, `assertAccountOwner(userId, accountId)`, `assertNotSelf(actorId, ownerId)` at the top of every handler.
- `middleware.ts` only redirects pages (`/admin/*`, `/staff/*`, `/dashboard/*`) — not the security boundary.
- Customer queries always scoped by `session.user.id`.
- Every admin/staff mutation writes an `AuditLog` row.

---

## 5. API Routes

```
/api/auth/*                         auth provider
/api/me                             current user + accounts

# Customer
GET    /api/accounts                own accounts
GET    /api/accounts/[id]           detail (ownership check)
POST   /api/accounts/[id]/pin       set/change PIN
POST   /api/transfers               fund transfer
GET    /api/transactions            own, paginated + filters (q, type, from, to, page)
GET    /api/transactions/[id]       detail
GET    /api/receipts/[id]           PDF receipt
GET    /api/statements?accountId&from&to&format=csv|pdf
POST   /api/requests                deposit/withdrawal request
GET    /api/requests                own requests
POST   /api/loans                   apply
GET    /api/loans, /api/loans/[id]  own loans + schedule + repayments
POST   /api/loans/[id]/repay        pay next installment
GET    /api/notifications, PATCH /api/notifications/[id]
GET    /api/stats/customer          chart data

# Staff (+ Admin)
POST   /api/staff/customers         register customer
PATCH  /api/staff/customers/[id]/verify
POST   /api/staff/accounts          create account
GET    /api/staff/transactions      all, filters
POST   /api/staff/transactions/[id]/flag
GET    /api/staff/requests, PATCH /api/staff/requests/[id] (approve/reject)
GET    /api/staff/loans, POST /api/staff/loans/[id]/notes, POST /api/staff/loans/[id]/forward

# Admin
GET    /api/admin/stats
GET    /api/admin/customers, GET/PATCH /api/admin/customers/[id] (status)
GET    /api/admin/accounts, PATCH /api/admin/accounts/[id] (info, freeze, limits)
PATCH  /api/admin/loans/[id] (approve/reject)
POST   /api/admin/transactions/[id]/reverse
GET    /api/admin/flagged
GET/PUT /api/admin/settings
GET    /api/admin/audit
```

---

## 6. Folder Structure

```
src/
  app/
    (auth)/login, register
    (customer)/dashboard, accounts, transfer, requests, loans, transactions, notifications
    (staff)/staff/customers, accounts, transactions, requests, loans
    (admin)/admin/overview, customers, accounts, transactions, flagged, loans, settings, audit
    api/...
  server/
    services/  transfer.service.ts, request.service.ts, loan.service.ts,
               stats.service.ts, fraud.service.ts, notification.service.ts
    auth/      guards.ts
    db.ts, errors.ts
  store/
    index.ts (makeStore), StoreProvider.tsx, hooks.ts
    api/     baseApi.ts, accountsApi.ts, transactionsApi.ts, loansApi.ts,
             requestsApi.ts, adminApi.ts, staffApi.ts, statsApi.ts, notificationsApi.ts
    slices/  authSlice.ts, accountSlice.ts, transactionSlice.ts, loanSlice.ts, uiSlice.ts
    middleware/ rtkQueryErrorLogger.ts
  components/
    ui/ (Button, Card, Badge, Dialog, DataTable, Skeleton, EmptyState)
    layout/ (Sidebar, Topbar, MobileNav)
    charts/ forms/ tables/
  lib/
    money.ts, emi.ts, reference.ts, constants.ts
    validators/ (transfer, request, loan, customer, account, settings)
prisma/
  schema.prisma, seed.ts
tests/
  transfer.test.ts, loan.test.ts
```

---

## 7. Redux Toolkit Architecture

- **Store:** `makeStore()` created per request inside client `StoreProvider` (`useRef`) — App Router safe.
- **baseApi:** `fetchBaseQuery({ baseUrl: '/api' })`, `tagTypes: ['Account','Transaction','Loan','Request','Stats','Notification','Customer','Settings']`.
- **Feature APIs:** `baseApi.injectEndpoints` per domain.
- **Invalidation:**
  - transfer → `Account`, `Transaction`, `Stats`, `Notification`
  - request approve → `Request`, `Account`, `Transaction`, `Stats`
  - loan approve/repay → `Loan`, `Account`, `Transaction`, `Stats`
- **Slices:**
  - `authSlice` — user, role, status (hydrated from session)
  - `accountSlice` — selected account id (account switcher)
  - `transactionSlice` — filters, pagination, search
  - `loanSlice` — application wizard state, selected loan
  - `uiSlice` — sidebar, theme, global loading, toasts
- **Centralized loading:** matcher on `isPending`/`isFulfilled`/`isRejected` in `uiSlice`.
- **Centralized errors:** `rtkQueryErrorLogger` middleware → maps API error codes to toasts.

---

## 8. UI / UX

**Layout:** collapsible sidebar (desktop), drawer (mobile), topbar with notifications bell, account switcher, theme toggle, user menu.

**Customer pages:** Dashboard · Accounts · Transfer · Transactions · Deposit/Withdraw · Loans · Notifications · Profile/PIN
**Staff pages:** Overview · Customers · Accounts · Transactions · Requests · Loans
**Admin pages:** Overview · Customers · Accounts · Transactions · Flagged · Loans · Settings · Audit Log

**Components:** stat cards with trends, data tables (search, filters, pagination, sticky header), status badges (consistent colors per status), confirmation dialogs for every money/permission action, multi-step transfer (details → review → PIN → receipt), skeleton loaders, empty states, toasts.

**Design system:** one color palette (brand + semantic success/warning/danger), one font (e.g. Inter / Plus Jakarta Sans), consistent spacing scale, tabular numbers for amounts, full dark mode.

**Responsive:** test 375px, 768px, 1280px+. Tables collapse to cards on mobile.

---

## 9. Data Visualization (Recharts, real data from `groupBy` queries)

**Admin**
- Monthly Transaction Volume — bar
- Deposit vs Withdrawal — grouped bar / line
- Account Distribution (by type) — donut
- Loan Approval Statistics — stacked bar / donut
- Monthly Banking Activity — area

**Customer**
- Monthly Spending — bar
- Monthly Deposit History — line
- Transaction Distribution (by type) — donut

---

## 10. Build Phases

| # | Phase | Tasks | Est. |
|---|---|---|---|
| 1 | Foundation | Project setup, Tailwind/HeroUI, Prisma schema, Neon, auth + roles, guards, middleware, Redux store + baseApi, app shell (sidebar/topbar, responsive) | 1.5 d |
| 2 | Seed data | 1 admin, 2 staff, ~15 customers, ~25 accounts, 6 months of transactions, loans in every status, requests | 0.5 d |
| 3 | Core money logic | Transfer service, requests + approvals, ledger, fees, limits, PIN + lockout, idempotency, reversal, fraud rules, Vitest tests (overdraft, concurrency, duplicate key) | 2.5 d |
| 4 | Customer features | Dashboard + switcher, accounts, transfer flow, transaction history/detail, requests, notifications | 2 d |
| 5 | Loans | Apply, staff notes/forward, admin approve/reject, disbursement, EMI schedule, repayment, history | 1.5 d |
| 6 | Staff & Admin | Customer mgmt, verify, block/activate, account freeze/limits, settings, flagged review, audit log | 1.5 d |
| 7 | Analytics | Stats services + all charts | 1 d |
| 8 | Bonuses | PDF receipts, CSV/PDF statements, dark mode polish, virtual cards (§10.1), 2FA (OTP for transfers above threshold) last | 1.5 d |
| 9 | Polish & ship | Responsive pass, empty/error states, README, Vercel deploy, verify demo logins on live | 0.5–1 d |

**Total:** ~12.5 days. Phases 1–7 are core; Phase 8 is bonus.

---

## 10.1 Extra Feature — Virtual Debit Cards (Simulated)

> Not required by the brief. Built after Phase 7 as a bonus. **All card data is fake** — the brief forbids real payment cards. Label as "Virtual card (simulated)" in UI and README.

### Model — `Card`
`id, accountId, userId, cardNumberMasked (e.g. 4000 •••• •••• 1234), last4, cardholderName, expiryMonth, expiryYear, cvvHash?, network (VISA | MASTERCARD — cosmetic), status (REQUESTED | ACTIVE | FROZEN | BLOCKED | REJECTED), dailySpendLimit, approvedById?, createdAt`

- Generate a random non-real number server-side; store only masked form + last4 (full number never persisted).
- Never store CVV in plain text (hash it, or omit entirely).
- Add `CARD_PAYMENT` to the `TransactionType` enum; `Transaction.cardId?` relation.

### Business Rules
- One active card per account (configurable).
- Card can only be requested for an `ACTIVE` account owned by the customer.
- Frozen/blocked card or frozen account → payment rejected.
- Card payments go through the same atomic service as transfers: ownership, PIN, balance, min balance, card daily limit + account limits, idempotency, fraud rules.

### Permissions
| Action | Admin | Staff | Customer |
|---|:-:|:-:|:-:|
| Request card | ✗ | ✗ | ✓ (own account) |
| Approve / reject card request | ✓ | ✓ | ✗ |
| Freeze / unfreeze card | ✓ | ✓ | ✓ (own) |
| Block card permanently | ✓ | ✗ | ✗ |
| Set card spend limit | ✓ | ✗ | ✓ (own, ≤ bank max) |
| Simulate card payment | ✗ | ✗ | ✓ (own) |

### API Routes
```
POST   /api/cards                     request card
GET    /api/cards                     own cards
PATCH  /api/cards/[id]                freeze/unfreeze, set limit
POST   /api/cards/[id]/pay            simulated merchant payment { merchant, amount, pin, idempotencyKey }
GET    /api/staff/cards               all card requests
PATCH  /api/staff/cards/[id]          approve / reject
PATCH  /api/admin/cards/[id]/block    block permanently
```

### Redux
- `cardsApi` via `injectEndpoints`, tag `Card`.
- Card payment invalidates `Card`, `Account`, `Transaction`, `Stats`.
- `cardSlice` — selected card, reveal/hide UI state.

### UI
- Card visual on customer dashboard (gradient card, masked number, expiry, status badge, freeze toggle).
- Cards page: list, request dialog, limit setting, recent card transactions.
- Staff/Admin: card requests table with approve/reject, block action with confirmation dialog.
- Notifications: card approved, card rejected, card payment made.

### Tests
- [ ] Payment on frozen card → rejected
- [ ] Payment over card daily limit → rejected
- [ ] Customer can't freeze/pay with another customer's card → 403/404
- [ ] Full card number never returned by any API

**Estimate:** ~0.5 day.

---

## 11. Testing Checklist

- [ ] Transfer more than balance → rejected, no balance change
- [ ] Two simultaneous transfers draining same account → only valid one succeeds
- [ ] Same `idempotencyKey` twice → one transaction
- [ ] Wrong PIN ×5 → PIN locked
- [ ] Frozen sender/receiver → rejected
- [ ] Daily limit / max single / min balance enforced
- [ ] Customer A fetches Customer B's account/transaction → 403/404
- [ ] Customer calls admin/staff API → 403
- [ ] Staff approves own request/loan → 403
- [ ] Staff calls admin settings API → 403
- [ ] Tampered amount/fee in request body → fee recomputed, balance never from client
- [ ] Loan approval → disbursement transaction + schedule created atomically
- [ ] Reversal creates compensating entry, original preserved
- [ ] All pages usable at 375px

---

## 12. Deployment Notes

- Vercel + Neon; use pooled `DATABASE_URL` and `DIRECT_URL` for migrations.
- `prisma generate` in `postinstall`; `prisma migrate deploy` in build.
- Serialize BigInt at the API edge (one helper).
- Run seed against production DB once for demo data.
- Footer notice: "Simulated bank — no real money."

### Environment Variables
```
DATABASE_URL=
DIRECT_URL=
BETTER_AUTH_SECRET=        # or AUTH_SECRET for Auth.js
BETTER_AUTH_URL=           # or AUTH_URL
NEXT_PUBLIC_APP_URL=
```

---

## 13. README Sections (required)

- [ ] Project Overview
- [ ] Application Features
- [ ] User Roles & Permissions (table from §4)
- [ ] Redux Toolkit Architecture (§7)
- [ ] RTK Query Implementation (tags + invalidation map)
- [ ] Authentication Strategy
- [ ] Transaction Processing Logic (§3 + sequence diagram)
- [ ] Database Structure (ER diagram)
- [ ] Security Implementation
- [ ] Environment Variables
- [ ] Local Setup Instructions
- [ ] Deployment Instructions
- [ ] Demo Credentials — Admin, Staff, Customer (one customer with multiple accounts + active loan)
- [ ] Additional libraries used

---

## 14. Submission Checklist

- [ ] Live link (Vercel) accessible
- [ ] Public GitHub repo, clean commits
- [ ] README complete
- [ ] Demo credentials work on live site
- [ ] All major workflows functional end-to-end
- [ ] Works on desktop and mobile
- [ ] No real banking data anywhere
