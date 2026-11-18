# KNOTTY Code Review Report

Static review performed 2026-10-18. `npm audit` used the package lockfiles and current registry advisories. No application data or environment-file contents are reproduced. `.vercel` output is excluded from the file-size inventory, but the requested `eslint .` command did lint it.

## 1. FILE SIZES

Top 40 text files under `knotty-backend/src` and `knotty-app`, sorted by line count descending. Binary assets are excluded because line counts do not apply to them; generated, dependency and build folders are excluded as requested. `package-lock.json` is included as text.

| Lines | File |
|---:|---|
| 7,141 | `knotty-app/package-lock.json` |
| 4,619 | `knotty-app/lib/api.ts` |
| 1,785 | `knotty-app/app/students/[id]/StudentDetailClient.tsx` |
| 1,145 | `knotty-app/app/canteen/page.tsx` |
| 970 | `knotty-app/app/attendance/page.tsx` |
| 939 | `knotty-backend/src/utils/pdfGenerator.js` |
| 939 | `knotty-app/app/workers/page.tsx` |
| 906 | `knotty-app/app/gate-access/page.tsx` |
| 871 | `knotty-app/app/students/page.tsx` |
| 822 | `knotty-app/app/library/page.tsx` |
| 787 | `knotty-backend/src/modules/library/service.js` |
| 738 | `knotty-app/app/reports/page.tsx` |
| 667 | `knotty-backend/src/modules/academics/service.js` |
| 623 | `knotty-app/app/standalone-tap/page.tsx` |
| 616 | `knotty-app/app/discipline/page.tsx` |
| 589 | `knotty-backend/src/modules/fees/service.js` |
| 585 | `knotty-app/app/health/page.tsx` |
| 584 | `knotty-app/app/fees/page.tsx` |
| 544 | `knotty-app/app/settings/page.tsx` |
| 506 | `knotty-backend/src/modules/attendance/service.js` |
| 502 | `knotty-backend/src/modules/gate-access/service.js` |
| 453 | `knotty-app/app/schools/page.tsx` |
| 403 | `knotty-app/components/Header.tsx` |
| 402 | `knotty-backend/src/modules/canteen/service.js` |
| 392 | `knotty-backend/src/modules/students/service.js` |
| 373 | `knotty-backend/src/modules/health/service.js` |
| 362 | `knotty-backend/src/modules/cards/service.js` |
| 346 | `knotty-backend/src/modules/auth/service.js` |
| 345 | `knotty-app/components/NFCStudentModal.tsx` |
| 322 | `knotty-backend/src/modules/schools/service.js` |
| 307 | `knotty-app/app/cards/page.tsx` |
| 301 | `knotty-backend/src/modules/levels/service.js` |
| 290 | `knotty-backend/src/modules/workers/service.js` |
| 274 | `knotty-app/components/dashboards/ParentDashboard.tsx` |
| 273 | `knotty-app/app/my-profile/page.tsx` |
| 265 | `knotty-backend/src/modules/academics/controller.js` |
| 251 | `knotty-app/app/materials/page.tsx` |
| 248 | `knotty-app/context/AuthContext.tsx` |
| 240 | `knotty-backend/src/modules/academics/timetable-generator.js` |
| 236 | `knotty-app/app/login/page.tsx` |

## 2. BACKEND MODULES

No module has a separate model/repository layer; persistence uses Prisma models directly from service code (and some controllers). Thus the full route → controller → service → model layering is **not** present. For modules with all three application layers, the first three are present. `admin` has routes and a backup service, but no controller or standard module service.

| Folder | Files | Layering |
|---|---|---|
| `academics` | `controller.js`, `routes.js`, `service.js`, `timetable-generator.js` | Route/controller/service present; helper generator; no model layer |
| `achievements` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `admin` | `backup.service.js`, `routes.js` | No controller; direct route handlers call backup service; no model layer |
| `attendance` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `auth` | `controller.js`, `routes.js`, `service.js`, `validation.js` | Route/controller/service present; no model layer |
| `canteen` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `cards` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `discipline` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `fees` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `gate-access` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `health` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `levels` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `library` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `materials` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `notifications` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `reports` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `schools` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `students` | `controller.js`, `routes.js`, `service.js`, `validation.js` | Route/controller/service present; no model layer |
| `teachers` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |
| `workers` | `controller.js`, `routes.js`, `service.js` | Route/controller/service present; no model layer |

Middleware in `knotty-backend/src/middleware`:

| File | Purpose |
|---|---|
| `auth.js` | Verifies bearer JWT and resolves active user/session and memberships. |
| `classAccess.js` | Checks a teacher’s assignment to a requested class. |
| `errorHandler.js` | Converts thrown/request errors into HTTP error responses. |
| `rateLimiter.js` | Defines global and transaction request limits. |
| `rbac.js` | Checks `req.user.role` against endpoint-allowed roles. |
| `validator.js` | Validates request data against a supplied schema. |
| `waf.js` | Scans request query/body values for configured injection patterns. |

## 3. DEAD CODE

- `knotty-app/scratch/take_screenshots.js`, `test_action_flow.js`, `test_all_pages.js`, and `test_canteen_flow.js`: no imports or references from application code found. They appear to be manually invoked Playwright scripts; whether developers still use them is **NOT FOUND**.
- `knotty-app/functions/api/[[path]].ts` and `knotty-app/functions/uploads/[[path]].ts`: no ordinary imports found. Cloudflare Pages treats these as convention-based function routes, so lack of imports does not establish that they are dead. Their deployment use is **NOT FOUND**.
- `standalone-card-system/index.html`: no imports or references elsewhere in the repository were found. It is a standalone page; whether it is still used is **NOT FOUND**.
- Source scan of the two package files found backend `redis` unused as a direct package: the code imports `ioredis` in `knotty-backend/src/config/redis.js:1` and uses that shared client in auth, cards, canteen, attendance and schools. `uuid` also had no source import/reference found (the code uses Node `crypto.randomUUID()` in auth). Frontend `@playwright/browser-chromium` and `@swc/helpers` have no direct source import found; whether they are needed by tooling/runtime is **NOT FOUND**. `playwright` is used in the scratch and root UI-check scripts. All other package dependencies are referenced in source/configuration found during the scan.

## 4. DEPLOYMENT CONFIGS

The checked-in configs do not prove which service is currently receiving production traffic. Actual active production targets are **NOT FOUND**.

| Config | What it configures | Production use |
|---|---|---|
| Root `vercel.json` | Vercel Next.js app build from `knotty-app` | Configured target; actual deployment **NOT FOUND** |
| `knotty-backend/vercel.json` | Vercel Node backend and scheduled backup route | Configured target; actual deployment **NOT FOUND** |
| `knotty-backend/railway.toml` | Railway backend build, migrations and start command | Configured target; actual deployment **NOT FOUND** |
| `knotty-backend/render.yaml` | Render backend web service, `/health` check and auto-deploy | Configured target; actual deployment **NOT FOUND** |
| `knotty-app/wrangler.toml` | Cloudflare Pages frontend output and API URL variable | Configured target; actual deployment **NOT FOUND** |
| `knotty-backend/wrangler.toml` | Cloudflare Worker entry at `src/worker.mjs` | Configured target; actual deployment **NOT FOUND** |

No config can be called unused based on repository contents alone; no live account/deployment state was available to inspect.

## 5. HEALTH CHECKS

Summarized command output (no package audit advisory text or credential values included):

| Command | Result |
|---|---|
| `npm audit --omit=dev` in `knotty-app` | 6 total: critical 1 (`next`); high 4 (`nanoid`, `postcss`, `sharp`, `source-map-js`); moderate 1 (`baseline-browser-mapping`). |
| `npm audit --omit=dev` in `knotty-backend` | 20 total: critical 1 (`proxy-addr`); high 13; moderate 5; low 1. High packages: `@prisma/config`, `africastalking`, `axios`, `deepmerge-ts`, `fast-uri`, `form-data`, `hono`, `ip-address`, `joi`, `lodash`, `multer`, `mysql2`, `prisma`. Moderate: `@hono/node-server`, `@prisma/dev`, `morgan`, `qs`, `valibot`. Low: `body-parser`. |
| `npx tsc --noEmit` in `knotty-app` | Exit 0; no diagnostics. |
| `npx eslint .` in `knotty-app` | Exit 1; 345 errors and 4,586 warnings. `.vercel/output` was linted despite being generated output. Top 10 files by error count (ties/order from ESLint JSON): |

1. `knotty-app/lib/api.ts` — 200 `@typescript-eslint/no-explicit-any` errors.
2. `knotty-app/.vercel/output/static/_next/static/chunks/17c1kwylixcqd.js` — 35 `@typescript-eslint/no-this-alias` errors (generated output).
3. `knotty-app/.vercel/output/static/_next/static/chunks/0cz1d0mv5g_q7.js` — 10 `@typescript-eslint/no-this-alias` errors (generated output).
4. `knotty-app/app/standalone-tap/page.tsx` — 9 `@typescript-eslint/no-explicit-any` errors.
5. `knotty-app/.vercel/output/static/_next/static/chunks/0x6jp837z1g9q.js` — 9 `@typescript-eslint/no-this-alias` errors (generated output).
6. `knotty-app/app/students/[id]/StudentDetailClient.tsx` — 8 `react/no-unescaped-entities` errors.
7. `knotty-app/components/dashboards/ParentDashboard.tsx` — 7 `@typescript-eslint/no-explicit-any` errors.
8. `knotty-app/app/library/page.tsx` — 5 `react-hooks/set-state-in-effect` errors.
9. `knotty-app/app/workers/page.tsx` — 4 `@typescript-eslint/no-explicit-any` errors.
10. `knotty-app/app/gate-access/page.tsx` — 4 `react-hooks/immutability` errors.

## 6. SECURITY MAP

### Authentication and authorization

- `knotty-backend/src/modules/auth/service.js:41-48` creates signed JWT access and refresh tokens. Access lifetime defaults to `15m`; refresh defaults to `7d`, overridable by environment variables (values not read/reported). The code does not specify an algorithm explicitly. Access tokens include a session id and token id.
- `knotty-backend/src/middleware/auth.js:5-73`, function `authenticate`, requires `Authorization: Bearer`, calls `jwt.verify`, checks Redis session/revocation keys, then reloads the active user and memberships from PostgreSQL on each request. Redis failure returns 503. Login/refresh/logout route definitions are in `knotty-backend/src/modules/auth/routes.js:22-25`.
- Membership/role resolution is exactly in `authenticate` (`knotty-backend/src/middleware/auth.js:45-70`): the active `SchoolMembership` is selected for the token school; active `PlatformMembership` takes precedence; an active organization membership changes effective role when its role is `ORGANIZATION_MANAGER`. School must exist and some effective role must resolve. `authorize(...roles)` in `knotty-backend/src/middleware/rbac.js:1-14` then checks the effective role, with manager roles allowed where `ADMIN` is among endpoint roles. This is role matching, not a separate permission matrix.
- Device/access endpoint requests use the same user bearer JWT: `gate-access/routes.js:6` applies `authenticate` to the entire router. There is no separate gate-device credential verification found. `cards/routes.js:9-10` also requires a user JWT for NFC/card scans. The MoMo webhook uses a configured callback secret header (`cards/routes.js:19-26`), not JWT.
- `gate-access/service.js:165-214` accepts an HMAC-signed secure QR with embedded expiry, and verifies its signature. No one-time nonce/replay cache or consumed-token record was found. Ordinary NFC UIDs are looked up as identifiers; no cryptographic card proof was found. Global rate limiting is installed in `app.js:40`, but `/gate-access/evaluate` has no `transactionLimiter`; route-level transaction limiting exists for selected card and attendance calls. Global production limit is 5,000 requests per 15 minutes, with attendance scan and canteen purchase skipped (`middleware/rateLimiter.js:4-29`).

### Tenant scoping and Prisma calls

Tenant context is assigned to `req.user.school_id` in `authenticate` and most module controllers pass it into services. There is no Prisma middleware or database-level row security enforcing tenant scope globally. A static scan found Prisma operations that omit a direct `school_id` predicate; several are identity/global lookups or ID-based follow-up operations after a tenant-scoped lookup, so omission alone does not prove cross-tenant access. The tenant-data cases that need review are:

- `knotty-backend/src/modules/fees/controller.js:70,73`: student/children lookup by `user_id`/`parent_id`, without `school_id`; `fees/service.js:97-106` then queries fee payments by student id without a tenant predicate. Confirm the parent/student membership and active-school restriction on this path.
- `knotty-backend/src/modules/canteen/service.js:205,211`: transaction list and count by `student_id` without `school_id`; confirm caller-side student authorization and tenant restriction.
- `knotty-backend/src/modules/students/service.js:217-236`: attendance, report, health, discipline and achievement detail queries filter by a previously resolved student id but do not repeat `school_id`. Student lookup at `:199` is tenant-scoped; verify no alternate call path can invoke the detail operation with an unscoped id.
- `knotty-backend/src/modules/cards/service.js:217,223`: wallet transaction list/count by card id after a tenant-scoped card lookup at `:212`; tenant field not repeated on transaction queries.
- `knotty-backend/src/modules/attendance/service.js:250-293`: student/class attendance reads use student/class ids without a direct tenant predicate; controller checks differ by endpoint and must be confirmed for each call path.
- `knotty-backend/src/modules/library/service.js` contains student/book/copy/borrow/reservation queries by record ids and student ids without direct `school_id` clauses (including lines 131, 149, 257, 340, 356, 377, 427, 433, 440, 446, 536, 542, 631). Some are preceded by a school-scoped lookup; not all were proven exploitable from this static review.
- `knotty-backend/src/modules/gate-access/service.js:75,85,121,131,161,371,417` performs update/delete by record id after a school-scoped existence check. The database mutation itself is not tenant-scoped, leaving a check/use gap if records change between operations.
- `knotty-backend/src/modules/academics/service.js:174,183,207,520,526,603` performs enrollment/result queries or mutations by related IDs without direct school predicates. Some flows validate parent section/exam/student records earlier; exact scoping relies on those checks.
- Additional unscoped Prisma calls exist for global identity/membership resolution, school discovery, health checks, and maintenance scripts (`auth/service.js`, `middleware/auth.js`, `schools/service.js`, `utils/fix-teachers.js`, `utils/cardNumberGenerator.js`, `modules/admin/backup.service.js`). These are not treated as tenant data leaks solely because their query lacks `school_id`.

An exhaustive list of every Prisma call lacking a literal `school_id` token would include global identity queries and tenant-scoped records reached by previously validated IDs; that list would conflate intended global lookup with missing authorization. The potentially tenant-sensitive omissions above are the confirmed code locations; exploitability for the call-chain-dependent cases is **NOT FOUND** without execution/integration tests.

### Wallet, fees, payments and refunds

Money amounts are PostgreSQL `Int` in `FeePayment`, `WalletTransaction`, `CanteenTransaction`, `FeeStructure`, `Invoice`, `InvoiceLine`, `Payment`, `RefundRequest`-related transactions and `ExternalPayment` (`knotty-backend/prisma/schema.prisma`). No money `Float` or `Decimal` column was found. (Exam scores are `Float`, not money.)

| Endpoint(s) | Transaction / replay protection |
|---|---|
| `POST /api/v1/cards/:id/top-up` | Creates pending wallet transaction without DB transaction; external MoMo call happens first. |
| MoMo card callback `POST /api/v1/cards/webhook/momo/:referenceId` | `confirmTopUp` uses a DB transaction, but does not mark/check transaction as already applied. Repeated success callbacks increment balance repeatedly (`cards/service.js:182-205`). No idempotency key/unique applied marker. |
| `POST /api/v1/cards/:id/top-up-cash` | DB transaction updates card and writes ledger record (`cards/service.js:255-286`); no request idempotency key. |
| Legacy `POST /api/v1/fees/pay` | `initiatePayment` creates then updates `FeePayment` outside a DB transaction; MoMo verify is not transactional. |
| `GET /api/v1/fees/verify/:momoReference` | Protected by authentication but not role authorization; invoice payment success update and invoice balance increment occur as separate writes, with no compare-and-set/idempotency guard (`fees/service.js:58-80`). Repeated verification may apply payment repeatedly. |
| `POST /api/v1/fees/invoices/pay` via `WALLET` | Card/ledger/payment inserts are grouped in a transaction, but the payment link and invoice update occur afterward, outside it (`fees/service.js:310-352`). No idempotency key and balance is read before the write. |
| `POST /api/v1/fees/invoices/pay` via `MOMO` | Pending payment creation and remote call are not in a DB transaction; completion path above has no idempotency guard. |
| `POST /api/v1/fees/invoices/pay` via cash/bank | Payment insert and invoice amount update are separate, non-transactional writes (`fees/service.js:395-411`). |
| `POST /api/v1/fees/refunds` | Existence check and create are separate; no unique constraint preventing concurrent duplicate requests (`fees/service.js:442-462`). |
| `POST /api/v1/fees/refunds/:id/resolve` | Approved balance/ledger/invoice operations use a transaction, but refund status is checked before and updated after the transaction without atomic status claim (`fees/service.js:468-552`). Concurrent approvals can race. Rejection is a standalone write. |
| `POST /api/v1/canteen/purchase` | Uses a DB transaction for stock, wallet and transaction writes (`canteen/service.js:23-180`); duplicate detection is a five-second recent-transaction heuristic, not a durable idempotency key. |

`ExternalPayment` and `PaymentIntegration` schema models exist, but no endpoint wiring for them was found in the scanned module routes/services. Their operational use is **NOT FOUND**.

### Health, discipline, audit and unauthenticated routes

- Health data endpoints are in `knotty-backend/src/modules/health/routes.js:9-27`. The router globally authenticates. Reads of school records, profiles, immunizations and clinic visits permit `ADMIN`/`NURSE` and, on student routes, `PARENT`/`STUDENT`; writes are limited to `ADMIN`/`NURSE`. Controller checks parent/student ownership for applicable reads (`health/controller.js`). Create/update/delete and selected clinic/profile mutations call `logAction` in `health/service.js`; reads are not audit-logged. The calls are not awaited, so completion is not guaranteed before response.
- Discipline endpoints are in `knotty-backend/src/modules/discipline/routes.js:6-10`. The router globally authenticates. School lists allow `ADMIN`/`TEACHER`/`DISCIPLINE`; student list also permits `PARENT`/`STUDENT`. Create/update are role-restricted to `ADMIN`/`TEACHER`/`DISCIPLINE`. Create/update call `logAction` (`discipline/service.js:33-40,78-87`); reads are not audited; writes do not await audit completion.
- `GET /health` in `knotty-backend/src/app.js:120-141` has no auth middleware and returns database/Redis health status. Public auth endpoints `POST /api/v1/auth/login` and `/refresh-token` are unauthenticated by design and rate-limited. `POST /api/v1/cards/webhook/momo/:referenceId` has no JWT but checks a callback secret header. `POST /api/v1/admin/cron/backup` has no JWT but checks a cron bearer secret (`admin/routes.js:18-31`). Other route groups inspected apply authentication globally or per route.

## 7. DATA MODEL OVERLAP

- `FeePayment` is the legacy school-fee payment record, tied directly to student and school and holding MoMo reference/status/term/type.
- `Invoice` and `InvoiceLine` represent billed amounts and line items; `FeeStructure` supplies fee templates. `Invoice.amount_paid` is a cached/maintained aggregate.
- `Payment` represents invoice payments, optionally linked to an `Invoice`, payer, and one unique `WalletTransaction`. It is used by newer invoice routes.
- `WalletTransaction` is the wallet ledger, tied to card/student/school, with type, amount and before/after balances. Card balance itself is also stored on `KnottyCard.wallet_balance`.
- `ExternalPayment` is a provider-neutral external payment attempt/record with provider and idempotency fields, but no module route/service usage was found.
- `CanteenTransaction` is a purchase record with `items_purchased`, total and balance snapshots; it links to card/student/school and is also accompanied by a `WalletTransaction` deduction.

There is no single enforced source of truth across all flows. `WalletTransaction` is the closest ledger for card-wallet movements, but card balance is separately mutable; `Invoice.amount_paid` is separately maintained; legacy `FeePayment` and newer `Payment` overlap; and canteen purchases have a separate transaction row. Reconciliation rules/guarantees are **NOT FOUND**.

## 8. TOP 15 PROBLEMS

Ranked by likely impact from static evidence. Severity is an assessment, not a claim of demonstrated exploitation.

| Rank | Severity | File:line | Problem |
|---:|---|---|---|
| 1 | critical | `knotty-backend/src/modules/cards/service.js:193-205` | Successful MoMo top-up confirmation increments the wallet on every callback; the transaction is atomic but not idempotent. |
| 2 | critical | `knotty-backend/src/modules/fees/service.js:64-80` | Repeated invoice-payment verification can increment `Invoice.amount_paid` repeatedly; payment status and invoice balance are not updated atomically. |
| 3 | high | `knotty-backend/src/config/mock_redis_db.json:2-4` | Tracked mock Redis data contains credential-like signed tokens and identifiers. Values intentionally omitted; remove from tracked state and rotate signing credentials if they were usable. |
| 4 | high | `knotty-backend/src/modules/fees/service.js:310-352` | Wallet invoice payment commits wallet/card/payment first, then separately links and updates invoice; retry/failure can leave inconsistent money records. |
| 5 | high | `knotty-backend/src/modules/fees/service.js:395-411` | Cash/bank invoice payment and invoice balance update are separate writes, with no idempotency protection. |
| 6 | high | `knotty-backend/src/modules/fees/service.js:468-552` | Refund status is checked before a transaction and marked approved after it; concurrent approvals can refund twice. |
| 7 | high | `knotty-backend/src/modules/fees/controller.js:70-73` | Student/parent fee lookup omits active-school scoping; downstream fee reads use student id only. |
| 8 | high | `knotty-backend/src/modules/canteen/service.js:205-211` | Student transaction list/count filter on student id only and omit school id. |
| 9 | high | `knotty-backend/src/modules/gate-access/service.js:192-214` | Secure QR signature/expiry has no one-time-use or replay record; a valid token can be replayed until expiry. |
| 10 | high | `knotty-backend/src/modules/gate-access/routes.js:6-29` | Gate device evaluation trusts an authenticated staff user token rather than authenticating the device itself; no device secret/signature verification found. |
| 11 | high | `knotty-backend/src/modules/health/routes.js:11,16,20,26` | Parent/student roles can access sensitive health endpoints; ownership checks exist in controllers, but reads are not audit-logged. |
| 12 | medium | `knotty-backend/src/modules/fees/service.js:449-454` | Duplicate refund prevention is a read-then-create check without a unique DB constraint or transaction. |
| 13 | medium | `knotty-backend/src/modules/attendance/service.js:250-293` | Several student/class attendance queries do not include a direct tenant predicate; security depends on every caller’s earlier checks. |
| 14 | medium | `knotty-backend/src/modules/gate-access/service.js:75-85,121-131,371-417` | Tenant check and update/delete are separate; writes then target only global record id. |
| 15 | high | `knotty-app/package.json` / `knotty-backend/package.json` | Production npm audits report respectively 1 critical/4 high/1 moderate and 1 critical/13 high/5 moderate/1 low vulnerability findings. Key critical packages are `next` and `proxy-addr`. |

