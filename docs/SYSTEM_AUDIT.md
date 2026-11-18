# IshuriHUB system audit

**Review date:** 2026-10-05  
**Scope:** Static review of authentication, demo/data paths, canteen payments, school scoping, environment and rate-limit behavior. This is a code review, not a penetration test or a full review of every API route.

## Changes made

### Removed the shared-password authentication bypass

`knotty-backend/src/modules/auth/service.js` previously accepted four public sample passwords for any active account whenever bcrypt rejected that account's stored password. The bypass is removed; only the stored password hash can authenticate an account.

The database seed contains public demo credentials and sample records. `knotty-backend/prisma/seed.js` now refuses to run when `NODE_ENV=production`. The login quick-pick panel, offline demo login, and mock API responses are development-only; a stale browser demo flag cannot activate them in production. Local demo sessions show a persistent sample-data notice.

### Made canteen purchases use the school catalog

`knotty-app/app/canteen/page.tsx` previously showed hard-coded sample products in normal sessions, and sent browser-supplied prices to the API. The sample catalog is now shown only in local demo mode. Normal sessions show an empty-catalog message until products are configured.

`knotty-backend/src/modules/canteen/service.js` now requires active products from the caller's school, uses catalog prices for totals and receipts, and decrements tracked stock atomically. Browser-supplied prices are ignored. The purchase UI displays the server-confirmed total.

The daily spending-limit check now runs after the transaction acquires the card-row update lock, so two simultaneous purchases cannot both pass using the same remaining limit.

### Scoped student records to their school

Health and discipline lookups previously queried records by student ID alone. Achievement lookups had the same issue and permitted every authenticated role. The affected queries and writes now check school ownership; student and parent reads also verify the relationship. Achievement reads are limited to administrator, teacher, student, and parent roles.

Fee-payment status lookup is now school-scoped. Transaction limiting no longer excludes all `/health` routes, and card scans and purchases remain covered by the transaction limiter.

## Remaining high-priority work

1. **Redis is replaced by in-memory storage in production.** `knotty-backend/src/config/redis.js` chooses `mockRedis` whenever `NODE_ENV=production`. Token revocation, refresh-token state, and login lockout therefore do not have reliable shared storage across restarts or multiple instances. The `/health` check reports the mock as healthy. Production should require a real Redis connection and report degraded health when it is unavailable.

2. **Rate limits are per process and permissive.** `express-rate-limit` uses its default in-memory store; the general limit is 5,000 requests per 15 minutes and transaction routes allow 300 per minute. Multiple instances do not share counters. Use a shared store and set limits based on expected school traffic and abuse scenarios.

3. **School switching has network-wide authority.** `POST /schools/switch` accepts any school ID for any `ADMIN`; the data model reviewed has a single `user.school_id` and no visible school-membership/central-admin distinction. If school administrators should be isolated, this allows cross-school access. Decide whether `ADMIN` means network administrator; otherwise add school memberships and authorize the target school before minting a switched token.

4. **MoMo status checks still need actor-level ownership checks.** They now filter by school, but an authenticated user in that school can still request a known payment reference. Confirm which roles may poll payment status and bind the reference to its initiating student, parent, or finance user.

5. **Production configuration validation is not fail-fast.** `knotty-backend/src/utils/validateEnv.js` reports some missing variables only as warnings and does not reject short JWT secrets or malformed encryption keys. Startup should refuse production configuration that lacks required security values.

6. **The database may already contain sample or manually entered records.** Code changes do not clean existing database rows. Review the current school records before treating visible names, offenses, wallet balances, payments, or materials as verified real data. Do not rerun the seed against a database with valuable records; it deletes and recreates sample data.

These recommendations follow OWASP's deny-by-default and least-privilege guidance, including checking authorization against the specific object and tenant on each request: [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/).

## Verification performed

- `node --check` passed for the changed backend JavaScript files.
- Local frontend pages `/canteen` and `/discipline` returned HTTP 200.
- Local backend `/health` returned HTTP 200 with database and Redis checks reporting healthy. In this development run, Redis uses the in-memory fallback, so this does not establish production Redis reliability.
- The development health endpoint currently reports Redis as healthy while the in-memory fallback is active; that status is misleading and is included in the Redis follow-up above.
- No automated test suite or production deployment was run.

## Multi-school and integration foundation (2026-10-05 follow-up)

Implemented additive organization, branch, school-membership, organization-membership, platform-membership, per-school payment configuration reference, taxpayer profile, fiscal document, and privacy request schema. Existing school users are backfilled to their existing school with their current role; platform owner access is granted only by an explicit provisioning script. Login and school switching now require a per-session Redis record and active tenant membership; school membership, role, and account activation are rechecked from PostgreSQL on each request. Refresh tokens are session-scoped and rotate; logout revokes that session. School-scoped membership management and organization setup routes were added. Teacher access to sensitive health records was removed; student/parent self or child checks remain. Timetable creation now validates times and school ownership of class, subject, and teacher, and checks class, teacher, and room overlap.

Production now refuses the in-memory Redis fallback, fails startup on required security configuration problems, and fails closed when session/revocation storage is unavailable. New school setup no longer creates stale demo-year classes.

The local additive migrations were applied and Prisma Client generated. The schema validates and `prisma migrate status` reports up to date. JavaScript syntax checks passed. No full authorization, concurrency, payment-provider, RRA certification, privacy compliance, or penetration test was performed. The payment configuration/fiscal records are integration foundations; only the existing MTN adapter is present, and its callback/top-up idempotency still needs remediation before production. Airtel, bank, RRA VSDC/OSDC, formal privacy-request workflows, robust timetable concurrency constraints, and student/teacher dashboard assignment coverage remain follow-up work.
