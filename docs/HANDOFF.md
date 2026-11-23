# HANDOFF — Digital Banking Management System ("Kosh")

> Read this first, then `plan.md` (full build plan) and the original assessment brief.
> This file records every decision already made so a new session can start building immediately.

---

## 1. Project in one paragraph

Assessment project: a simulated digital bank built with **Next.js App Router + TypeScript + Redux Toolkit (mandatory) + RTK Query**. Three roles — **Admin, Staff, Customer**. Graded mainly on correct banking logic (atomic transfers, server-side validation, role-based security), then Redux architecture, then UI/UX. Deliverables: live Vercel link, public GitHub repo, detailed README with demo credentials for all three roles. No real money/cards — everything simulated.

---

## 2. Locked-in decisions

### Stack
| Concern | Decision |
|---|---|
| Framework | Next.js 15 App Router, TypeScript, Route Handlers (`app/api/*`) as backend — single Vercel deploy |
| Database | **PostgreSQL on Neon + Prisma** (pooled `DATABASE_URL` + `DIRECT_URL` for migrations) |
| Auth | **Better Auth** (credentials, `role` field on User). Alternative if needed: Auth.js v5 credentials |
| State | Redux Toolkit slices + **RTK Query** (`baseApi` + `injectEndpoints` per feature) |
| UI | Tailwind CSS + HeroUI v3, `next-themes` (light default, dark supported) |
| Charts | Recharts |
| Validation / forms | Zod (shared client + server schemas) + React Hook Form |
| PDF | `@react-pdf/renderer` (server-side receipts & statements) |
| Hashing | `bcryptjs` (passwords + transaction PIN) |
| Tests | Vitest for transfer/loan logic |

### Money rules (non-negotiable)
- Store amounts as **integers in paisa** (`BigInt`/`Int`). Never floats. Format only in UI. Currency shown as **৳**.
- Serialize BigInt in **one helper** at the API edge.
- Client never sends balances or fees — only `fromAccountId, toAccountNumber, amount, description, pin, idempotencyKey`.
- **Transfers** run inside one `prisma.$transaction`: idempotency check → lock both account rows (`SELECT … FOR UPDATE`, ordered by id) → validate (ownership, ACTIVE status, recipient exists & ≠ sender, PIN bcrypt + lockout after 5 fails, max single txn, daily limit, `balance − (amount + fee) ≥ minimumBalance`) → debit/credit → `Transaction` + two `LedgerEntry` rows (DEBIT/CREDIT, `balanceAfter`) → fraud rules → commit → notifications.
- **Never edit/delete history.** Reversal = compensating transaction + original marked `REVERSED`.
- Deposits/withdrawals = requests approved by Staff/Admin (reviewer ≠ requester; balance re-checked at approval).
- Loan approval (Admin only) = one DB transaction: disbursement txn + EMI schedule + status `ACTIVE`.
- Typed error codes: `INSUFFICIENT_FUNDS, INVALID_PIN, PIN_LOCKED, LIMIT_EXCEEDED, ACCOUNT_FROZEN, RECIPIENT_NOT_FOUND, SAME_ACCOUNT, DUPLICATE_REQUEST`.

### Security rules
- Guards at top of every handler: `requireRole(...)`, `assertAccountOwner(userId, accountId)`, `assertNotSelf(actorId, ownerId)`.
- `middleware.ts` only redirects pages — **not** the security boundary.
- Customer queries always scoped by `session.user.id`.
- Admin/Staff mutations write `AuditLog`.
- Staff cannot approve loans, change bank settings, or act on their own requests/loans.

### Data model (Prisma) — see plan.md §2 for fields
`User, CustomerProfile, Account, Transaction, LedgerEntry, DepositWithdrawalRequest, Loan, LoanInstallment, LoanNote, BankSettings (single row), Notification, AuditLog` + bonus `Card`.

### Redux layout
- `store/index.ts` → `makeStore()` created per request in client `StoreProvider` (`useRef`).
- `store/api/`: `baseApi` (tags: Account, Transaction, Loan, Request, Stats, Notification, Customer, Settings, Card) + `accountsApi, transactionsApi, loansApi, requestsApi, staffApi, adminApi, statsApi, notificationsApi, cardsApi`.
- `store/slices/`: `authSlice, accountSlice (selected account), transactionSlice (filters/pagination), loanSlice, uiSlice (theme, sidebar, global loading, toasts)`.
- `rtkQueryErrorLogger` middleware → toasts. Transfer invalidates Account + Transaction + Stats + Notification.

---

## 3. Brand & design ("Kosh" — fictional bank)

Design canvas (reference screens): https://claude.ai/artifact/T7qP3pAqWFen2RkQfZXRhD
Screens there: customer dashboard (light + dark), admin overview, mobile home, short landing, full video-inspired landing.

### Tokens
| Token | Light | Dark |
|---|---|---|
| Background | `#F5F6FA` | `#0A0F1E` |
| Surface | `#FFFFFF` | `#111A2E` |
| Border | `#E4E7EF` | `#22304B` |
| Text | `#0B1533` | `#EEF2FB` |
| Muted text | `#5B6478` | `#9AA6BF` |
| Subtle fill | `#F0F2F8` | `#18233D` |
| Brand navy (balance card, primary button) | `#0B1533` | `#1A2A5E` |
| Accent blue (key CTA, active tab, virtual card) — replaced lime on 2026-11-21 | `#2F6BFF` (text `#FFFFFF`) | `#2F6BFF` |
| Accent on navy surfaces (active sidebar icon, highlights) | `#8EB1FF` | `#8EB1FF` |
| Info blue (charts, links) | `#3557F5` | `#A9B8FF` |
| Success badge | bg `#E5F6EE` / text `#0B6B48` | bg `rgba(74,222,154,.14)` / `#6EE7B7` |
| Pending badge | bg `#FEF3C7` / text `#8A3B0A` | bg `rgba(251,191,36,.14)` / `#FCD34D` |
| Danger badge | bg `#FDECEC` / text `#A1161C` | — |
| Money in | `#0B7A52` | `#4ADE9A` |

- Fonts: **Inter** (UI), **Space Grotesk** (headings + balances). `tabular-nums` on all amounts.
- Radius: cards 18–22px, buttons 12px (app) / full pill (landing).
- Status badge colors identical everywhere: Pending=amber, Completed/Approved/Active=green, Failed/Rejected=red, Reversed/Frozen=grey/blue.
- Customer mobile = bottom tab bar (Home, Transfer, Cards, Loans, More). Staff/Admin = drawer sidebar; tables → cards on mobile.
- Transfer UX = 4 steps: details → review (fee, total, remaining daily limit) → PIN → success + receipt.
- Footer/notice everywhere: "Simulated bank — no real money."

### Landing page (build near the end)
Inspired by Revolut / Alpian / Mercury / UNFCU recordings: closable demo notice bar → nav (Log in, Launch demo, Open account) → huge headline hero with phone mockup + floating chips → trust strip → "Everything you do with money. All in one place." clickable list + changing navy panel → dark "A card for every need" fanned cards → 2×2 account-type grid → "Your money's safe space" → account plans (Savings/Current/Business limits) → rounded CTA panel → navy footer. Use real app screenshots once the app exists.

---

## 4. Build order (one or two phases per session, commit after each)

0. **Design system** — Tailwind/HeroUI theme with tokens above, `next-themes`, base components (Button, Card, Badge, Input, Dialog, DataTable, Skeleton, EmptyState). Placeholder homepage with Log in button. Deploy early.
1. **Foundation** — Prisma schema, Neon, Better Auth + roles, guards, middleware, Redux store + baseApi, app shell (sidebar/topbar, responsive).
2. **Seed** — 1 admin, 2 staff, ~15 customers, ~25 accounts, 6 months of backdated transactions, loans in every status, requests. One demo customer with 3 accounts + active loan.
3. **Core money logic** — transfer service, requests + approvals, ledger, fees, limits, PIN lockout, idempotency, reversal, fraud rules, Vitest tests.
4. **Customer features** — dashboard + switcher, accounts, transfer flow, history/detail, requests, notifications.
5. **Loans** — apply, staff notes/forward, admin approve/reject, disbursement, EMI schedule, repayment.
6. **Staff & Admin** — customer mgmt, verify, block, freeze/limits, settings, flagged review, audit log.
7. **Analytics** — stats services (`groupBy`) + all charts (admin 5, customer 3).
8. **Bonuses** — PDF receipts, CSV/PDF statements, dark mode polish, virtual cards, 2FA last.
9. **Polish & ship** — full landing page, responsive pass, README, Vercel, verify demo logins live.

---

## 5. Progress log

### ✅ Phase 0 + 1 — done (2026-11-21)
Verified: `tsc`, `eslint`, `next build`, Vitest (5 tests) all pass; auth flow tested end-to-end against Postgres (sign-in, role redirects, blocked users, role-escalation attempt at sign-up); screens checked in Chrome at 1360px and 375px, light + dark.

**Decisions made while building (binding for later phases):**
- **Versions:** Next 15.5, React 19.1, HeroUI 3.2.7, Tailwind 4, Better Auth 1.7.27, **Prisma 6.19.3** (npm `latest` is an 8.0 RC; 7 forces driver adapters + prisma.config — avoided), Zod 4, RTK 2.
- **Prisma runs Rust-free:** `engineType = "client"` + `@prisma/adapter-pg` (`src/server/db.ts`). `schema.prisma` keeps `url`/`directUrl` for the CLI (migrations use `DIRECT_URL`). Initial migration is `prisma/migrations/20261121000000_init`.
- **Table names are snake_case** via `@@map` (`accounts`, `transactions`, …). Raw SQL must use them: `SELECT ... FROM accounts WHERE id IN (...) ORDER BY id FOR UPDATE`.
- **Better Auth's `account` table is the `AuthAccount` model** (`account.modelName: "authAccount"`) because the bank `Account` owns that name. Passwords are **bcrypt** (custom hash/verify) so the seed writes `auth_accounts` rows directly (`providerId: "credential"`, `accountId = userId`).
- `role`, `status`, `isVerified` are Better Auth `additionalFields` with `input: false` → sign-up can only create CUSTOMER. BLOCKED/INACTIVE users are refused in `databaseHooks.session.create.before`, and `requireUser()` re-checks status on every API call (no cookie cache).
- Better Auth's built-in sign-in rate limit is on (3 tries / 10 s per IP). Leave it.
- **Money:** `BigInt` paisa everywhere; rates as **basis points** (`interestRateBps`, `transferFeePercentBps`). `serialize()` in `src/server/http.ts` is the only BigInt→string place. Client helpers: `formatMoney`, `takaToPaisa`, `percentOf` in `src/lib/money.ts`.
- Extra schema bits beyond plan §2: `TransactionType.REVERSAL`, `Transaction.flaggedAt/flagResolvedAt/merchant/cardId`, `Loan.emiAmount/totalPayable/forwardedAt/decidedAt`, `BankSettings.transferFeeMax/otpThreshold`, `SecurityEvent` model (PIN failures → fraud rule "≥3 failed PINs in 1h").
- **Route handlers:** wrap with `handler()` and return `ok()`; throw `AppError(code)` for typed errors; validate with `parseBody(req, zodSchema)`. Admin/Staff mutations call `writeAudit(..., tx)`.
- **Redux:** one `StoreProvider` per role area (`components/layout/RoleLayout.tsx`), hydrated with the server session user; public pages have no store. Error toasts via HeroUI `toast` in `rtkQueryErrorLogger`; global mutation progress bar from `uiSlice.pendingMutations`.
- Fonts are self-hosted via `@fontsource-variable/*` (no Google Fonts fetch at build).
- Demo logins (`src/lib/demo-accounts.ts`): `customer@ / staff@ / staff2@ / admin@ / rafi@kosh.demo`, password `Demo@1234`, transaction PIN `1234`.

### ✅ Phase 2 — full seed (2026-11-21)
`prisma/seed.ts`: 1 admin, 2 staff, 15 customers, 25 accounts, ~1,340 transactions / ~2,140 ledger rows over 6 months (runs in ~2 s via `createMany`). Deterministic RNG. Events are generated, sorted and **applied chronologically with live balance tracking**, so skipped events never leave holes and the script **verifies balance = ledger net for every account** before finishing.
- Customer states: Arif **BLOCKED** (after a flagged 85%-of-balance transfer that admin **reversed**), Lamia **INACTIVE**, Nadia + Lamia **unverified**, Mehedi's current account **FROZEN** (after a 6-transfer burst → auto-flag), Sabbir has a **CLOSED** account.
- Loans: ACTIVE ×3 (Nusrat 24-mo personal, 4 paid + EMI due tomorrow; Kamrul auto with 1 **OVERDUE** installment; Imran business), COMPLETED ×1 (Taslima), PENDING ×2, UNDER_REVIEW ×2 (staff notes + forwarded), REJECTED ×2. `APPROVED` is never persisted — approval goes straight to ACTIVE in one transaction.
- Requests: ~380 APPROVED (each linked to its DEPOSIT/WITHDRAWAL txn), 6 PENDING, 3 REJECTED. Fraud rules (`lib/fraud-rules.ts`) run on seeded transfers; auto-flags older than 45 days are marked resolved, so ~5 stay open for the admin queue.
- Notifications for Nusrat (5 unread), audit log for every staff/admin action.
- Loan `remainingBalance` = sum of unpaid `amountDue` (total payable, not just principal).

### ✅ Phase 3 — core money logic (2026-11-21)
Services in `src/server/services/`:
- `transfer.service.ts` — `previewTransfer` (review step, no side effects) and `executeTransfer`: fast idempotency check → find receiver → **one interactive transaction**: `lockAccounts` (sorted `FOR UPDATE`) → idempotency re-check → ownership (404) → `checkAccountStates` (before PIN, so frozen accounts don't burn attempts) → PIN → `checkTransferRules` (max single, daily limit from Dhaka midnight, fee, min balance) → fraud stats → debit/credit → Transaction + 2 LedgerEntries. A P2002 on `idempotencyKey` returns the winning txn. Notifications after commit.
- **Fee handling:** the sender's DEBIT ledger row = amount + fee and the receiver's CREDIT = amount. The fee leaves the customer ledger (no bank income account yet). A reversal refunds amount + fee.
- `pin.service.ts` — **wrong PIN does not throw inside the transaction**: it returns a result, the transaction commits the attempt counter + `SecurityEvent`, and the error is thrown after commit. 5 failures → 15-min lock. `setPin` requires the current PIN to change.
- `request.service.ts` — create (customer), list, approve/reject (staff/admin): locks request + account rows, PENDING check, `assertNotSelf` vs requester AND account owner, withdrawal balance re-checked at approval, audit log.
- `transaction-admin.service.ts` — `reverseTransaction` (admin; TRANSFER/DEPOSIT/WITHDRAWAL only; compensating `REVERSAL` txn with `reversedTxnId`, original → REVERSED, never drives a balance negative, allowed on frozen accounts) and `flagTransaction` (staff/admin manual flag).
- `fraud.service.ts` — collects stats inside the transaction; pure rules in `lib/fraud-rules.ts`. Flagged transfers notify all admins.
- Shared pure logic: `lib/fees.ts`, `lib/emi.ts` (exact BigInt fixed-point EMI + amortisation, last row absorbs rounding), `lib/time.ts`, `lib/validators/money.ts` (amounts are **integer paisa strings**, Zod strips unknown keys like `fee`).

API routes added: `POST /api/transfers`, `POST /api/transfers/preview`, `POST /api/accounts/[id]/pin`, `GET|POST /api/requests`, `GET /api/staff/requests`, `PATCH /api/staff/requests/[id]` (`{action:"approve"|"reject", note}`), `POST /api/staff/transactions/[id]/flag`, `POST /api/admin/transactions/[id]/reverse`.

**Tests — 54 passing** (`npm test`): `tests/unit` (money, EMI, fees, fraud rules, validators, Dhaka day), `tests/integration` (real Postgres via `TEST_DATABASE_URL`: overdraft, min balance, 5 parallel draining transfers → exactly 2 succeed, 10 opposite-direction parallel transfers without deadlock, idempotency sequential + concurrent, cross-user key replay, PIN lockout persisted, frozen/blocked, limits, ownership 404, same account, unknown recipient, tampered fee, fraud flags, request approve/reject/self/double-approve race/withdrawal re-check, reversal + refusal, manual flag, PIN set/change), `tests/e2e` (HTTP with real sessions via `E2E_BASE_URL`: 401/403 by role, cross-customer 404, 422 validation, preview→transfer→replay, INVALID_PIN details, request→approve→409, no PIN hash in `/api/me`). Suites skip when their env var is missing.

### 🎨 Design change (2026-11-21)
Lime accent replaced by **blue `#2F6BFF`** (token `kosh-accent`, `kosh-accent-soft` `#8EB1FF` on navy). Status greens (success badge, money-in) intentionally kept — user confirmed.

### ✅ Phase 4 — customer features (2026-11-21)
- **Read APIs** (`customer-query.service.ts`, all scoped to the session user, foreign ids → 404): `GET /api/accounts`, `GET /api/accounts/[id]?page` (account + ledger statement + credit/debit totals), `GET /api/transactions` (accountId, q, type, status, from/to as Dhaka dates, page), `GET /api/transactions/[id]` (own ledger lines + reversal links, **no flag info for customers**), `GET /api/notifications`, `PATCH /api/notifications/[id]`, `POST /api/notifications/read-all`.
- Transactions are presented **from the customer's side**: `direction` in/out/internal, `net` = amount + fee for outgoing, counterparty masked ("Rafiul K.") or "Cash deposit"/"Kosh Loans".
- **RTK Query**: `accountsApi`, `transactionsApi`, `requestsApi`, `notificationsApi`, `loansApi` (+ `qs` helper). Transfer/repay invalidate `Me`, `Account`, `Transaction LIST`, `Stats`, `Notification`. Mark-read is **optimistic** (`updateQueryData` + undo). The bell polls every 30 s. Form-level errors are shown inline — `rtkQueryErrorLogger` skips `SILENT_ENDPOINTS` (previewTransfer, transfer, createRequest, applyLoan, repayLoan, setPin).
- **Pages**: dashboard recent activity; accounts grid + statement (`/accounts/[id]`); **4-step transfer** (`TransferFlow.tsx`: details → server preview → PIN with attempts-left → success/receipt; idempotency key created at review and reused on retries); transactions with filters in `transactionSlice` (debounced search, account/type/status/date, mobile filter toggle) + detail page; deposit/withdraw requests; notifications (all/unread, mark all); profile & per-account PIN set/change.
- **PINs are now exactly 4 digits** (`pinSchema`); `PinInput` wraps HeroUI `InputOTP`, masked with CSS (`.pin-masked`).
- New UI pieces: `NativeSelect` (styled native select), `Segmented`, `PinInput`, `banking/TxnRow` (+ `TxnIcon`, `TXN_TYPE_LABEL`), `loans/LoanBits` (`LoanProgress`, `ScheduleTable`), `lib/client.ts` (`errorMessage`, `errorCode`, `errorDetails`, `newIdempotencyKey`).

### ✅ Phase 5 — loans (2026-11-21)
- `lib/loan-products.ts`: rate + amount/term limits per product (**server picks the rate**; a client-sent rate is ignored). `loanApplySchema` validates against the product.
- `loan.service.ts`: `applyForLoan` (verified customers only, one open application, own ACTIVE account), `listOwnLoans`/`getOwnLoan` (**internal notes never returned to customers**), `repayNextInstallment` (PIN + idempotency + min balance, pays the lowest unpaid installment, → COMPLETED at zero), `listLoansForReview` (+ status counts), `getLoanForReview` (EMI/income %, 90-day inflow, other loans), `addLoanNote`, `forwardLoan` (PENDING → UNDER_REVIEW, needs ≥1 note), `approveLoan` (one transaction: disbursement txn + ledger + schedule + ACTIVE; works from PENDING or UNDER_REVIEW), `rejectLoan`. All staff/admin actions are `assertNotSelf` + audited. `refreshOverdue()` marks past-due installments OVERDUE lazily on reads.
- Routes: `GET|POST /api/loans`, `GET /api/loans/[id]`, `POST /api/loans/[id]/repay`, `GET /api/staff/loans`, `GET /api/staff/loans/[id]`, `POST /api/staff/loans/[id]/notes`, `POST /api/staff/loans/[id]/forward`, `PATCH /api/admin/loans/[id]`.
- Pages: customer `/loans` (cards with progress, next/overdue EMI), `/loans/apply` (3-step wizard, draft in `loanSlice`, live EMI calculator + affordability hint), `/loans/[id]` (timeline, schedule, Pay EMI with PIN modal). Staff/admin: shared `components/review/LoanQueue` + `LoanReview` (notes thread, forward, approve & disburse / reject with ConfirmDialog) and `RequestQueue` (approve/reject deposit & withdrawal requests) at `/staff/*` and `/admin/*`.

**Tests — 64 passing**: + `tests/integration/loans.test.ts` (9: product limits & server rate, one open application, unverified blocked, note→forward→approve atomic, frozen account rollback, self-action blocks, hidden notes, in-order repay to COMPLETED with replay, min balance, cross-customer 404) and e2e loan/ownership checks. Browser walkthrough of every flow (customer → staff → admin) ran with zero console errors.

### ✅ Phase 6 — staff & admin management (2026-11-21)
`management.service.ts` (every mutation audited, `assertNotSelf` where a person acts on themselves):
- **Customers:** `listCustomers` (search name/email/phone/account no., status, KYC filters), `getCustomer` (profile, accounts, loans, recent txns, audit trail), `registerCustomer` (creates login with a **readable temporary password returned once** — bcrypt in `auth_accounts`, KYC profile, optional first account; duplicate email → `ALREADY_EXISTS` 409), `verifyCustomer` (needs phone + NID).
- **Accounts:** `openAccount` (verified + ACTIVE customer, max 5 open, retries on number collision, starts at ৳0 with no PIN — customer sets it), `listAllAccounts`, `updateAccountAsAdmin` (freeze / unfreeze / close (zero balance only) / per-account limits that can't exceed bank limits).
- **Users:** `setUserStatus` (admin; can't target admins or self; non-ACTIVE **deletes all sessions** → signed out immediately).
- **Transactions:** `listAllTransactions` (search ref/note/name/account no., type, status, flag state, Dhaka dates), `resolveFlag` (admin clears a flag; reversal stays separate).
- **Settings & audit:** `updateSettings` (audit metadata stores `{from, to}` per changed field), `listAudit` (entity/actor/action filters).
- Routes: `GET|POST /api/staff/customers`, `GET /api/staff/customers/[id]`, `PATCH /api/staff/customers/[id]/verify`, `GET|POST /api/staff/accounts`, `GET /api/staff/transactions`, `PATCH /api/admin/customers/[id]`, `PATCH /api/admin/accounts/[id]`, `GET|PUT /api/admin/settings`, `GET /api/admin/flagged`, `PATCH /api/admin/flagged/[id]`, `GET /api/admin/audit`.
- UI (`components/manage/`, shared by `/staff/*` and `/admin/*` via `scope`): `CustomersList` + `RegisterCustomerDialog`, `CustomerProfile` (verify, open account, admin activate/deactivate/block), `AccountControls` (admin menu: freeze/unfreeze/limits/close), `AccountsList`, `BankTransactions` (flag; admin also reverse), `FlaggedReview`, `SettingsForm` (live fee preview), `AuditLog`, `ReasonDialog` (required reason for every sensitive action).
- **Bug found & fixed:** with the driver adapter, Prisma's P2002 puts the field in `meta.driverAdapterError.cause.constraint.fields`, not `meta.target`. `isUniqueViolation` now reads both (unit-tested) — this also hardens the idempotency race fallback.

### ✅ Phase 7 — analytics (2026-11-21)
- `stats.service.ts`: monthly buckets in **Dhaka time** via raw SQL (`AT TIME ZONE`), breakdowns via Prisma `groupBy`. `adminStats` (KPIs incl. month-to-date volume trend, deposits, loan book, overdue EMIs + monthly series, account distribution, loan statuses), `staffOverview` (queue counts + oldest items), `customerStats` (ledger-based spending/income that **excludes transfers between the customer's own accounts**, deposits, type mix). Routes: `GET /api/admin/stats`, `GET /api/staff/overview`, `GET /api/stats/customer?accountId`.
- RTK: `staffApi`, `adminApi`, `statsApi`; overviews poll every 60 s.
- Charts (`components/charts/`, Recharts) follow the dataviz skill: palette **validated** (adjacent + all-pairs CVD ΔE ≥ 9, normal-vision ≥ 24, light on `#FFFFFF` and dark on `#111A2E`; CSS vars `--series-1..3`), single y-axis, 24px max bars with 4px rounded tops, 2px lines with ringed markers, 10% area wash, legend for ≥ 2 series, text never in series colour, **"View as table" toggle on every chart** (relief for the aqua slot's < 3:1 contrast).
- **Deviation from plan §9:** donuts were replaced per the dataviz guidance — *Account distribution* → tall segmented bar; *Loan approval statistics* and the customer's *Transaction mix* → horizontal bar lists. Admin: Monthly volume (columns), Deposits vs withdrawals (grouped columns), Monthly activity (lines + wash), Account distribution, Loan statistics. Customer: Monthly spending (columns), Monthly deposits (line), Transaction mix.

**Tests — 76 passing** (+ `tests/integration/management.test.ts`: registration login works, duplicate email, verify/open rules, block kills sessions, admin can't block admins/self, freeze blocks transfers, close needs zero balance, account limits capped + enforced, settings change next fee + audited diff, flag resolve; stats exclude own-account moves, scoped, counts; e2e: every admin route 403 for staff & customer, staff routes 403 for customers). Browser walkthrough of all screens (light, dark, 375px) with zero console errors.

### ✅ Phase 8 — bonuses (2026-11-21)
- **Design decision (user approved "proceed as you want"):** the indigo→teal glassmorphism the user liked is used for the **virtual cards and the landing page only**; the app keeps navy + blue `#2F6BFF` for readability.
- **Virtual cards (simulated)** — `card.service.ts`: request (own ACTIVE account, one live card per account), staff approve → random **test-range** number (4000…/5100…, Luhn), only `cardNumberMasked` + `last4` stored, no CVV; reject with reason; customer freeze/unfreeze + own daily limit (≤ bank daily limit); staff freeze/unfreeze; admin permanent block. **`payWithCard`** uses the transfer pattern: lock → idempotency → card ACTIVE → account ACTIVE → PIN (committed on failure) → card daily limit → account limits (`usedTodayFor` counts TRANSFER + CARD_PAYMENT) → min balance → `CARD_PAYMENT` txn (merchant, cardId) + ledger → fraud flags. New error code `CARD_INACTIVE`. Routes: `GET|POST /api/cards`, `PATCH /api/cards/[id]`, `POST /api/cards/[id]/pay`, `GET /api/staff/cards`, `PATCH /api/staff/cards/[id]` (approve/reject/freeze/unfreeze), `PATCH /api/admin/cards/[id]/block`. RTK `cardsApi` + **`cardSlice`** (selected card, reveal). UI: `components/cards/VirtualCard` (glass face, "Simulated" label), `/cards` (spend meter, freeze switch, limit, simulated payment with PIN, card payments), dashboard card widget, `components/review/CardQueue` for staff/admin. Seed: Nusrat ACTIVE card with payments + pending request; Fatema ACTIVE; Imran FROZEN; Arif BLOCKED; Ayesha REQUESTED; Sadia REJECTED.
- **PDFs** — `server/pdf/documents.tsx` (@react-pdf/renderer, `serverExternalPackages` in next.config): A5 receipt and A4 statement (opening/closing, totals, running balance; Helvetica has no ৳ so PDFs print "BDT"). `document.service.ts`: `receiptData` (customers: own txns only, counterparty masked; staff/admin any), `statementData` (Dhaka dates, ≤ 1 year, from the ledger), `statementCsv` (BOM, RFC 4180, plain decimals). Routes `GET /api/receipts/[id]`, `GET /api/statements?accountId&from&to&format=csv|pdf`. Buttons: transaction detail "Download PDF receipt", account page "Statement" dialog.
- 2FA was deferred here and built in Phase 11.

### ✅ Phase 9 — polish & ship (2026-11-21)
- **Landing page** (`app/page.tsx`, dynamic — reads live `BankSettings`): dismissible notice bar, nav, gradient hero "Every paisa, accounted for." with fanned glass cards and a balanced debit/credit receipt chip (single load animation, respects reduced motion), demo-login strip, **feature switcher with real app screenshots** (`public/landing/*.png`, regenerate with Playwright if the UI changes), dark cards section, account types + **live limits and fees** + loan rates, security section, CTA, navy footer. No numbered markers / all-caps eyebrows / accent-word headlines.
- **README** rewritten with every §13 section, permissions table, Redux + RTK Query invalidation map, auth strategy, transfer **sequence diagram** and **ER diagram** (Mermaid, both verified to render), security, test inventory, env vars, local setup, Vercel + Neon deployment.
- Unused `ComingSoon` placeholder removed — every route is a real page now.

**Tests — 85 passing** (adds `tests/integration/cards.test.ts` (8) and e2e card/receipt/statement scoping).

### ✅ Phase 10 — notifications, email, Google sign-in (2026-11-21)
- **Notifications for every role:** bell + `/notifications`, `/staff/notifications`, `/admin/notifications` (shared `NotificationCenter`: All/Unread, mark read, mark all, email on/off switch). New `REVIEW_QUEUE` type: staff are alerted to new deposit/withdrawal requests, loan applications, card requests and customers ready for verification; admins to loans forwarded for a decision (`notifyRoles`).
- **Email** (`server/email/`): provider picked from env, SMTP via **Nodemailer** → Resend → log-only. Branded HTML + text template. Sent after the response with `after()`; never throws. Every attempt is stored in `email_logs` (status SENT / FAILED / LOGGED). `EMAIL_DEMO_RECIPIENT` redirects all mail to one inbox. Per-user opt-out (`users.emailNotifications`); blocked users get security emails only. Migration `20261121140000_email_notifications`.
- **Admin → Email log** (`/admin/emails`): filter by status, sandboxed iframe preview.
- **Google sign-in** (Better Auth `socialProviders.google`), only when `GOOGLE_CLIENT_ID`/`SECRET` are set. Button on login + register, friendly `?error=` messages. New Google users = unverified CUSTOMER; Better Auth's safe account-linking default is kept.
- **KYC self-service:** `GET/PATCH /api/me/profile` and a form on Profile for unverified customers (18+ checked on the server, staff alerted once, locked after verification). This fixes a gap where self-registered users could never be verified because they had no phone/NID.
- **Tests — 94 passing** (at the end of Phase 10) (new `tests/integration/notifications-email.test.ts` with mocked Nodemailer and Resend, plus e2e checks for role-gated email log/KYC and Google on/off).
- Real Gmail delivery and the real Google OAuth round-trip can't be exercised in the build sandbox (no outbound access). Verify both once env vars are set locally.

### ✅ Phase 11 — two-factor for sensitive operations (2026-11-21)
- Covers the brief's bonus "Two-factor authentication for sensitive operations" (now **all 7 bonus items are done**).
- `OtpChallenge` model + `OtpPurpose` enum (TRANSFER, PIN_CHANGE, REVERSAL, SETTINGS), migration `20261121150000_two_factor`. Uses the existing `BankSettings.otpThreshold` (seed ৳25,000; editable on Admin → Settings, blank = off).
- `server/services/otp.service.ts`: request (cooldown 30 s, 5 per 15 min), verify (HMAC, timing-safe, 5 tries, 5 min), consume (atomic `updateMany … consumedAt: null`), `withOtp` helper. `otp-payload.ts` = canonical fingerprint per operation; `otp-operations.ts` = `POST /api/otp` logic with role checks.
- Enforced server-side: `executeTransfer` (verify before the tx, consume inside it, after the PIN check), PIN-change route (only when a PIN already exists), reversal route, settings route. New error codes `OTP_REQUIRED` 428, `OTP_INVALID` 422, `OTP_EXPIRED` 410, `OTP_LOCKED` 423, `RATE_LIMITED` 429.
- Client: `securityApi.requestOtp` (RTK Query), `components/security/TwoFactorDialog.tsx` with the `useTwoFactor().run(request, perform)` hook, reusing a still-valid code after a wrong PIN. Used in TransferFlow, Profile PIN form, FlaggedReview, BankTransactions and SettingsForm. OTP errors are silenced in the global toaster (shown in the dialog).
- Email log stores the code-email with the code blanked. In log-only mode the API returns `demoCode`, shown in the dialog.
- **Tests — 102 passing** (new `tests/integration/two-factor.test.ts` + e2e two-factor checks).

### ⏭ Remaining (needs the developer)
1. Create the Neon project + Vercel project, set the 5 required env vars (+ optional Google / SMTP ones), deploy (README → Deployment), then run `npm run db:seed` against production once.
2. Put the live URL + GitHub URL at the top of the README.
3. Sign in with all three demo accounts on the live site.

---

## 6. Developer notes
- Developer works on Windows (Git Bash/PowerShell); prefers file-by-file instructions over bulk terminal copy commands.
- Keep `plan.md` and `HANDOFF.md` in the repo (`docs/`) as the source of truth.
