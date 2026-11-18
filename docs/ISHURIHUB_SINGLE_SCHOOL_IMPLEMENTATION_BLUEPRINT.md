# IshuriHUB Single-School Implementation Blueprint

**Status:** Architecture contract; implementation has not been performed by this document task. **Updated:** 2026-11-02. **Authority:** Axel's approved product decisions. **Scope:** one configured school, fresh operational start, full feature set retained, Supabase Auth as the intended future identity/session authority. This document supersedes legacy-account migration assumptions in `SUPABASE_IDENTITY_MIGRATION_PROPOSAL.md`; it does not authorize rewriting/deleting historical proposals, migrations, records or code.

## 1. Executive summary

The repository has a substantial but partial Supabase foundation: person identity, one active school membership per person, scoped role/permission records, school/student/staff/academic data, attendance, cards and trusted workflow RPCs. Retain and extend these assets. The approved architecture removes the previous multi-school/legacy-user migration objective: no legacy users or operational records are imported, no school switching is offered, and exactly one configured school must be enforced below the UI.

The running product is not yet on this target. `knotty-app/context/AuthContext.tsx` calls Express login/session/logout, restores a localStorage user, supports school switching and includes a development demo identity path. `knotty-backend/src/middleware/auth.js` validates the separate Express JWT and Prisma membership. Supabase Auth is not wired into the frontend session lifecycle. Core Supabase modules are partial; many planned modules remain Express/Prisma-owned. A table or RPC is not evidence of complete end-to-end security.

The major unresolved issue is student login and recovery when the student has no individually controlled email/phone. Official Supabase docs document password sign-in by email or phone. Supabase passkey registration requires an existing confirmed account; passkey sign-in requires confirmed email/phone. The reviewed docs do not establish a native username/password flow that solves this. Do not invent fake email, shared credentials, parallel password storage, or guardian impersonation. Axel must select a viable individually-owned bootstrap and recovery method before implementing student accounts.

## 2. Confirmed product decisions

- One configured school per deployment. Keep `school_id` FKs, composite tenant-integrity constraints and audit ownership; no multi-school user experience, organization administration, platform administration or switching.
- Retain every planned feature listed in the task. Phasing implementation is not feature deletion.
- Fresh school data start: no legacy Express user, student, staff or operational data import. This is not permission to reset or destroy the existing local database or history.
- Supabase Auth is intended as the only user authentication/session issuer. Authorization comes from trusted database records, enforced on server and RLS.
- Every student has an independent account even without personal email/phone. Admission number is never a password. Guardian gets a separate account and child-scoped permissions, never student impersonation.
- Only School Administrator may create/provision staff accounts or assign initial staff roles; database and trusted server paths must enforce it.
- Administrator MFA is optional, with enrollment, verification, recovery, device change, removal and audit protection.
- Custom roles use approved permission keys and delegation boundaries. Guardians require verified identity, student-specific invitation/acceptance, Admin/Registrar approval, explicit child-level permissions and auditable revocation.
- No fabricated identities/privileges, no browser-trusted role/school, no service-role key in browser, no RLS bypass, no silent fallback or dual writes.

## 3. Repository findings and evidence status

| Area | Verified source and implementation | Gap / interpretation |
|---|---|---|
| Identity | `supabase/migrations/20261031111719_core_identity_tenancy.sql`: `public.persons.auth_user_id` unique FK to Auth; private identity/contact tables; historical school memberships; unique partial index for one active membership globally; RLS and no direct writes. | Also creates organizations, platform memberships and organization memberships, outside approved runtime. Current contact uniqueness is per-person, not global across persons. |
| Roles | `20261031124440_scoped_roles_permissions.sql`, `20261031135147_seed_scoped_permissions_and_role_workflows.sql`: private catalog, role permissions/delegation and school membership roles; `private.has_school_permission`; `assign_scoped_role`, `revoke_scoped_role`, `list_scoped_role_assignments`. | Multiple scopes remain. Full delegation ceiling, custom role CRUD and final complete permission matrix are not verified. |
| School and academics | `20261031132348_school_management_foundation.sql`, `20261031135923_trusted_school_provisioning_workflows.sql`: settings, academic years/terms/calendar, `provision_school`, profile/settings and academic setup workflows. | Schema allows multiple schools; runtime `provision_school` must become a locked one-time bootstrap or otherwise be fenced by additive migration. |
| Student/guardian | `20261031132853_student_lifecycle_and_guardians.sql`, `20261031140441_student_registration_enrollment_and_guardians.sql`: student records/documents, guardian relationships/permissions/requests/audit; RPCs include `register_student_from_edge`, `activate_student_account`, student lifecycle/profile/enrollment and guardian request/accept/approve/revoke/permission/profile functions. | Student Edge flow requires contact and OTP. `activate_student_account()` exists but `provision-student/index.ts` does not call it. Guardian RPCs lack verified complete frontend flow. |
| Staff | `20261031132650_unified_staff_management.sql`, `20261031141112_staff_and_academic_workflows.sql`: staff and teacher records, `register_staff`, `update_staff_status`, assignment/subject workflows. | `register_staff` creates domain record but not Auth account; it is executable by authenticated and must be effectively gated to the school admin workflow. |
| Attendance/cards | `20261031133926_attendance_engine_foundation.sql`, `20261031134025_school_scoped_card_lifecycle.sql`, `20261031141234_trusted_attendance_workflows.sql`, `20261031141659_trusted_card_lifecycle_workflows.sql`; Edge Functions `process-attendance-scan`, `issue-card`, `replace-card`. | Useful transactional/idempotent foundations; device credentials must remain separate from user identity. Verify every grant, error and retry path. |
| Student provisioning Edge | `supabase/functions/provision-student/index.ts` validates bearer through `auth.getUser`, checks `can_register_students`, creates Auth user using server-held service role, calls restricted `register_student_from_edge`, attempts compensation, then sends OTP. | Requires `school_id` selector and contact; cross-service partial result requires reconciliation. No browser service key. It does not demonstrate a complete account activation/login UI. |
| Frontend | `knotty-app/lib/supabase/{client,server,admin}.ts`, `services/*`, `database.types.ts`; versions Next 16.2.7, `@supabase/ssr` 0.12.7, supabase-js 2.118.0. `context/AuthContext.tsx`, `app/login/page.tsx`, `components/DashboardShell.tsx`, `Header.tsx`, `Sidebar.tsx`, `lib/api.ts`. | Auth context is still legacy/localStorage/demo/school-switching; client-side route gate is not a security boundary. No `proxy.ts` found in repository tree. `admin.ts` depends on `SUPABASE_SERVICE_ROLE_KEY` and must remain server-only. |
| Express | `knotty-backend/src/middleware/auth.js`, `middleware/rbac.js`, `modules/auth/{routes,service,controller}.js`; mounts in `src/app.js`. | Own JWT_SECRET, Redis sid/revocation and Prisma user/membership are current auth authority; does not validate Supabase JWT. Static role-array RBAC is not the target granular DB permission authority. |
| Legacy modules | `knotty-backend/src/app.js`, `src/modules/*`, `prisma/schema.prisma` and `prisma/migrations/*`. Mounted routes include students, staff, academics, attendance, fees, canteen, health, discipline, achievements, reports, cards, gate, library, materials, notifications, schools and admin. | Presence is verified; security of all route implementations is not asserted. Most modules lack corresponding objects in reviewed Supabase migrations and remain legacy-owned. |
| Tests/config | `supabase/tests/database/000_local_environment_test.sql` through `014_card_lifecycle_workflows_test.sql`; backend `src/config/*.test.js`; Edge tests; `knotty-app/lib/testing/systemTests.ts`. `supabase/config.toml` local Auth signup enabled, email confirmation disabled, phone signup/confirmation disabled. | Existing test files do not prove comprehensive Auth/module coverage. Local settings do not establish hosted settings. Tests were not run for this blueprint task. |

`SUPABASE_IDENTITY_MIGRATION_PROPOSAL.md` proposes legacy identity linking/import and temporary Express compatibility. Those proposals conflict with the approved fresh-start decision and are superseded for future work by this blueprint. Keep historical file and migration history; do not use them as current requirements.

### Instructions and sources reviewed

No repository-root `AGENTS.md` was found. `knotty-app/AGENTS.md` was read. Required `.agents/skills/supabase/SKILL.md`, `.agents/skills/supabase-postgres-best-practices/SKILL.md`, `.agents/skills/ishurihub-engineering-standards/SKILL.md`, `skills-lock.json`, changelogs and relevant Postgres references were present and reviewed. Supabase skill lock points to `supabase/agent-skills`; versions read: Supabase 0.1.9, Postgres 1.6.0. No required skill was missing.

Official current technical references: [Supabase password Auth](https://supabase.com/docs/guides/auth/passwords), [Passkeys](https://supabase.com/docs/guides/auth/passkeys), [MFA](https://supabase.com/docs/guides/auth/auth-mfa), [TOTP MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp), [Next.js server-side Auth](https://supabase.com/docs/guides/auth/server-side/nextjs). The no-contact conclusion is based on those documented requirements, not an assumption that undocumented APIs do not exist.

## 4. Target single-school architecture

1. **Next.js 16:** Auth via `@supabase/ssr` browser/server clients and supported `proxy.ts` session refresh. Server components/actions/route handlers verify the request identity. UI access context is for display/navigation only. No cached browser identity as authority.
2. **Supabase Auth:** sole end-user identity/session authority; PKCE for redirects, verified contact where used, restrictive redirect allowlist, rate limiting/abuse controls. Auth metadata never grants role/school.
3. **Supabase PostgreSQL:** source of truth for new-school identities, memberships, role permissions, module data, lifecycle and audit. RLS protects exposed relations; narrow transactional RPCs handle sensitive/atomic writes.
4. **Edge Functions:** only for Auth Admin account provisioning, approved invitations, device/NFC authentication, external providers/webhooks. Verify caller Auth identity and current DB permission before privileged work. Service role stays server-side and is not used as an RLS workaround.
5. **Storage:** private buckets for student/health documents, report cards, restricted learning materials and evidence. Policies bind school/entity/document class to caller permissions. Issue short-lived signed URLs only after current authorization; no sensitive public buckets.
6. **Express/Prisma:** retain each not-yet-migrated module with one explicitly named owner. Migrate incrementally; do not dual-write and do not silently fall back to Express when Supabase fails. Legacy auth is retired only after dependents are migrated.
7. **Realtime:** only where justified; authenticated JWT/RLS filtering tested. Not a permission source.

### Enforce exactly one configured school

Keep `school_id` FKs and composite constraints. Add an additive single-row deployment school configuration with fixed key and unique configured `school_id`, plus a guarded one-time provisioning RPC/constraint/trigger. Deny business access until exactly one school is configured. Every protected RPC validates the configured school; supplied `school_id` is only an untrusted selector. Runtime users cannot create a school or switch context. Keep `provision_school` only behind the locked one-time setup path or fence its grant through a new additive migration. Do not delete school rows or historical migrations. Tests must prove second-school creation fails even when bypassing UI.

## 5. Identity and authorization contract

### Model

- `auth.users.id`: authentication principal.
- `public.persons`: human identity, uniquely linked to one Auth UUID; status active/inactive/merged. Matching contact text alone never links identities.
- `private.person_private_identity`, `private.person_contact_points`: private legal/contact fields, minimal retention, verified evidence and carefully designed global uniqueness for verified login identifiers. No direct Data API access.
- One historical `public.school_memberships` chain per person with invited/active/suspended/revoked status. Exactly one active school membership.
- `student_records` and `staff_records`: domain identities related through the person/membership and school composite FKs. Both domain status and account/membership status must permit access.
- Guardian relationship: separate guardian person/account, one student per relationship, invitation/acceptance/approval status, explicit child permission rows and revocation history.
- Private permission catalog, role-permission map, custom school roles, membership-role assignments, delegable-role matrix and protected permission keys.
- Audit actor derives from `auth.uid()` to person/membership; trusted server operations bind to verified initiating caller and retain request/correlation ID.

### Caller-bound `get_my_access_context()` RPC

Add a caller-bound RPC with **no user ID, school, role or permission parameters**. Resolve `auth.uid()` internally, then active person, configured school, active membership, domain identities, active assigned roles and their current permission keys. Return only caller's minimal display profile, membership status, role labels/keys, permission projection and own student/staff identifiers. Reject absent caller, inactive/merged person, missing/revoked/suspended membership, wrong/unconfigured school or invalid role state. Do not return private contacts, private identity, other users or broad rosters. Fix owner and `search_path = ''`; grant only to authenticated; no anon/service-role execute unless a separately reviewed server case requires it. pgTAP proves each denial and no private data leak.

This context is never authorization proof cached by React. Each RLS policy, protected RPC, Edge Function and Express endpoint independently checks current DB status, role/permission, configured school and target-row relationship. Do not trust `localStorage`, URL/body role, supplied school/user/student IDs, Auth metadata or stale cached permissions.

### Revocation and lifecycle

A still-unexpired access JWT may remain cryptographically valid after account/role changes. DB-backed RLS/RPC checks must deny the next operation immediately after revocation commits. Every API/Edge protected call must likewise resolve current state, not just verify JWT signature. Refresh-token revocation and browser logout are not substitutes for current authorization checks. Existing signed URLs cannot be revoked before expiry; use very short expiry for sensitive files and prevent issuing new URLs to suspended users.

Person inactive/merged, membership suspended/revoked, role revoked/inactive, student suspended/inactive/graduated per approved policy, terminated staff, or expired/revoked guardian relation all deny new operations immediately. Keep domain records historical. A return should use an explicit audited transition/new membership, never silent privilege restoration. Student graduation may get restricted alumni access only after separate approval.

## 6. Authentication lifecycle and onboarding

### Initial administrator

No public self-sign-up for privileged users, no seeded/default admin, no hard-coded credentials and no email-prefix inference. Use a one-time operator-controlled bootstrap secret outside browser code; verify the named person's controlled contact, provision Auth user/person/membership/admin role server-side, audit, invalidate the secret and make subsequent calls fail. Define Auth-vs-DB partial failure recovery without deleting existing Auth accounts. Axel must name the bootstrap owner and recovery authority before implementation.

### Student onboarding and contactless tradeoff

1. Registrar/Admin creates the student domain record with normalized unique admission identifier, minimal identity evidence and idempotency key. Admission number is not a password or recovery proof.
2. Trusted provisioning creates distinct Auth identity/person link and pending membership/student record. Existing `provision-student` Edge and `register_student_from_edge` are starting points, but currently require contact and OTP.
3. Account activation derives `auth.uid()`, verifies the exact pending student-person/Auth link and evidence, then atomically activates required records and audits. `activate_student_account()` exists but the current provisioning Edge does not call it; validate it before reuse.
4. Use student-owned verified credential recovery when contact exists. For younger/no-contact users, recovery requires approved supervised re-proof; guardian may verify a relationship and approve process but never receive password or impersonate the student. Audit, rate-limit, notify separate contacts and make recovery session-revoking.
5. Duplicate prevention at DB level for admission ID and account linkage; retries reconcile Auth+DB partial outcomes rather than making duplicate people/users.

**Unresolved design:** Supabase password Auth uses email or phone; passkeys require a previously confirmed account and confirmed email/phone. A passkey may reduce ongoing contact-channel use but does not solve bootstrap/recovery. Candidate: a real school-managed mailbox uniquely assigned to each student, only if account access cannot be reassigned/leaked and ongoing recovery is operationally supported. Alternative: an approved external identity provider with independent student identifiers federated to Supabase, accepting its extra credential authority/operations. A supervised in-person recovery process may complement either. Axel must choose; until then do not invent fake emails, shared credentials or a parallel unreviewed password store.

### Staff accounts

Only School Administrator may invite/provision staff. Edge verifies caller through `auth.getUser` and current permission; SQL independently checks administrator permission, configured school, target and role delegation, deriving actor from `auth.uid()`. Create/invite Auth account server-side to verified staff channel, create/link person and staff row, set invited membership, assign only permitted initial role, require acceptance/verification, then activate. `register_staff` currently creates domain data, not Auth identity, and is granted to authenticated; do not equate it with account provisioning. Suspension/termination disables access and preserves history.

### Guardian relationships

Guardian gets their own verified account invitation. Request/invite is student-specific, expiring, single-use opaque token (store hash only). Acceptance proves guardian's account/contact control. Admin or Registrar reviews independent evidence and approves; matching email/phone or data supplied by a student is insufficient. Set explicit per-child permission keys with least privilege; health, discipline, financial, unpublished grades and documents default denied. RPCs for `create_guardian_link_request`, `accept_guardian_link_request`, `approve_guardian_link_request`, `revoke_guardian_relationship`, `set_guardian_relationship_permission`, `get_guardian_student_profile` are useful existing foundations, but require UI/Edge integration and tests that acceptance cannot self-approve.

### Login, session, logout, recovery

- Use verified email/phone/password or approved verified flow; PKCE redirect; generic errors; rate limits and correct redirect allowlist.
- Integrate `@supabase/ssr` and Next `proxy.ts` for cookie refresh. Validate identity via server `getClaims` or fresh `getUser`; `getSession` is for token access, not authorization. Auth responses must not be shared-cached across users; use appropriate private/no-store behavior. Recheck exact installed API during implementation because SSR APIs evolve.
- Restore validated session and access context; never restore roles from localStorage. Clear in-memory/query state on account change/logout.
- Logout calls Supabase sign-out and clears local cookies/session/client caches. Global sign-out/revocation for compromise. If Auth is unreachable, clear local state but communicate remote revoke uncertainty; DB status still blocks revoked accounts.
- Recovery only to confirmed channel; short-lived one-use token, rate-limited generic responses, rotate/revoke sessions, notify and audit. Support cannot set/view password.

### Optional administrator MFA

Use Auth TOTP enroll → challenge → verify; count factor only after successful verification. Support multiple enrolled factors as backup: official docs say recovery codes are not supported. Require recent reauthentication/current factor for device changes or removal. Lost-factor process needs independent identity proof and high-trust audited approval; never email-only reset for privileged admin. Notify on changes. Keep MFA optional overall unless Axel changes it; if selected high-risk actions require AAL2, enforce it on server/RLS, not UI alone.

### Custom roles

Keep role catalog foundation but reduce runtime scopes to school. Define stable reviewed permission keys by module and action. Custom role UI may select only `custom_assignable` approved keys, excluding Auth/bootstrap, permission-catalog mutation, audit alteration and top-level delegation. Actor may delegate no permission beyond own explicit ceiling; prevent self-assignment/escalation, built-in role edits, last-active-admin removal, and unreviewed critical changes. Role changes lock relevant rows, check current actor, commit atomically, record before/after/actor/target/reason/request ID, and immediately affect DB checks. Existing `assign_scoped_role`, `revoke_scoped_role`, `list_scoped_role_assignments` need single-school and delegation review; custom-role CRUD was not verified.

## 7. Module-by-module security contracts

All policies must constrain school, active user and relevant target relationship. Direct writes are denied for lifecycle, role, finance, device, audit and sensitive state tables; use caller-bound atomic RPCs. Private files use private Storage with row-aware policy and short-lived URLs. The authorized roles below are capability boundaries, not blanket access based on role label.

| Module; sensitive fields | Read/create/update/revoke authority | RLS, RPC, Edge, Storage and direct-write rule | Audit, risks and minimum tests |
|---|---|---|---|
| School administration; identity/config/security settings | Read school-safe configuration for active member; Admin manages; Registrar/academic roles only delegated settings; one-time setup operator bootstraps. | RLS on settings/calendar/year. RPC for updates. No runtime school create/switch; one-time bootstrap only. No direct config writes. | Audit all configuration. Test second school denied, invalid school selector, non-admin update denied, authorized update allowed. |
| Students/admissions; legal identity, DOB, contacts, docs | Registrar/Admin create/update; assigned teacher minimal roster; student own approved fields; guardian only child permissions. | RLS per person/student, assigned class and permission. RPC registration/profile/status/enrollment. Private docs bucket. Direct lifecycle writes denied. | Audit creation/status/document actions. Test own vs another student, assigned vs unassigned teacher, forged student ID, guardian scope. |
| Parents/guardians; contact/evidence/relationship | Guardian self; Admin/Registrar approve/revoke; child-level rights only. | RLS ties Auth subject, active membership, verified identity, approved relationship, permission and expiry. Request/accept/approve/revoke/permission RPCs; Edge invitation handles hashed token. No direct approval writes. | Append-only relation audit. Test email match alone denied, no self-approval, other child denied, revocation immediate. |
| Staff/teachers; HR/contact/employment | Admin creates/provisions/suspends; staff self sees own safe fields; managers see delegated HR fields; teacher assigned classes. | RLS self + permission. Admin-only Auth Admin Edge; gated `register_staff`; assignments via RPC. Private employment files. No browser Auth/role writes. | Audit invitations/role/employment. Test non-admin provisioning denied in both Edge and DB, terminated user denied. |
| Academic management; roster/assignments | Academic Admin manages; teacher reads assigned; student reads own. | Existing academic RLS plus current teacher assignment predicates. RPC class/subject/placement/promotion. No direct assignment/lifecycle writes. | Audit year/class/teacher assignments. Test assigned/unassigned teacher and forged/cross-school/year IDs. |
| Exams, grading, report cards; marks/results | Assigned teacher drafts own course/class; exam controller/admin publishes/locks; student and approved guardian see released results only. | No Supabase grade schema verified in listed migration inventory. Add row-scoped RLS, mark draft/publish/lock RPCs, private report-card storage. No direct post-lock edits. | Audit revisions/publication/export. Test unpublished and unrelated student denial, guardian scope, locked grade immutable. |
| Attendance; presence, schedule and corrections | Authorized teacher/attendance role records scoped students; student self; guardian explicit child read; device scans through device credential. | Existing attendance tables, `record_student_attendance`, `process_attendance_scan`, Edge scan; correction RPC; direct device/event/correction writes denied. | Append-only scan/correction audit. Test IDOR, duplicate/replay/concurrent scan, revoked device and correction privilege. |
| Fees/payments; balances, invoices, receipts | Bursar manages; student/guardian read only own/approved child; verified provider confirms payment. | No Supabase finance schema verified. Add immutable ledger, atomic locked/idempotent RPC, signed webhook Edge; no direct balance writes; private receipts. | Test invalid signature, duplicate callback, concurrent debit, insufficient funds, reversal and rollback; audit actor. |
| NFC cards; identifiers and attendance linkage | Cards manager issues/revokes/replaces; holder reads own safe status; device authenticates separately. | Existing card lifecycle, `issue-card`, `replace-card`; keyed digest not raw identifier, scoped RLS, lifecycle RPC only. | Audit all lifecycle. Test unknown/suspended/revoked/replaced card, replay, wrong school and digest confidentiality. |
| Student wallets; transactions | Student/guardian scoped read; bursar/canteen narrowly authorized credit/debit; no self-grant. | No Supabase wallet schema verified. Append-only ledger and atomic idempotent debit/refund RPC, row lock. No direct balance writes. | Test concurrent debit, insufficient funds, duplicate request, reversal, wallet IDOR and rollback. |
| Canteen; purchases, wallet balances, inventory | Canteen operator menu/order; student own purchase; finance reconciliation. | Legacy Express verified. Target RLS plus atomic order/debit RPC; server-calculated price; no direct balance/price writes. Public menu images only if non-sensitive. | Test forged student/price, duplicate tap, unauthorized wallet and insufficient funds. |
| Library; borrower/loan/fine | Librarian manages; borrower own loans; guardian limited child view if approved. | Legacy Express; target RLS by librarian permission and own borrower; checkout/return/fine RPC and row lock. No direct loan/fine writes. | Audit waiver/circulation. Test another borrower ID, concurrent checkout/return, fine changes. |
| Health/clinic; medical history, treatment, emergency contacts | Nurse/authorized clinician; guardian only explicit approved health permission; others deny except approved emergency minimum. | Legacy Express; strict health-specific RLS/RPC and private Storage; no general staff/guardian grants. Short-lived authorized URLs. | Audit sensitive reads/exports and all changes. Test unrelated teacher/guardian denied, authorized nurse allowed, revoked session blocked. |
| Discipline; incident/evidence/sanctions | Designated discipline/Admin; teachers submit only authorized scoped reports; student/guardian disclosure by explicit policy only. | Legacy Express; strict RLS, report/resolve RPC, private evidence Storage, no history deletion. | Audit reads and changes. Test student/guardian visibility policy, cross-student IDOR, evidence path guessing. |
| Gate/visitors; movements, visitor PII | Gate/security role records; Admin configures; user/guardian receives only approved own notification. | Legacy Express; device-auth Edge/RPC, idempotent events, retention controls; direct event writes restricted; private evidence. | Test wrong/revoked device, replay, forged time, visitor/student IDOR and emergency override audit. |
| Learning materials; files/class/course | Assigned teacher publishes; enrolled students/approved guardian read published scope; Admin manages global. | Legacy Express; target class-scoped RLS and private Storage; signed URL after authorization; no public restricted bucket. | Test unassigned teacher, unpublished item, path traversal and unrelated class. |
| Notifications; message contents/recipient lists/contact | Sender's explicit audience permissions; user reads own; guardian receives approved child-specific messages. | Legacy/provider module; outbox + trusted send Edge; validate recipients in DB before enqueue; credentials server-only. | Audit sender/audience/template/outcome; test forged audience, retry/idempotency, provider outage and cross-child leak. |
| Reports/analytics; bulk cross-module data | Each report has exact column/row permission; health/finance/discipline separately restricted; users own scope only. | Legacy reporting; authorized views/RPC, minimized columns, server-side export, private expiring Storage. No unrestricted query/export endpoint. | Audit filters/volume/export. Test filter manipulation, disallowed columns, cross-student and expired link. |
| Student self-service; profile, results, attendance/card | Student sees own allowed profile, attendance, released grades, schedule, card and permitted finance; cannot edit protected status/grades/wallet. | RLS maps `auth.uid()` to exact active student/member. Safe-field RPCs only; no client student ID as identity proof. | Test own/other IDs and suspended/graduated behavior; audit profile/security changes. |
| Achievements/development; awards/notes/evidence | Authorized teacher/coach in class scope creates; student sees own published item; guardian approved-child read; Admin taxonomy. | Legacy Express; target scoped RLS, award/revoke RPC, private evidence Storage; no direct award mutation. | Audit award and revocation. Test assigned/unassigned class, unpublished data, unrelated guardian/student. |
| Privacy/security/audit; all access metadata | Security/privacy Admin reads allowed audit slice; users controlled own-data requests; nobody edits/deletes audit. | Existing audit patterns partial. Append-only forced-RLS events, minimal read RPCs, retention, server-derived actor, private schema where appropriate. | Test direct insert/update/delete denied, spoofed actor denied, secret/OTP/PII log scrub, authorized export and audit access. |

For every table inspect grants plus RLS for all four operations; RLS enabled alone is not proof. Add indexes for FK and policy predicates based on query patterns, unique constraints for identity/idempotency, composite tenant FKs, short transactions and row locks for money/scans/roles. SECURITY DEFINER functions require explicit owner, empty safe `search_path`, minimum grants, actor derivation, validation, atomicity and audit. Audit corrections are compensating events, not edits/deletes.

## 8. Additive database simplification and migration plan

**Retain:** person/private contact foundation, schools and school membership history, school scope/composite FKs, student/staff/guardian/academic/attendance/card lifecycle objects, audited RPC patterns and tests. Retain Express schemas while modules depend on them. Do not rewrite applied migration files, delete history, drop tables or reset local DB.

**Simplify runtime rather than erase history:** organization/platform memberships, organization role scopes, multiple-school switching and runtime school provision are not product requirements. Inventory their references first. New additive migrations can restrict runtime grants, provide school-only RPCs, enforce single school and deprecate UI/API routes. Keep old tables and references until separately approved cleanup; historical audit/foreign keys may depend on them.

| Additive phase | Change and dependencies | Compatibility / rollback | Required pgTAP |
|---|---|---|---|
| A. School singleton | Add fixed-key configuration row and one-time guarded setup using current `schools`; validate every existing `p_school_id` function/policy. | Disable new bootstrap path if needed; preserve rows. No deleting school. Fence `provision_school` via new grant/RPC path. | Exactly one config, wrong school denied, second school rejected through DB path, valid configured operations pass. |
| B. Account lifecycle | Add invited/active/suspended/revoked account states and verified identifier uniqueness after inventorying existing local values. Depends on persons/auth and private contacts. | Stop new workflow; preserve identities and audit. | Unique person/Auth link, duplicate verified identifier failure, activation evidence and inactive denial. |
| C. Access context/link lifecycle | Add caller-only `get_my_access_context()` and narrow trusted account lifecycle functions, grants/audit. Depends on membership and roles. | Feature-disable caller UI before authority switch; do not maintain dual auth. | No arbitrary actor input, valid JWT + revoked DB row denied, no private contact returned, direct grants denied. |
| D. Role catalog/delegation | Seed approved school permission keys; add custom role CRUD/assignment/revocation and delegation ceiling. Depends on active membership and audit actor. | Disable custom-role creation while retaining assignment history. | Full positive/negative permission matrix, no self-escalation/protected-key grant/last-admin removal, immediate role revocation. |
| E. Trusted provisioning | One-time admin, Admin staff, approved student decision, guardian invite/approval. Depends on Auth provider, identity model, notification and recovery decision. | Auth and DB are not one transaction; durable idempotency/reconciliation; never delete pre-existing Auth user. | Edge authz, retries, partial outcomes, unauthorized actor, duplicate links and audit. |
| F. Module cutover | Add RLS/RPC/Storage for one module at a time. Stop old writer before enabling new one. | Forward-fix/disable only after owner reconciliation; no silent fallback or dual write. | Module pgTAP, integration and full cross-module tests. |
| G. Legacy auth retirement | Remove legacy login/refresh only when no live route requires it and retention reviewed. | Separate approved retirement plan; preserve historical data/migrations. | No route accepts old JWT; no dependency remains; all target routes fail closed on Auth outage. |

Each migration records exact dependencies, affected function/policies/grants, existing-record compatibility, indexes/constraints, rollback-by-disable or forward-fix and pgTAP evidence. No private functions exposed through PostgREST without explicit review.

## 9. Express/Prisma gradual retirement

Map each `lib/api.ts` method to mounted route in `knotty-backend/src/app.js`, current writer, sensitivity, target owner and acceptance tests. Supabase identity foundation precedes protected route migration. Keep Express as sole owner for an unmigrated module; never let the frontend silently switch backend on an error. Migrate a bounded module, stop its legacy write route, verify the replacement, then mark the old path read-only/retired. Do not dual-write. Do not let legacy token roles authorize Supabase. Retire legacy auth/Redis only after all required modules cut over and their route consumers/tests are removed. No legacy account or data import is part of clean-school onboarding.

## 10. Ranked security gap register

| Rank | Gap | Evidence and closure |
|---|---|---|
| **P0** | No-contact student independent-account bootstrap/recovery undecided. | Native password/passkey limitations above. Axel decision and tested independent credential/reproof model required before implementation. |
| **P0** | Frontend auth is not Supabase Auth-only and can restore localStorage/demo state. | `context/AuthContext.tsx`; replace with verified Supabase session and DB context; protected calls must not trust display context. |
| **P0** | Exactly-one-school invariant not evident in database. | `schools`, `provision_school`, school UI and switch context support multiple. Add DB enforcement and negative test before runtime simplification. |
| **P1** | No verified Admin-only staff Auth provisioning. | `register_staff` record RPC only and authenticated execute; add authorized trusted path and tests. |
| **P1** | Guardian lifecycle lacks verified end-to-end UI and comprehensive child-isolation evidence. | RPC foundation exists; bind approval to Admin/Registrar and test no contact-match linking/self-approval. |
| **P1** | Custom role creation/delegation boundary not demonstrated. | Catalog and assignment RPC exist; no verified custom CRUD/full permission matrix/protected-key coverage. |
| **P1** | Supabase SSR session restoration/refresh not wired. | `server.ts` exists; no `proxy.ts` found; context remains legacy. Add cookie refresh and cache-safe route verification. |
| **P1** | Business modules have split data/auth authorities. | `app.js` mounts broad Express module set; most do not have Supabase migration equivalents. Need source-of-truth map and module cutover evidence. |
| **P1** | Sensitive finance, wallet, grading, health, discipline, gate, material, notification, analytics Supabase contracts not verified. | No corresponding objects in reviewed Supabase migration list. Design module RLS/storage/audit before migration; legacy presence is not security proof. |
| **P1** | Account/contact status and revocation consistency need end-to-end validation. | Person/Auth unique link exists; verified contact global uniqueness not established; status spans person/membership/domain/Auth. Define single fail-closed predicate and test old valid JWT after DB revocation. |
| **P1** | Local Auth defaults do not require confirmed email and disable phone. | `supabase/config.toml`; configure controlled testing and review hosted settings separately. |
| **P1** | Admin MFA loss/recovery/device change incomplete by design. | TOTP supported, recovery codes not. Define high-trust recovery/audit before offering admin MFA. |
| **P2** | Historical org/platform/multi-school schema remains. | Restrict/deprecate runtime additively after reference inventory; retain historical schema. |
| **P2** | System Testing Center scope may be narrower than all security assertions. | Existing system tests and status handling need PASS/FAIL/BLOCKED/SKIPPED distinction plus negative suites. |
| **P2** | Audit completeness differs between Supabase and legacy domains. | Some Supabase events are immutable; legacy routes are separate. Define common event/retention contract per cutover. |

## 11. Test matrix and acceptance evidence

Use local Supabase with controlled dummy personas only: School Admin, Registrar, assigned and unassigned teacher, nurse, bursar, canteen operator, student A/B, guardian linked only to A, suspended/revoked staff and anonymous user. Never use real school data or production. Service-role tests must separately prove the Edge Function constrains its privileged path.

| Area | Required positive tests | Required negative/failure tests |
|---|---|---|
| Authentication | Valid/invalid login; verified identity; invitation acceptance; refresh and restore; logout; password recovery; passkey after approved bootstrap; optional TOTP enrollment/challenge/backup factor. | Unverified contact, expired/reused invite, token replay, forged/expired cookie, enumeration, compromised account, lost MFA factor, Auth outage. |
| Provisioning | One-time Admin bootstrap; independent student/staff/guardian identities; idempotent retry; correct identity link. | Public admin signup, duplicate normalized ID/contact, unauthorized staff create, caller-supplied actor/role, Auth created but DB failed, retry creates duplicate. |
| Authorization | Every permission key allowed for exact role; permitted custom delegation. | Every disallowed pair; role metadata/body tampering; self-escalation; protected permission grant; remove last Admin; revoked role with still-valid JWT. |
| RLS/IDOR | Own record, assigned class, approved child, configured school. | Another user/student/guardian, unassigned class, forged school/entity ID, direct writes, inactive person/suspended/revoked membership. Exercise PostgREST directly, not only UI. |
| Student/guardian privacy | Own student view; guardian approved child and permitted fields. | Contact match alone; pending/unapproved relation; sibling/other child; unpublished grades, health, discipline, finance or docs without exact permission; guardian impersonation/reset attempt. |
| Staff/MFA | Admin invite; staff accepts own verified identity; TOTP flow and backup factor. | Non-admin staff provisioning; unauthorized MFA removal/reset/device change; stale AAL on protected route if AAL2 selected. |
| Finance/wallet | Valid provider signature, atomic idempotent transaction, refund/reversal. | Invalid signature, duplicate callback, concurrent debit, insufficient funds, price/wallet spoof, mid-transaction failure and rollback. |
| NFC/devices | Active device/card scan, replacement and valid subsequent scan. | Unknown/suspended/revoked card/device, replay, duplicate/concurrent scan, wrong school, old lost card reuse. |
| Privacy/storage | Allowed short-lived signed URL, class-published material. | Public sensitive bucket, guessed/path-traversal URL, unrelated student/guardian, expired link, inactive caller. |
| Cross-module | Admission → enrollment → class → teacher assignment → attendance → released result; guardian approval → permitted child view; payment → receipt/report. | Partial provision, notification failure, revoked relationship mid-flow, stale assignment, retry after timeout and no silent fallback. |
| Failures/audit | Correct bounded error and safe idempotent retry; actor-attributed immutable event. | Auth/DB/Edge/email/SMS/payment outage, unknown commit, malformed request, rate limit, denied CORS, forged audit actor, direct audit mutation, secret/OTP/password logs. |
| Single school | Configured school operation passes. | Second school via DB/API, arbitrary `school_id`, organization/platform role bypass. |

Use pgTAP for schema/policy/grant/RPC invariants, Edge unit/integration tests for Auth Admin/device/provider paths, backend tests while Express remains, browser/Next tests for SSR/session and route behavior, and local E2E tests for workflows. A skipped/blocked test is not a pass; report separately. This blueprint task ran no tests.

## 12. Phased sequence and acceptance criteria

**Phase 0 – Product decisions and inventory:** Axel resolves student no-contact strategy, first Admin bootstrap/recovery owner, MFA recovery controls, guardian defaults and permission/delegation catalog. Inventory each frontend API call and mounted Express route by writer/sensitivity/target. Accept when architecture blockers and route owners are documented; no reset/import/production use.

**Phase 1 – Database invariant and identity:** Add school singleton, identity state/access context and verified identifier constraints with additive migrations. Review grants, all RLS predicates and definer functions. Accept only when pgTAP proves second-school rejection, caller-bound context, direct-write denial, revocation and privacy.

**Phase 2 – Supabase Auth/SSR:** Implement verified login, Next cookie refresh, logout/recovery and replace display context; remove fabricated/demo protected identity and switching. Accept when expired/forged/unverified sessions fail, DB revocation blocks old valid JWT, browser and server agree on identity, no local cache grants access, and no service key enters client bundle.

**Phase 3 – Provisioning:** Implement one-time Admin, Admin-only staff, decision-backed student onboarding/recovery, guardian invite/accept/approve/revoke. Accept when Edge and DB independently enforce actor permissions, duplicate/retry/partial failure reconciles, identity is never auto-linked by contact match, and guardian/student separation is tested.

**Phase 4 – Roles:** Complete permission catalog, custom role CRUD/delegation and UI. Accept full permission matrix, escalation failures, audit and immediate DB revocation.

**Phase 5 – Core module cutovers:** One module at a time: school config, academics, student/staff, attendance/cards. Stop legacy writer before Supabase ownership. Accept RLS, RPC, API, Edge positive/negative tests and documented rollback without dual writes.

**Phase 6 – Sensitive modules:** Finance/wallet/canteen/payments, health, discipline, grading/reports/storage. Threat-model and approve each field/role policy. Accept atomicity, idempotency, strict access, read/export audit, private storage, provider failure handling and cross-module tests.

**Phase 7 – Remaining modules/Express retirement:** Library, gate, learning materials, notifications, achievements, analytics; retire Express route-by-route. Accept no legacy business-write or legacy-auth dependency remains for protected product features and all features are retained.

## 13. Axel decisions required

1. Student with no email/phone: unique real school-managed mailbox, approved external IdP/federation, or another credential and recovery process that preserves independent student identity. Passkey alone does not solve initial verification/recovery.
2. Name the initial School Administrator bootstrap owner and out-of-band proof/recovery authority.
3. Student age-specific credential recovery: guardian role, in-person proof, two-person approval, notification and emergency lockout policy; no guardian password access/impersonation.
4. Keep admin MFA optional; decide if selected sensitive functions require fresh auth/AAL2 and approve lost-factor/device recovery.
5. Approve guardian default permissions and whether health, finance, discipline, documents, location/gate and unpublished grades can ever be exposed.
6. Approve permission keys, protected non-delegable set, Admin delegation ceiling, two-person approval for critical changes and last-admin rule.
7. Confirm whether configured school can ever be replaced after initial setup and under which internal process.
8. Define audit/privacy retention, sensitive access logging and legacy record retention outside the clean target environment.
9. Authorize implementation phases separately; this document does not grant code or migration authorization.

## 14. Change and verification statement

This is a proposed implementation contract, not an assertion that target features are implemented. No code, migration, database object, environment/configuration or production project was modified or accessed. Existing uncommitted work was preserved. Tests for this documentation task were **not run**.
