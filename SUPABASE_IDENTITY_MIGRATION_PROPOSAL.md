# Supabase Identity and Legacy Account Migration Proposal

**Status:** Proposal only; no identity or production changes are authorized or included here.  
**Architecture decision:** Supabase Auth is the primary authentication authority. Supabase PostgreSQL owns new core school, student, staff, academic, attendance, and card records. Express remains temporarily responsible for unmigrated legacy modules. Every business workflow has one write owner at a time; no uncontrolled dual writes are permitted.

## 1. Current identity boundary

The legacy Prisma `User` has a string UUID `id`, one unique email, optional phone, a password hash, a school and a role. Express issues and verifies its own JWTs, checks Redis session/revocation state, then reloads the user and active Prisma memberships. The current frontend login fallback can manufacture a local identity and infer `ADMIN` from an email prefix; that behavior must be removed before Supabase Auth becomes the only login authority (audit AUTH-01).

Supabase models identity as `auth.users.id` linked to `public.persons.auth_user_id`, then school/organization/platform memberships and scoped role assignments. The Supabase UUID is the stable authenticated subject. A legacy user ID must not be treated as a Supabase Auth UUID just because both happen to be UUID-shaped.

## 2. Identity mapping model

Add an additive, non-exposed mapping table in the private schema, for example `private.legacy_identity_links`:

| Field | Purpose / invariant |
|---|---|
| `source_system` | Fixed identifier such as `express_prisma`; never supplied as an authorization claim. |
| `legacy_user_id` | Exact original `User.id` string, stored without rewriting the legacy row. |
| `auth_user_id` | FK to `auth.users(id)`; the verified Supabase principal. |
| `person_id` | FK to `public.persons(id)`; must be the person whose `auth_user_id` equals `auth_user_id`. Enforce using a composite FK where feasible. |
| `link_status` | `pending`, `active`, `quarantined`, or `revoked`; only `active` links may authorize legacy API access. |
| `link_method` | Audited value such as `verified_contact`, `assisted_recovery`, or `approved_duplicate_resolution`. |
| audit fields | `linked_at`, `linked_by`, and a non-sensitive case/reference ID. Do not copy password hashes or raw verification tokens. |

Constraints should make `(source_system, legacy_user_id)` unique. Multiple old IDs may map to one Auth identity only after an explicit duplicate-resolution decision. A given legacy ID may never map to two Auth identities. The mapping is private, RLS-enabled and forced, and unavailable through direct Data API table access. A narrow authenticated RPC may return the caller's own legacy ID for legacy operations; a different RPC may authorize a requested legacy permission and school. Do not expose an arbitrary-user lookup RPC to authenticated clients.

`auth.users.id` is the principal; `persons.id` is the application person; `legacy_user_id` is a compatibility key for Express-owned rows. Keep the three identifiers distinct in types, logs, and APIs. Legacy IDs remain stable and foreign keys in the Prisma database are not rewritten during initial linking.

## 3. Account inventory, matching and recovery

Run a read-only inventory before creating or linking accounts. Produce counts and a restricted remediation queue, not a bulk export of credentials or contact data. Normalize email by trim/lowercase and phone to E.164 for duplicate detection; preserve original values. Classify each account by active status, verified-contact evidence, school memberships, roles, and duplicate candidates.

| Case | Resolution |
|---|---|
| One active legacy user, unique verified email/phone, no conflicting Supabase identity | Require a valid legacy sign-in during the migration window and successful Supabase OTP verification of the same contact. Link only after both proofs succeed. |
| Contact matches an existing Supabase user but the legacy owner cannot prove control | Do not link based on an email/phone string or administrator assertion alone. Quarantine and use assisted recovery. |
| Case/format variants or multiple legacy rows share one contact | Quarantine all candidates. Verify the human and memberships; choose or create one Auth identity; retain all legacy IDs as separately audited links only after explicit duplicate resolution. Never union roles automatically. |
| A legacy user maps to multiple existing Supabase Auth accounts | Do not merge Auth users automatically. Verify control of both or use assisted recovery; choose a canonical Auth identity; preserve the non-canonical account until its sessions, owned records, and relationships are reviewed. |
| No usable email/phone or contact cannot be verified | Require a documented, two-person assisted-recovery process with independent identity evidence and school/organization authority checks. Capture a case reference and audit actor. Then collect and verify a new contact. Do not use knowledge questions or let an ordinary school role attach an arbitrary account. |
| Inactive legacy user, departed member, conflicting school/organization roles | Do not activate or import memberships merely to complete identity linking. Link may remain quarantined; reconcile status and scope before any membership is activated. |
| Student/guardian/staff person already exists in Supabase without an Auth account | Attach only after the same proof and uniqueness checks. Preserve person and relationship IDs; do not create a duplicate person. |

Never migrate Express password hashes into Supabase Auth. Require the user to set a new Supabase credential or complete a verified passwordless flow. Reset links and OTPs must be single-use, short-lived, rate-limited, delivered to a verified contact, and excluded from logs. Privileged and assisted recovery paths require audit records and support escalation; support staff cannot assign roles by changing metadata.

## 4. Membership and role import

The primary source for new roles and permissions is Supabase's scoped membership/role model. Do not put a trusted role or school authorization in user-editable Auth metadata. Supabase RLS/RPCs derive `auth.uid()`, active membership, role, permission, and target school from database rows for each protected operation.

Import legacy memberships additively and idempotently after identity-link review. Use an explicit legacy-role-to-scoped-role mapping, preserving school and organization boundaries. Ambiguous roles, platform-level assumptions, multiple active-school conflicts, and roles that do not map one-to-one go to a review queue. Do not union privileges from duplicate accounts. Keep import provenance and original legacy IDs in a protected audit/reference record. Do not run concurrent role writes in Prisma and Supabase; after a cohort is cut over, Supabase is the sole writer for its roles.

For legacy modules during the transition, Express may use the legacy ID only to satisfy existing Prisma foreign keys. It must obtain the active school and permission from the canonical Supabase database for the authenticated Supabase subject. A compatibility RPC must verify the caller via `auth.uid()`, require an active identity link and active school membership, and check the requested permission. The submitted school ID is a selector only and must be validated by that RPC on every request. Do not trust Prisma `User.role`, request body role/school fields, stale JWT claims, or cached role state as authorization.

## 5. Express transition contract

For migrated core workflows, the frontend calls Supabase Auth and the Supabase service/RPC/Edge Function path directly under the Supabase session; Express must not write those core records.

For an unmigrated Express module:

1. Accept only `Authorization: Bearer <Supabase access token>` on the new compatibility path.
2. Verify the token with Supabase Auth `getUser(token)` or a reviewed JWKS verifier that validates signature, issuer, audience, expiry and key rotation. Also verify the Auth user remains active and resolve membership/permission from Supabase; signature verification by itself does not handle immediate role revocation.
3. Resolve the mapped legacy ID using a caller-bound Supabase RPC. Never accept a legacy ID from the client as identity.
4. Resolve the selected school and route permission through Supabase on every request. Derive the allowed legacy actor ID and role context server-side.
5. Use that verified context only to perform the legacy module's Prisma-owned operation. Keep authorization and data access in one request path and record the Supabase actor plus legacy compatibility ID in the legacy audit event where supported.
6. Fail closed on Supabase/Auth/RPC unavailability for protected requests. Return `401` for invalid/missing identity, `403` for valid identity without scope/permission, and `503` when the authoritative authorization service is unavailable. Never fall back to a demo user or a legacy role claim.

During a short, explicitly measured compatibility period, existing Express JWT sessions may remain enabled only on legacy routes for users not yet migrated. Keep them on a separate, visibly temporary middleware path with the current revocation checks; do not let a legacy token call Supabase core workflows. Once a user is linked, prefer Supabase tokens; never accept whichever of two tokens happens to be present. Set a dated cohort deadline and telemetry before retiring legacy-token acceptance.

## 6. Session, token, school selection and logout lifecycle

- Sign-in occurs through Supabase Auth using PKCE for redirect flows or the selected verified email/phone/password flow. There is no local login success fabricated after network or credential failure.
- Restore the Supabase session through the Supabase client/SSR integration and validate the current user. The UI role and school list are fetched from server-authorized membership queries/RPCs; cached UI state is display-only.
- Supabase access tokens are short-lived bearer credentials; the Supabase client manages refresh-token rotation. Do not persist the legacy Express JWT/refresh token after cutover, and do not place the service-role key in browser code.
- Pass the current Supabase access token to Express only for routes in the compatibility window. Express does not mint a second identity token.
- School switching changes the requested tenant context, not the user's authority. Each server request revalidates active membership and route permission for that school; do not derive school access solely from a local-storage value or token claim.
- Logout clears in-memory data, query caches, and the local Supabase session. Use local scope for this device by default; offer global sign-out for account compromise or explicit “sign out all sessions,” and revoke refresh sessions as part of disable/recovery. Express compatibility requests are stateless with respect to Supabase tokens, so each call is revalidated; legacy Redis session records are retired only after legacy-token acceptance ends.
- On account disable, link revocation, membership termination or role revocation, deny subsequent RPC/API calls from database state immediately. Do not rely on waiting for an access token to expire.

## 7. RLS and RPC review gates

Before cohort rollout, test representative students, guardians, teachers, managers and platform/organization actors across at least two schools and organizations. Verify both allowed operations and cross-tenant denial, revoked membership, inactive person, wrong school, duplicate links, and attempted tenant reassignment.

Every authenticated user RPC must derive the actor from `auth.uid()` or strictly bind an explicit actor to a service-role-only server workflow. `SECURITY DEFINER` functions must retain an empty `search_path`, explicit owner, minimal execute grants, input validation, tenant predicates and audit effects. Service-role-only functions must not become browser-callable to accommodate Express. Keep raw card identifiers and credential digests private; device scans remain separately authenticated by device credential and school scope. No RLS policy or constraint is relaxed to make the identity transition pass.

## 8. Migration sequence and rollback boundaries

1. **Inventory and freeze ownership.** Capture counts and duplicate/missing-contact classifications. Mark each workflow's current writer (Express/Prisma or Supabase). Stop adding new dual-write paths. No production mutation in this phase.
2. **Prepare Auth and compatibility design.** Confirm redirect URLs, email/SMS delivery, rate limits, token verification method, exact trusted origins, support recovery policy, and metrics. Remove fabricated-admin fallback and switch login/session restoration only in a separately reviewed frontend release.
3. **Add identity-link schema and RPCs.** Create the private mapping table, constraints, append-only link audit, narrow caller-bound resolver/authorization RPCs, explicit grants and pgTAP coverage in an additive migration. Initially keep links disabled/pending; no existing user rows are deleted or rewritten.
4. **Dry-run duplicate resolution.** Compare normalized legacy contacts and existing Supabase contacts with a privacy-preserving report. Human-review duplicate, unverified, inactive, and missing-contact cases. Do not auto-create Auth users based only on a database match.
5. **Link a pilot cohort.** Require proof of the legacy account and verified Supabase contact, or the documented assisted-recovery process. Create/link `auth.users` and `persons` through a trusted server flow, then insert one idempotent mapping and audit record transactionally after Auth Admin creation. Compensate a failed SQL link by deleting only a newly created, still-unlinked Auth user; never delete an existing account.
6. **Import and review memberships.** Backfill candidate school/org memberships and role assignments as pending or inactive first. Validate exact school and actor scopes; approve role mapping; activate in a separate audited step. Compare counts and permission outcomes before enabling access.
7. **Enable Supabase token compatibility for legacy routes.** Roll out a middleware version that validates Supabase tokens and calls the caller-bound resolver. Initially allow the time-boxed legacy-token path only for unmigrated users/routes. Instrument failures and fail closed; avoid a frontend route fallback that silently writes elsewhere.
8. **Cut over one workflow/cohort at a time.** Stop Prisma writes for each core domain before enabling its Supabase write path. Keep legacy records read-only or explicitly owned by Express until their own migration is accepted. Reconcile counts and audit effects; do not dual-write.
9. **Retire legacy authentication.** After all required accounts are linked and legacy-token use reaches zero for the agreed period, disable legacy login/refresh issuance, revoke remaining legacy sessions, remove the old JWT secret path, and later delete password hashes only under an approved retention/data-erasure plan. This is a separately approved destructive step and is outside this proposal.

Rollback before a domain cutover means disable the new route/cohort flag while keeping additive identity links, audit rows, Auth users, and existing legacy records intact. Do not drop mappings, delete Auth users, reverse memberships, or run account-wide cleanup as automatic rollback. After a domain cutover, rollback requires an explicit reconciliation plan because the Supabase domain is the sole writer.

## 9. Required release evidence

Before implementation is approved, provide:

- A redacted inventory showing duplicate, missing-contact, inactive, and already-linked account counts.
- Approved role mapping and conflict-resolution policy.
- Exact legacy-route list and per-route authorization permission contract.
- Local pgTAP tests for link uniqueness, caller-only resolution, inactive/revoked link denial, active membership checks, cross-school denial, and no privilege union across duplicate links.
- Express unit/integration tests for invalid/expired/revoked Supabase sessions, Auth/RPC outage fail-closed behavior, missing link, wrong school, and valid legacy compatibility access.
- Rollback owner, cohort feature flags, support recovery procedure, audit retention, and success metrics.

## 10. Audit linkage and non-goals

This proposal addresses audit findings AUTH-01, AUTH-04, API-01 through API-03, and ARCH-01. It does not change authentication code, create identity records, change migrations, migrate account data, modify frontend files, or contact production. The attendance timezone, scan CORS/outcome, and Edge dependency work in remediation batch 2 is separate and does not authorize an identity cutover.
