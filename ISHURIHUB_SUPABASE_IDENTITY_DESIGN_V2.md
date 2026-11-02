# IshuriHUB Supabase Identity and Tenancy Design V2

**Status:** revised design for approval; implementation is not approved. This report reflects the newly confirmed product decisions and corrects earlier proposals. It is a design document, not an executable migration. No SQL was run, no database was contacted and no source/application file was changed.

## Executive decisions and contradictions resolved

| Confirmed decision | Design consequence | Earlier proposal corrected |
|---|---|---|
| A person may have only one active school membership | Partial unique index on active school memberships by person; transfer is an atomic revoke/create. Platform and organization memberships remain separate. | “Multiple active school memberships” is no longer supported. |
| Every student requires Supabase Auth | `student_records.auth_user_id` and matching person/Auth FK are non-null. Admission cannot be finalized without account provisioning. | Optional student account link is removed. |
| One active guardian relationship per student | Partial unique index on active guardian links per student; old links remain revoked/suspended history. | Guardian no longer needs a school membership. Requiring one would conflict with one active school membership and guardians with children in multiple schools. Guardian authorization uses verified person identity plus relationship permission. |
| One unified staff model | One `staff_records` row per person per school; category and category-specific detail records represent duties. | Separate Teacher and Staff records are migration sources, not canonical identities. |
| Built-in plus custom school roles | Built-ins are protected migration-seeded roles; custom roles are school-owned and limited to explicitly assignable permissions. | School Admin cannot customize protected role permissions or create a role that escalates privileges. |
| Platform, organization and school administration | Platform Admin is platform-scoped; Organization Manager is limited to its organization; School Admin is limited to the single active school membership. | Organization authority does not implicitly grant student-data access or School Admin authority. |
| Immutable financial history | Posted ledger transactions and entries are append-only; corrections use reversals/adjustments/refunds with idempotency and audit. | Mutable wallet balance/transaction rows are not the financial source of truth. |
| Existing password migration must be investigated | Compatible bcrypt/Argon2 hashes may be imported through the supported Auth Admin API, after isolated compatibility tests; otherwise use password reset/invitation. | Never write hashes directly into `auth.users` or copy them into a public profile. |

## 1. Identity, school cardinality and membership lifecycle

`persons` is the canonical real-person identity, independent of Auth. A person can exist before account activation. `persons.auth_user_id` is nullable and unique for staff, guardians and other people; students are the exception: every student row requires a linked Auth identity. Legal identity and contact data live separately in non-exposed tables, not in the authorization anchor.

### One active school membership

`school_memberships` keeps historical rows, but permits at most one row in `active` state per person. `invited`, `suspended` and `revoked` do not count as active. This is global across all schools, not merely unique per person/school.

```sql
create unique index school_memberships_one_active_per_person
  on public.school_memberships(person_id)
  where status = 'active';

create unique index school_memberships_person_school_unique
  on public.school_memberships(person_id, school_id);
```

A school transfer runs in one trusted transaction: lock person and current membership; confirm authority and target school eligibility; revoke/close the old membership and record the reason; create or activate the target membership and required student/staff relationships; write audit events; commit. If any step fails, rollback the transaction. Never temporarily create two active memberships. If the person remains enrolled at two schools concurrently, that conflicts with the confirmed rule and requires product reconsideration before implementation.

Platform membership and organization membership do not create a school membership. They grant only their explicit platform or organization permission set. They cannot be used to pass school-scoped RLS or impersonate School Admin.

### Every student has an account

`student_records.auth_user_id` is `NOT NULL`, references `auth.users(id)`, and is tied to `persons` with a composite FK `(person_id, auth_user_id)`. A student must also have the one active membership for the same school/person. The database therefore rejects a student row with no Auth identity or a link to another person’s Auth identity.

Provisioning lifecycle:

1. **Admission draft:** authorized registrar creates/locates the person and student record in a non-enrolled/pending state. Duplicate-person matching uses verified stable identifiers and human review; names alone never merge identities.
2. **Invitation:** trusted server operation creates/uses the Auth user and sends a single-use Supabase Auth invitation. Invitation event is stored separately. Auth Admin credentials never reach the browser. Do not send a shared/default password.
3. **Identity activation:** invitee verifies their email/phone and completes account setup. Auth contact verification proves control of that contact only. School admission approval separately proves entitlement to the student record.
4. **Link completion:** trusted transaction checks verified Auth user, approved admission, exact `persons` row, student row, same-school membership and no conflicting link; sets/validates `persons.auth_user_id`, activates membership, and completes student provisioning. Unique constraints stop races or duplicate links.
5. **Recovery:** password reset is requested through Supabase Auth’s enumeration-safe flow; help desk verifies person identity via school process before changing contact or account links. Staff must not disclose credentials or reset to an unverified contact.
6. **Deactivation:** suspend/revoke school membership immediately, disable/deactivate the student account through the trusted Auth Admin flow when appropriate, revoke refresh sessions, and preserve student and ledger records. Because already-issued JWTs can remain valid until expiry, all RLS predicates also check active membership/status; high-risk operations should verify current session/revocation as required.

**Product decision still needed:** some students, especially young children, may not own an email or phone. Decide whether a verified guardian-mediated activation flow is sufficient, whether school-managed identity/contact is allowed, and how one student gets a secure individual credential without giving a guardian the student’s credentials. Supabase Auth email/phone uniqueness and contact ownership constraints must be included in that decision.

### Guardian relationship cardinality

`guardian_relationships` references a `guardian_person_id`, not a guardian school membership. This is necessary because a guardian may have children at more than one school while having no school membership, or may themselves already occupy their only active school membership elsewhere. RLS resolves the caller’s Auth ID to the guardian person and checks the exact active relationship and permission. The relationship becomes active only after the guardian identity is linked to a verified Auth user, school approval is recorded, and workflow requirements pass.

Only one active guardian relationship exists per student. Replacement is an atomic process: revoke the prior active link with actor/time/reason, activate the approved replacement, record both audit events, and commit. A transfer preserves the prior school’s revoked history; a new school relationship requires a separately approved relationship in the destination school. No historical link is deleted or silently rewritten.

## 2. Person data and unified staff

Keep `persons` minimal: UUID, optional unique Auth user, status, timestamps, and optional `merged_into_person_id`. Put legal names, DOB, national identifiers in `private.person_private_identity`. Put contact details and verification state in `private.person_contact_points`. This limits normal Data API exposure and avoids using editable profile fields as authorization.

Every staff person has one `staff_records` row per school, regardless of Auth. `category` is a controlled classification (for example `TEACHING`, `NON_TEACHING`, `HEALTH`, `ADMINISTRATIVE`, `SUPPORT`); responsibilities are scoped roles/assignments. `staff_category_details` stores category-specific fields (teacher qualification/specialization, nurse registration, etc.) and is keyed by staff record plus category. Avoid separate canonical Teacher and Staff identities.

Existing `Teacher` and `Staff` records are migration inputs. Create `legacy_staff_map(source_table, source_id, staff_record_id, resolution_status, reviewed_by_person_id)`. Consolidate two rows only where stable identifiers or reviewed documentary evidence confirms they represent the same person in the same school. Never merge based on names alone. Preserve every old identifier and migrate module FKs using the map; retain original actor IDs in historical audit events.

## 3. Scope roles, management boundaries and custom roles

### Management boundaries

| Role | Authority | Explicit exclusions |
|---|---|---|
| `PLATFORM_ADMIN` | Platform configuration, tenant provisioning, platform role administration, operational audit. | No automatic student/health/finance access; any exceptional support access is time-bounded and audited. |
| `ORGANIZATION_MANAGER` | Only its organization’s settings, school registry/provisioning and organization memberships. | No student, guardian, health, discipline, financial or school-level role access. It cannot act as School Admin. |
| `SCHOOL_ADMIN` | One active school membership; school settings and permitted school operational administration. | Cannot grant platform/org roles or permissions on the protected list; does not get sensitive health/finance/discipline merely by role name. |

One active membership per person applies to School Admins and all other school memberships. Organization managers who need direct operational access must have an active school membership; this would consume their one active school membership and is not implied by the org role.

### Built-in roles and custom roles

Built-ins are seeded in a private, migration-managed catalog and marked protected. Clients cannot edit their names, scope or permissions. Protected roles include the three management roles and product roles (Teacher, Student, Guardian, Bursar, Nurse, Discipline Officer, Librarian, Canteen Operator, Gate Staff, Registrar, HR Manager, Headteacher, DOS, DOD, Patron, Matron, Auditor). Role-permission seeds must be reviewed and explicit; there is no implicit hierarchy.

School custom roles are school-owned. A School Admin can create/update/archive their school’s custom role through a trusted function, but can assign only catalog permissions with `custom_assignable=true`. The following are never custom-assignable by default: platform/organization administration, membership/role delegation, student sensitive identity, health, finance refund/reconciliation, discipline sensitive, audit administration, and any service/ledger write operation. A custom role cannot equal or override a built-in management role. Adding a newly delegable permission is a reviewed migration and approval, not a UI option.

`school_custom_roles` uses `UNIQUE(school_id, lower(name))`, `UNIQUE(school_id,id)`, a creator membership FK scoped to the same school, and status `active|archived`. `school_custom_role_permissions` has PK `(school_id,custom_role_id,permission_key)`, composite FK to custom role, composite FK `(scope,permission_key)` to `permission_catalog`, and check `scope='school'`. Its insert/update function verifies `custom_assignable`. `school_membership_roles` has exactly one of `builtin_role_key` or `custom_role_id`; the first FK is fixed to school scope and built-ins, the second is composite `(school_id,custom_role_id)`. Both paths retain actor membership composite FKs.

## 4. Guardian state, permission history and authorization

The exact state machine is:

- `pending`: invitation/identity/approval is incomplete; no student access. Verification metadata is either both null or both set. Approval metadata is either both null or both set. No activation, suspension, revocation or expiry fields.
- `active`: verified actor/time and approved actor/time are required; `guardian_person_id` must resolve to an Auth-linked person at access time; `activated_at` required; no revocation/expiry marker.
- `suspended`: previously active and retains verification, approval and activation; requires suspension actor/time; RLS denies access.
- `revoked`: requires `revoked_by_person_id` and `revoked_at`; RLS denies access permanently. Replacement creates a new relationship row.
- `expired`: set by trusted expiry transition; requires `expired_at`, retains original verification/approval history; RLS denies access.

Constraints enforce paired fields, FK tenant/person matching, status values and required state metadata. Trusted functions enforce that verifier/approver/suspender/revoker were active school members with the specific permission at operation time, Auth contact verification succeeded, and transitions are allowed. Database checks cannot prove those historic authorization facts unaided.

Guardian access to each category requires: `auth.uid()` maps to `guardian_person_id`; relationship school/student/person all match the queried row; relationship is active and unexpired; guardian person has active Auth link; individual category grant is active/unexpired; and any consent/document-specific condition passes. The guardian has no school membership requirement. Revoking relationship or grant denies on the next RLS evaluation; no JWT-cached guardian grants.

## 5. Financial integrity

The existing Prisma schema has `WalletTransaction`, `FeePayment`, `Payment`, `RefundRequest`, `ExternalPayment`, and other financial models. Those records and mutable `KnottyCard.wallet_balance` cannot remain the sole authoritative ledger. Migrate their history to an append-only double-entry ledger; preserve old source IDs in a finance migration crosswalk.

Target core tables:

```sql
create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  account_type text not null,
  student_id uuid,
  currency char(3) not null default 'RWF',
  status text not null check (status in ('active', 'frozen', 'closed')),
  unique (school_id, id),
  foreign key (school_id, student_id)
    references public.student_records(school_id, id) on delete restrict
);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  idempotency_key text not null,
  event_type text not null,
  source_type text not null,
  source_reference text,
  external_provider text,
  external_reference text,
  reversal_of_transaction_id uuid,
  actor_person_id uuid references public.persons(id),
  posted_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (school_id, idempotency_key),
  unique (school_id, id),
  foreign key (school_id, reversal_of_transaction_id)
    references public.ledger_transactions(school_id, id) on delete restrict
);

create unique index ledger_external_reference_unique
  on public.ledger_transactions(external_provider, external_reference)
  where external_reference is not null;

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  transaction_id uuid not null,
  account_id uuid not null,
  amount_minor bigint not null check (amount_minor <> 0),
  currency char(3) not null,
  created_at timestamptz not null default now(),
  foreign key (school_id, transaction_id)
    references public.ledger_transactions(school_id, id) on delete restrict,
  foreign key (school_id, account_id)
    references public.financial_accounts(school_id, id) on delete restrict
);
create index ledger_entries_transaction_idx
  on public.ledger_entries(school_id, transaction_id);
create index ledger_entries_account_time_idx
  on public.ledger_entries(school_id, account_id, created_at);
```

Only a trusted `post_ledger_transaction(...)` function may insert posted ledger rows. It authenticates the actor/service context, validates school scope and permission, checks idempotency, locks affected accounts, inserts a complete balanced set of entries, verifies `sum(amount_minor)=0`, and commits all rows atomically. No client may update/delete ledger rows. RLS grants read by school financial permissions and narrowly scoped student/guardian finance permissions; direct `INSERT/UPDATE/DELETE` grants are absent.

Corrections are new transactions:

- **Reversal:** new ledger transaction with opposite entries and `reversal_of_transaction_id`; never edit original entries. Enforce reason, actor and source linkage. For full reversals, a unique partial index can ensure one full reversal; partial reversals/refunds need cumulative amount checks under lock.
- **Adjustment:** new balanced transaction with adjustment reason, approver and audit event; never mutate prior transaction.
- **Refund:** new outgoing ledger transaction linked to the captured payment. Under account/payment lock, ensure cumulative refunds do not exceed captured amount. Provider request/retry key is unique and callbacks are independently authenticated/idempotent.
- **Audit:** append-only financial event log records initiation, provider callback, posting, reversal, refund, reconciliation and failure. Provider raw secrets/tokens are never stored in audit payloads.

Pending payment intent state may be mutable under a strict state machine, but posting creates immutable ledger history once. Duplicate callback, retry and concurrent refund tests are mandatory. `KnottyCard.wallet_balance` becomes a derived/cached projection, never a writable source of truth.

```sql
create table public.financial_event_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  ledger_transaction_id uuid,
  source_type text not null,
  source_reference text,
  event_type text not null check (
    event_type in ('initiated','provider_callback','posted','reversed','refund',
      'adjustment','reconciled','failed')
  ),
  idempotency_key text not null,
  actor_person_id uuid references public.persons(id) on delete restrict,
  event_at timestamptz not null default now(),
  reason text,
  details jsonb not null default '{}'::jsonb,
  unique (school_id, idempotency_key),
  foreign key (school_id, ledger_transaction_id)
    references public.ledger_transactions(school_id, id) on delete restrict
);
create index financial_audit_school_time_idx
  on public.financial_event_audit(school_id, event_at);
create index financial_audit_ledger_time_idx
  on public.financial_event_audit(school_id, ledger_transaction_id, event_at);
```

Append-only trigger template (attach to each audit table). This is defense in depth alongside RLS and grants:

```sql
create function private.reject_append_only_mutation()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  raise exception 'append-only record cannot be changed';
end;
$$;
revoke all on function private.reject_append_only_mutation()
  from public, anon, authenticated;
-- Attach BEFORE UPDATE OR DELETE triggers; revoke UPDATE, DELETE and TRUNCATE
-- from all application-facing roles on append-only audit/ledger tables.
```

## 6. Password migration and account recovery

The inspected backend uses `bcryptjs`; creation paths call `bcrypt.hash(password, 10)` and login uses `bcrypt.compare`. No actual hashes or user data were inspected. Supabase’s current migration guidance says Auth Admin user creation supports compatible bcrypt and Argon2 password hashes via its `password_hash` input. This must use the trusted Auth Admin API, never direct SQL into Supabase-managed `auth.users`. [Supabase migration guidance](https://supabase.com/kb/guides/migrate-from-auth0), [password security](https://supabase.com/docs/guides/auth/password-security).

Recommended path: export only through an approved protected migration, classify format/version without exposing values, and test representative synthetic hashes generated with the same bcrypt implementation/cost in an isolated Supabase project. Validate legacy IDs are UUID-compatible if preserving IDs. If the API rejects a hash format, encoding or cost variant, do not weaken hash verification or keep a shadow password verifier in the app; use reset/invitation.

Secure reset path: enumerate-safe Auth password reset; verified email/phone; short-lived one-time reset; password update through Auth; revoke sessions as appropriate; notify user; force reset for any accounts created with shared/default credentials. Support staff may verify identity and update a contact through a separately audited recovery workflow, but never set or learn a user’s password.

## 7. Required RLS and authorization functions

All exposed tables use explicit minimum grants and RLS. Private catalogs, identity PII, tokens, crosswalks and audit internals are not Data API exposed. Never expose the service-role key. Supabase grants control whether an object is reachable; RLS controls rows. Current Data API defaults require deliberate exposure/grants. [Supabase API security guidance](https://supabase.com/docs/guides/api/securing-your-api).

Required trusted functions (signatures are design contracts; implementation must use explicit grants, fixed search paths and audited transactions):

| Function | Required checks and effect |
|---|---|
| `private.current_person_id()` | `SECURITY INVOKER` where possible; maps `auth.uid()` to exactly one active person. Never accepts caller-supplied user ID. |
| `private.has_school_permission(school_id, permission_key)` | Active sole school membership, active built-in/custom role, role permission and matching tenant. |
| `private.has_org_permission(org_id, permission_key)` | Active org membership and org-scoped permission only; cannot return school/student access. |
| `private.has_platform_permission(permission_key)` | Active platform membership and platform role. |
| `private.guardian_can(school_id, student_id, permission_key)` | Exact Auth person, active relationship, one-active-guardian invariant, matching student/school, active unexpired per-relationship grant. No membership shortcut. |
| `private.assign_membership_role(...)` | Actor/target membership scope match, active actor, delegable role allowlist, no self-escalation, valid role scope, audit in same transaction. |
| `private.create_school_custom_role(...)` | School Admin authority, unique role name, only `custom_assignable` school permissions, no management/sensitive protected permissions. |
| `private.transfer_school_membership(...)` | Locks person/membership; deactivates old before activating new in same transaction; records both audit events. |
| `private.provision_student_account(...)` | Trusted Auth Admin operation boundary plus admission approval, verified contact, no conflicting identity, required account/membership link. |
| `private.activate_guardian_relationship(...)` | Verified Auth-to-person link, authorized school approver, no other active guardian for student, atomic audit/state update. |
| `private.post_ledger_transaction(...)` | Actor/service proof, tenant checks, idempotency, balanced immutable entries and atomic commit. |

Prefer `SECURITY INVOKER`. Where recursion makes a narrow `SECURITY DEFINER` membership lookup necessary, keep it in non-exposed `private`, owned by a dedicated `NOLOGIN` non-superuser role, use `SET search_path=''`, qualify all objects, derive actor from `auth.uid()`, return only a boolean/narrow result, and revoke execute from `PUBLIC` and `anon`. Mutation functions must not be general-purpose bypasses. Policies use `(select auth.uid())`, indexed relationship columns, and both `USING` and `WITH CHECK` on updates.

RLS responsibilities by group: persons are self-safe only; private identity/contact and role catalogs are not Data API exposed; organizations/schools require active scope membership or exact manager permission; memberships are self/same-scope manager; role assignments are self/scope-manager read and delegation-function write; students require self, assigned staff or matching guardian relationship; staff requires self or scoped HR; invitations require invitee/authorized operator; relationship permissions require exact active guardian link; audit is append-only; crosswalks are migration-only; ledger is scoped read with no direct client writes. `anon` receives no grants on these identity/tenancy objects.

Illustrative student and guardian policy predicates:

```sql
-- Conceptual policy; function implementation is required before use.
create policy student_self_read on public.student_records
for select to authenticated
using (auth_user_id = (select auth.uid()));

create policy guardian_profile_read on public.student_records
for select to authenticated
using (private.guardian_can(
  school_id, id, 'guardian.student_profile.read_basic'
));
```

RLS does not enforce all cross-row state transitions. Constraints enforce cardinality and FK integrity; the trusted functions enforce authorization, verification and valid state changes.

## 8. Complete schema inventory

### Existing Prisma tables retained/extended during compatibility

| Existing Prisma table/model | Planned treatment | Key integrity work / RLS transition |
|---|---|---|
| `Organization` | Retain tenant IDs; map to target organization. | Unique slug; org-scoped policies. |
| `School` | Retain school IDs and nullable `organization_id` initially. | Composite tenant keys; school-scoped policies. |
| `OrganizationMembership` | Legacy source; map `user_id` to `person_id`, then migrate. | Target unique `(organization_id,person_id)` and `(organization_id,id,person_id)`. |
| `SchoolMembership` | Legacy source; map User to Person; target one-active-person index. | Cross-school active memberships must be resolved before cutover. |
| `PlatformMembership` | Legacy source; remove implicit default platform-admin promotion. | Explicit platform role assignments. |
| `User` | Auth/profile migration source; retire after verified cutover. | Password hashes never remain in public profile tables. |
| `Student` | Legacy source; migrate to required-account `student_records`. | Student has Auth ID and same-person/school active membership. |
| `Teacher`, `Staff` | Legacy sources; consolidate to unified `staff_records`. | Stable identifier/reviewed mapping; no name-only merges. |
| `ClassSection`, `Subject`, `AcademicTerm` | Existing academic targets; add same-school composite unique keys. | Teacher assignment composite FKs. |
| `KnottyCard`, `WalletTransaction`, `CanteenTransaction`, `FeePayment`, `Payment`, `RefundRequest`, `ExternalPayment`, `Invoice` and related financial models | Retain read/compatibility path during ledger backfill; migrate immutable history. | Tenant-consistent FKs, idempotency, no mutable balance authority after cutover. |
| Other module tables | Preserve and migrate by feature-specific plan. | Add school-scoped RLS and composite tenant FKs before frontend cutover. |

### New target tables

| New table | PK/FK/unique/index essentials | RLS responsibility | Full DDL in this report? |
|---|---|---|---|
| `persons` | PK id; unique nullable Auth FK; unique `(id,auth_user_id)` for student composite FK. | Self-safe projection; linking via trusted workflow. | Shape specified, not full DDL. |
| `person_private_identity` | PK/FK person. | Private schema, restricted identity operations. | No. |
| `person_contact_points` | PK id; person FK; indexes person/status and normalized contact hash. | Own contact view; verification via trusted Auth flow. | No. |
| `organizations`, `schools` | Org slug unique; school code unique initially; school org FK. | Explicit org/school metadata scope. | Existing source; target extensions specified. |
| `platform_memberships` | PK id; unique person; unique `(id,person_id)`. | Self/platform manager only. | No. |
| `organization_memberships` | PK id; tenant/person FK; unique tenant/person and tenant/id/person. | Self and same-org manager. | No. |
| `school_memberships` | PK id; tenant/person FK; unique school/person; partial unique active person; unique composite keys for role/account FKs. | Self and same-school manager. | Constraints/index specified, not full DDL. |
| `role_definitions`, `permission_catalog`, `role_permissions` | Scope-qualified composite PK/FKs. | Private migration-managed. | Role/permission DDL specified. |
| `delegable_roles` | PK scope/grantor/target; both role FKs scoped. | Private migration-managed. | DDL specified. |
| `school_custom_roles`, `school_custom_role_permissions` | School-owned custom role; same-school composite keys; permission FK constrained to school scope. | School Admin via trusted function; only custom-assignable permissions. | Shape specified, not full DDL. |
| Three membership role tables | Target and actor membership composite FKs; fixed scope; scoped role FK; PK membership/role. | Self/scope-manager reads; controlled writes. | DDL specified. |
| `student_records` | PK id; required Auth FK; composite person/Auth FK; same-school membership/person FK; unique school/person and school/student-code. | Student self, assigned staff, guardian relationship. | Shape specified, not full DDL. |
| `staff_records` | PK id; unique school/person and school/staff-number; optional account membership composite FK. | Self and scoped HR/management. | Shape specified, not full DDL. |
| `staff_category_details` | PK `(staff_record_id,category)`; FK staff; category check. | Field/category-specific access. | Shape specified, not full DDL. |
| `teacher_assignments` | PK id; same-school composite FKs to staff/class/subject/term; active tuple unique. | Assigned teacher and academic manager. | Shape specified, not full DDL. |
| `guardian_link_requests` | PK id; school/student FK; verified Auth and inviter/approver actor FKs; unique 32-byte token hash; indexes student/state/expiry and contact hash. | Invitee’s own verified request; registrar scoped. | Full DDL supplied. |
| `guardian_relationships` | PK id; same-school student and actor membership FKs; one-active-per-student partial unique; state checks. | Active link only, current guardian person identity must match. | Full DDL supplied in addendum. |
| `guardian_relationship_permissions` | Surrogate PK; grant/revoke actor composite FKs; partial unique active relationship/permission; grant/expiry/revoke indexes. | Guardian own active grant; scoped permission manager. | Full DDL supplied in addendum. |
| `guardian_link_audit` | PK id; request/relationship/actor FKs; index object/time. | Append-only scoped reads. | DDL supplied in addendum. |
| `account_link_requests` | PK id; school/person and optional same-school student/staff FKs; unique token hash. | Invitee own request; scoped school operator. | Full DDL supplied. |
| `account_link_audit` | PK id; request and actor FKs; index request/time. | Append-only. | DDL supplied in addendum. |
| `person_merge_audit` | PK id; source/canonical/actor person FKs; merge/time indexes. | Append-only identity resolution/audit access. | DDL supplied in addendum. |
| `legacy_person_map`, `legacy_staff_map` | Composite PK source table/id; target FK; status indexes. | Migration-only; never authorization. | Shape specified, not full DDL. |
| `financial_accounts` | PK id; school/student same-school FK; unique school/id. | Finance roles and narrowly scoped account owner read. | DDL included. |
| `ledger_transactions` | PK id; unique school/idempotency; external reference unique; self reversal FK. | Read by scoped finance/owner; no direct writes. | DDL included. |
| `ledger_entries` | PK id; composite FKs transaction/account/school; account/time and transaction indexes. | Read follows transaction/account visibility; no direct writes. | DDL included. |
| `financial_event_audit` | PK id; ledger reference, actor and event indexes; school/idempotency unique. | Append-only finance/audit access. | Full DDL supplied. |

This inventory distinguishes target DDL from existing Prisma source tables. Rows marked “shape specified” still need complete migration DDL before implementation. Other module tables remain in the existing repository and need their own RLS/tenant constraint designs before migration.

## 9. Person merge, history and rollback

1. Detect candidates using stable verified identifiers and reviewed evidence. Names are never sufficient; email/phone match alone is only a candidate signal.
2. Require an authorized reviewer and record evidence reference, proposed canonical person and affected-record plan in the merge case/audit.
3. Lock both persons and recheck all links. If both have different non-null Auth IDs, reject. Never combine, move or unlink either Auth identity silently. If one has an Auth link, preserve it only after the reviewer confirms the target person and recovery/ownership checks.
4. Precompute all dependent FKs across identity, membership, student/staff/guardian, module records and storage ownership. Preserve source IDs in legacy maps. Historical event `actor_person_id` and authored-by references remain unchanged.
5. In one transaction, migrate only current ownership relationships approved in the plan, set the losing person’s `merged_into_person_id`, add immutable audit events, and commit. If any FK, uniqueness or authorization check fails, the database transaction rolls back all changes.
6. A post-commit mistake is corrected with a compensating correction case: preserve original merge/audit rows, append correction events, restore current relationships where safe, and update the merge pointer only through the reviewed correction function. Do not rewrite historical event actors or delete audit evidence.

`persons.auth_user_id UNIQUE` and merge-function checks prevent one Auth user from linking to multiple people. Two distinct Auth IDs are never silently merged. If ownership of both cannot be proven and reconciled, records remain separate pending account recovery.

## 10. Explicit remaining decisions and assumptions

- Account provisioning for students without personal email/phone, including guardian-assisted setup that does not let guardians impersonate students.
- Whether one guardian can be active for multiple children: this design allows it, while enforcing only one active guardian per student.
- Whether student transfer and guardian replacement may overlap or require a period with no active link. The secure default is revoke-old and activate-new atomically after approval.
- School identifier uniqueness: Prisma currently declares school code and student code globally unique; changing scope requires approval.
- Exact category list and data fields for unified staff records.
- Which school-level permissions are assignable to custom roles; sensitive and management permissions default to protected.
- Existing password hash format validation and representative Auth import test. Backend uses bcryptjs with cost 10, but no stored hash values were inspected.
- Exact authorization matrix for platform/org/school administrators and high-risk school permissions.
- Existing finance model reconciliation and treatment of mutable wallet balance snapshots.
- Data retention, Auth-account deactivation and audit retention durations.

## 11. DDL addendum: identity, custom roles, guardian workflow and audit

This addendum supplies the canonical DDL for the remaining identity/workflow tables. It supersedes any earlier abbreviated inventory notes. Referenced existing/target tables must expose the stated unique keys before these FKs can be created.

Private identity/contact tables must be created in a non-exposed schema with no Data API grants. Example minimum shape:

```sql
create table private.person_private_identity (
  person_id uuid primary key references public.persons(id) on delete restrict,
  legal_first_name text not null,
  legal_last_name text not null,
  date_of_birth date,
  government_id_ciphertext bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.person_contact_points (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete restrict,
  kind text not null check (kind in ('email','phone','other')),
  value_ciphertext bytea not null,
  normalized_value_hash bytea not null,
  verified_at timestamptz,
  verified_auth_user_id uuid references auth.users(id),
  is_primary boolean not null default false,
  status text not null check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  check ((verified_at is null) = (verified_auth_user_id is null))
);
create index person_contact_owner_status_idx
  on private.person_contact_points(person_id, status);
create index person_contact_lookup_hash_idx
  on private.person_contact_points(kind, normalized_value_hash)
  where status = 'active';
create unique index person_one_primary_contact_per_kind
  on private.person_contact_points(person_id, kind)
  where is_primary and status = 'active';
```

Do not make contact hash globally unique: family email/phone sharing is possible. Trusted invitation workflows check contact control and conflict policy; the hash is lookup support, not identity proof.

### Person and membership keys

```sql
create table public.persons (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  status text not null default 'active'
    check (status in ('active','inactive','merged')),
  merged_into_person_id uuid references public.persons(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (merged_into_person_id is null or merged_into_person_id <> id),
  unique (id, auth_user_id)
);

create table public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  person_id uuid not null references public.persons(id) on delete restrict,
  status text not null check (status in ('invited','active','suspended','revoked')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (school_id, person_id),
  unique (school_id, id),
  unique (school_id, id, person_id),
  check (
    (status in ('active','suspended') and started_at is not null and ended_at is null)
    or (status = 'invited' and started_at is null and ended_at is null)
    or (status = 'revoked' and ended_at is not null)
  ),
  check (status <> 'revoked' or ended_at is not null)
);
create unique index school_memberships_one_active_person
  on public.school_memberships(person_id) where status = 'active';
create index school_memberships_person_status_idx
  on public.school_memberships(person_id, status);
create index school_memberships_school_status_idx
  on public.school_memberships(school_id, status);

create table public.student_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  person_id uuid not null,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  school_membership_id uuid not null,
  student_code text not null,
  status text not null check (status in ('pending','active','inactive','transferred','archived')),
  created_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, id, person_id),
  unique (school_id, person_id),
  unique (school_id, student_code),
  foreign key (person_id, auth_user_id)
    references public.persons(id, auth_user_id) on delete restrict,
  foreign key (school_id, school_membership_id, person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict
);
create index student_records_school_status_idx
  on public.student_records(school_id, status);
create index student_records_membership_idx
  on public.student_records(school_id, school_membership_id);

create table public.staff_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  person_id uuid not null references public.persons(id) on delete restrict,
  school_membership_id uuid,
  staff_number text not null,
  employment_status text not null
    check (employment_status in ('active','on_leave','terminated','archived')),
  job_title text not null,
  department text,
  campus_id uuid,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, id, person_id),
  unique (school_id, person_id),
  unique (school_id, staff_number),
  foreign key (school_id, school_membership_id, person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict
);
create index staff_records_school_status_idx
  on public.staff_records(school_id, employment_status);

create table public.staff_record_categories (
  school_id uuid not null,
  staff_record_id uuid not null,
  category text not null check (
    category in ('teaching','administrative','health','student_support','operations','other')
  ),
  status text not null check (status in ('active','inactive')),
  primary key (staff_record_id, category),
  foreign key (school_id, staff_record_id)
    references public.staff_records(school_id, id) on delete restrict
);

create table public.teacher_details (
  school_id uuid not null,
  staff_record_id uuid primary key,
  qualification text,
  specialization text,
  join_date date,
  foreign key (school_id, staff_record_id)
    references public.staff_records(school_id, id) on delete restrict
);
```

The `student_records` composite Auth FK means the person’s linked Auth ID must equal the student row’s required Auth ID. The membership FK proves same school/person. A trusted provisioning function additionally checks that the membership is active and has the student role before activating the student record. `school_memberships` status checks constrain lifecycle shape; the transfer function serializes status changes and writes the audit trail.

### Role catalog, custom roles and actor-scoped assignments

```sql
create table private.permission_catalog (
  scope text not null check (scope in ('platform','organization','school','guardian')),
  permission_key text not null,
  custom_assignable boolean not null default false,
  description text not null,
  primary key (scope, permission_key)
);

create table private.role_definitions (
  scope text not null check (scope in ('platform','organization','school')),
  role_key text not null,
  is_builtin boolean not null default true check (is_builtin),
  protected boolean not null default true,
  description text not null,
  primary key (scope, role_key)
);

create table private.role_permissions (
  scope text not null,
  role_key text not null,
  permission_key text not null,
  primary key (scope, role_key, permission_key),
  foreign key (scope, role_key)
    references private.role_definitions(scope, role_key) on delete restrict,
  foreign key (scope, permission_key)
    references private.permission_catalog(scope, permission_key) on delete restrict
);

create table private.delegable_roles (
  scope text not null,
  grantor_role_key text not null,
  target_role_key text not null,
  primary key (scope, grantor_role_key, target_role_key),
  foreign key (scope, grantor_role_key)
    references private.role_definitions(scope, role_key) on delete restrict,
  foreign key (scope, target_role_key)
    references private.role_definitions(scope, role_key) on delete restrict
);

-- Organization and platform membership base keys needed by the role FKs.
-- Add these unique keys to the corresponding target tables.
-- organization_memberships: UNIQUE (organization_id, id, person_id)
-- platform_memberships: UNIQUE (id, person_id)

create table public.organization_membership_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  organization_membership_id uuid not null,
  scope text not null default 'organization' check (scope = 'organization'),
  role_key text not null,
  assigned_by_organization_membership_id uuid not null,
  assigned_by_person_id uuid not null,
  status text not null check (status in ('active','revoked')),
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (organization_id, organization_membership_id)
    references public.organization_memberships(organization_id, id) on delete restrict,
  foreign key (
    organization_id, assigned_by_organization_membership_id, assigned_by_person_id
  ) references public.organization_memberships(organization_id, id, person_id)
    on delete restrict,
  foreign key (scope, role_key)
    references private.role_definitions(scope, role_key) on delete restrict,
  check ((status = 'revoked') = (revoked_at is not null))
);
create unique index organization_role_one_active
  on public.organization_membership_roles(organization_membership_id, role_key)
  where status = 'active';

create table public.platform_membership_roles (
  id uuid primary key default gen_random_uuid(),
  platform_membership_id uuid not null,
  scope text not null default 'platform' check (scope = 'platform'),
  role_key text not null,
  assigned_by_platform_membership_id uuid not null,
  assigned_by_person_id uuid not null,
  status text not null check (status in ('active','revoked')),
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (platform_membership_id)
    references public.platform_memberships(id) on delete restrict,
  foreign key (assigned_by_platform_membership_id, assigned_by_person_id)
    references public.platform_memberships(id, person_id) on delete restrict,
  foreign key (scope, role_key)
    references private.role_definitions(scope, role_key) on delete restrict,
  check ((status = 'revoked') = (revoked_at is not null))
);
create unique index platform_role_one_active
  on public.platform_membership_roles(platform_membership_id, role_key)
  where status = 'active';

create table public.school_custom_roles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name text not null,
  status text not null check (status in ('active','archived')),
  created_by_membership_id uuid not null,
  created_by_person_id uuid not null,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, created_by_membership_id, created_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict
);
create unique index school_custom_roles_name_unique
  on public.school_custom_roles(school_id, lower(name));

create table public.school_custom_role_permissions (
  school_id uuid not null,
  custom_role_id uuid not null,
  scope text not null default 'school' check (scope = 'school'),
  permission_key text not null,
  primary key (school_id, custom_role_id, permission_key),
  foreign key (school_id, custom_role_id)
    references public.school_custom_roles(school_id, id) on delete restrict,
  foreign key (scope, permission_key)
    references private.permission_catalog(scope, permission_key) on delete restrict
);

create table public.school_membership_roles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  school_membership_id uuid not null,
  scope text not null default 'school' check (scope = 'school'),
  builtin_role_key text,
  custom_role_id uuid,
  assigned_by_school_membership_id uuid not null,
  assigned_by_person_id uuid not null,
  status text not null check (status in ('active','revoked')),
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((builtin_role_key is not null) <> (custom_role_id is not null)),
  check ((status = 'revoked') = (revoked_at is not null)),
  foreign key (school_id, school_membership_id)
    references public.school_memberships(school_id, id) on delete restrict,
  foreign key (school_id, assigned_by_school_membership_id, assigned_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  foreign key (scope, builtin_role_key)
    references private.role_definitions(scope, role_key) on delete restrict,
  foreign key (school_id, custom_role_id)
    references public.school_custom_roles(school_id, id) on delete restrict
);
create unique index school_builtin_role_one_active
  on public.school_membership_roles(school_membership_id, builtin_role_key)
  where status = 'active' and builtin_role_key is not null;
create unique index school_custom_role_one_active
  on public.school_membership_roles(school_membership_id, custom_role_id)
  where status = 'active' and custom_role_id is not null;
```

`organization_membership_roles` and `platform_membership_roles` use the same pattern: fixed `scope` check; exactly one built-in key (custom roles are school-only); target membership FK; actor membership FK including tenant, membership ID and person ID; and composite `(scope,role_key)` FK. Their uniqueness is one active role per membership/key. Their exact actor composites are `(organization_id, actor_org_membership_id, actor_person_id) → organization_memberships(organization_id,id,person_id)` and `(actor_platform_membership_id, actor_person_id) → platform_memberships(id,person_id)`.

The `custom_assignable` bit is not enough by itself to enforce custom permissions with an FK. The only write path is a `SECURITY INVOKER` function that checks the catalog flag and School Admin authority. Direct insert/update/delete grants on `school_custom_role_permissions` are revoked. Protected roles and catalog rows are migration-managed.

### Guardian relationship and permission-history DDL

This is the canonical DDL (it supersedes the state summary above). It intentionally has no guardian school-membership FK. `school_memberships` must have `UNIQUE (school_id,id,person_id)` and `student_records` must have `UNIQUE (school_id,id)`.

```sql
create table public.guardian_relationships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  guardian_person_id uuid not null references public.persons(id) on delete restrict,
  relationship_type text not null,
  status text not null check (
    status in ('pending','active','suspended','revoked','expired')
  ),
  verified_at timestamptz,
  verified_by_school_membership_id uuid,
  verified_by_person_id uuid,
  approved_at timestamptz,
  approved_by_school_membership_id uuid,
  approved_by_person_id uuid,
  activated_at timestamptz,
  suspended_at timestamptz,
  suspended_by_school_membership_id uuid,
  suspended_by_person_id uuid,
  suspension_reason text,
  revoked_at timestamptz,
  revoked_by_school_membership_id uuid,
  revoked_by_person_id uuid,
  revocation_reason text,
  expired_at timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id,id,guardian_person_id),
  foreign key (school_id,student_id)
    references public.student_records(school_id,id) on delete restrict,
  foreign key (school_id,verified_by_school_membership_id,verified_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,approved_by_school_membership_id,approved_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,suspended_by_school_membership_id,suspended_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,revoked_by_school_membership_id,revoked_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  check ((verified_at is null) = (verified_by_person_id is null)),
  check ((verified_at is null) = (verified_by_school_membership_id is null)),
  check ((approved_at is null) = (approved_by_person_id is null)),
  check ((approved_at is null) = (approved_by_school_membership_id is null)),
  check ((suspended_at is null) = (suspended_by_person_id is null)),
  check ((suspended_at is null) = (suspended_by_school_membership_id is null)),
  check ((revoked_at is null) = (revoked_by_person_id is null)),
  check ((revoked_at is null) = (revoked_by_school_membership_id is null)),
  check (status <> 'active' or (
    verified_at is not null and approved_at is not null and activated_at is not null
    and suspended_at is null and revoked_at is null and expired_at is null
  )),
  check (status <> 'pending' or (
    activated_at is null and suspended_at is null and revoked_at is null and expired_at is null
  )),
  check (status <> 'suspended' or (
    verified_at is not null and approved_at is not null and activated_at is not null
    and suspended_at is not null and revoked_at is null and expired_at is null
  )),
  check (status <> 'revoked' or (
    verified_at is not null and approved_at is not null and activated_at is not null
    and revoked_at is not null and revoked_by_person_id is not null and expired_at is null
  )),
  check (status <> 'expired' or (expired_at is not null and revoked_at is null))
);
create unique index guardian_one_active_per_student
  on public.guardian_relationships(student_id) where status = 'active';
create index guardian_relationship_school_student_status_idx
  on public.guardian_relationships(school_id,student_id,status);
create index guardian_relationship_person_status_idx
  on public.guardian_relationships(guardian_person_id,status);

create table public.guardian_relationship_permissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  guardian_relationship_id uuid not null,
  guardian_person_id uuid not null,
  scope text not null default 'guardian' check (scope = 'guardian'),
  permission_key text not null,
  status text not null check (status in ('active','revoked','expired')),
  granted_by_school_membership_id uuid not null,
  granted_by_person_id uuid not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_by_school_membership_id uuid,
  revoked_by_person_id uuid,
  revoked_at timestamptz,
  revocation_reason text,
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (school_id,guardian_relationship_id,guardian_person_id)
    references public.guardian_relationships(school_id,id,guardian_person_id) on delete restrict,
  foreign key (school_id,granted_by_school_membership_id,granted_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,revoked_by_school_membership_id,revoked_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (scope,permission_key)
    references private.permission_catalog(scope,permission_key) on delete restrict,
  check ((revoked_at is null) = (revoked_by_person_id is null)),
  check ((revoked_at is null) = (revoked_by_school_membership_id is null)),
  check (status <> 'revoked' or revoked_at is not null),
  check (status <> 'expired' or expired_at is not null),
  check (status <> 'active' or (revoked_at is null and expired_at is null))
);
create unique index guardian_permission_one_active
  on public.guardian_relationship_permissions(guardian_relationship_id,permission_key)
  where status = 'active';
create index guardian_permission_policy_lookup_idx
  on public.guardian_relationship_permissions
    (school_id,guardian_relationship_id,status,permission_key);
create index guardian_permission_expiry_idx
  on public.guardian_relationship_permissions(expires_at)
  where status = 'active' and expires_at is not null;
```

Expiry is checked by RLS using `expires_at is null or expires_at > now()`; a trusted expiry job changes status and appends an event. Grant history is never overwritten: revocation/expiry affect an existing grant row and a later regrant creates a new surrogate ID. If immutable grant history is required, use a separate append-only grant-event table; do not delete/reinsert the history.

The request/audit tables below use request PK `id`; same-school student/person and inviter/approver membership/person FKs; unique 32-byte token hash; explicit state checks; target/state/expiry and contact-hash indexes. Audit rows have a PK, same-school request/relationship and actor membership/person FKs, and object/time indexes. Audit rows have no update/delete policy and application roles lack those privileges.

The complete request/audit definitions are below. A guardian request can identify its invitee by verified Auth identity after acceptance; before then, `guardian_person_id` may be null. The request itself never grants data access.

```sql
create table public.guardian_link_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  guardian_person_id uuid references public.persons(id) on delete restrict,
  invited_contact_ciphertext bytea not null,
  invited_contact_hash bytea not null check (octet_length(invited_contact_hash) = 32),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  relationship_type text not null,
  status text not null check (
    status in ('invited','verified','approved','activated','rejected','expired','revoked')
  ),
  invited_by_membership_id uuid not null,
  invited_by_person_id uuid not null,
  verified_auth_user_id uuid references auth.users(id),
  verified_at timestamptz,
  approved_by_membership_id uuid,
  approved_by_person_id uuid,
  approved_at timestamptz,
  guardian_relationship_id uuid,
  expires_at timestamptz not null,
  rejected_by_membership_id uuid,
  rejected_by_person_id uuid,
  rejected_at timestamptz,
  revoked_by_membership_id uuid,
  revoked_by_person_id uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, student_id)
    references public.student_records(school_id, id) on delete restrict,
  foreign key (school_id, invited_by_membership_id, invited_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  foreign key (school_id, approved_by_membership_id, approved_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  foreign key (school_id, rejected_by_membership_id, rejected_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  foreign key (school_id, revoked_by_membership_id, revoked_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  foreign key (school_id, guardian_relationship_id, guardian_person_id)
    references public.guardian_relationships(school_id, id, guardian_person_id)
    on delete restrict,
  check ((verified_at is null) = (verified_auth_user_id is null)),
  check ((approved_at is null) = (approved_by_person_id is null)),
  check ((rejected_at is null) = (rejected_by_person_id is null)),
  check ((revoked_at is null) = (revoked_by_person_id is null)),
  check (status <> 'approved' or (verified_at is not null and approved_at is not null)),
  check (status <> 'activated' or guardian_relationship_id is not null)
);
create index guardian_request_student_status_expiry_idx
  on public.guardian_link_requests(school_id, student_id, status, expires_at);
create index guardian_request_contact_status_idx
  on public.guardian_link_requests(invited_contact_hash, status);

create table public.guardian_link_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  guardian_link_request_id uuid,
  guardian_relationship_id uuid,
  actor_membership_id uuid,
  actor_person_id uuid,
  event_type text not null check (
    event_type in ('invited','verified','approved','activated','rejected',
      'expired','suspended','revoked','permission_granted','permission_revoked')
  ),
  event_at timestamptz not null default now(),
  reason text,
  details jsonb not null default '{}'::jsonb,
  check (guardian_link_request_id is not null or guardian_relationship_id is not null),
  check ((actor_membership_id is null) = (actor_person_id is null)),
  foreign key (school_id, guardian_link_request_id)
    references public.guardian_link_requests(school_id, id) on delete restrict,
  foreign key (school_id, guardian_relationship_id)
    references public.guardian_relationships(school_id, id) on delete restrict,
  foreign key (school_id, actor_membership_id, actor_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict
);
create index guardian_link_audit_request_time_idx
  on public.guardian_link_audit(guardian_link_request_id, event_at);
create index guardian_link_audit_relationship_time_idx
  on public.guardian_link_audit(guardian_relationship_id, event_at);

create table public.account_link_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  person_id uuid not null references public.persons(id) on delete restrict,
  target_kind text not null check (target_kind in ('student','staff')),
  student_record_id uuid,
  staff_record_id uuid,
  invited_contact_ciphertext bytea not null,
  invited_contact_hash bytea not null check (octet_length(invited_contact_hash) = 32),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  status text not null check (
    status in ('invited','verified','approved','completed','rejected','expired','revoked')
  ),
  invited_by_membership_id uuid not null,
  invited_by_person_id uuid not null,
  verified_auth_user_id uuid references auth.users(id),
  verified_at timestamptz,
  approved_by_membership_id uuid,
  approved_by_person_id uuid,
  approved_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, student_record_id, person_id)
    references public.student_records(school_id, id, person_id) on delete restrict,
  foreign key (school_id, staff_record_id, person_id)
    references public.staff_records(school_id, id, person_id) on delete restrict,
  foreign key (school_id, invited_by_membership_id, invited_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  foreign key (school_id, approved_by_membership_id, approved_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  check (
    (target_kind = 'student' and staff_record_id is null)
    or (target_kind = 'staff' and student_record_id is null)
  ),
  check ((verified_at is null) = (verified_auth_user_id is null)),
  check ((approved_at is null) = (approved_by_person_id is null)),
  check (status <> 'completed' or (approved_at is not null and completed_at is not null))
);
create index account_link_person_status_expiry_idx
  on public.account_link_requests(school_id, person_id, status, expires_at);
create index account_link_contact_status_idx
  on public.account_link_requests(invited_contact_hash, status);

create table public.account_link_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  account_link_request_id uuid not null,
  actor_membership_id uuid,
  actor_person_id uuid,
  event_type text not null check (
    event_type in ('invited','verified','approved','completed','rejected','expired','revoked')
  ),
  event_at timestamptz not null default now(),
  reason text,
  details jsonb not null default '{}'::jsonb,
  check ((actor_membership_id is null) = (actor_person_id is null)),
  foreign key (school_id, account_link_request_id)
    references public.account_link_requests(school_id, id) on delete restrict,
  foreign key (school_id, actor_membership_id, actor_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict
);
create index account_link_audit_request_time_idx
  on public.account_link_audit(account_link_request_id, event_at);
```

For student onboarding, the account invitation is completed before `student_records` is inserted because every student row requires an Auth ID. At invitation time the account-link request can have a null target record ID; the trusted completion function must verify the admission decision, exact person/school and verified Auth identity before creating the student row and linking the request. Staff requests point to an existing staff row. No polymorphic ID is trusted without matching `target_kind` and the same-school/person composite FK.

```sql
create table public.person_merge_audit (
  id uuid primary key default gen_random_uuid(),
  merge_id uuid not null,
  event_type text not null check (
    event_type in ('proposed','approved','started','completed','failed',
      'correction_proposed','corrected','rejected')
  ),
  source_person_id uuid not null references public.persons(id) on delete restrict,
  canonical_person_id uuid not null references public.persons(id) on delete restrict,
  actor_person_id uuid not null references public.persons(id) on delete restrict,
  event_at timestamptz not null default now(),
  evidence_reference text,
  reason text not null,
  details jsonb not null default '{}'::jsonb,
  check (source_person_id <> canonical_person_id)
);
create index person_merge_audit_merge_time_idx
  on public.person_merge_audit(merge_id, event_at);
create index person_merge_audit_people_time_idx
  on public.person_merge_audit(source_person_id, canonical_person_id, event_at);
```

Append-only is enforced by revoking `UPDATE`, `DELETE` and `TRUNCATE` from application roles, defining no such RLS policies, and adding a `BEFORE UPDATE OR DELETE` trigger that raises an exception. Trusted workflows receive insert capability only. These controls apply to guardian/account/merge audits and financial audit.

`legacy_person_map` has PK `(source_table,source_id)`, FK `person_id → persons`, status/reviewer fields and index `(person_id,resolution_status)`. `legacy_staff_map` has the same source PK, FK `staff_record_id → staff_records`, review fields and index `(staff_record_id,resolution_status)`. Neither crosswalk authorizes access.

## Readiness assessment

The confirmed product rules are internally reconcilable with the architecture. The one-school-membership rule requires guardian authorization to be relationship-based rather than guardian-school-membership-based; the design now does that. Student accounts are mandatory and require a student/Auth/person composite integrity path. Staff are unified, roles are scope-bound, and financial history is append-only.

**Implementation readiness: not yet ready.** The cardinality, guardian, role-actor FK, request/audit, password-migration, ledger and merge designs are specified. Before migrations, complete/review the remaining base organization/platform membership DDL and built-in permission seed matrix; formalize the student no-contact account process; finalize the custom-role assignable permission list; and complete module-specific RLS/tenant constraints for existing business tables. Password hash compatibility requires an isolated test with representative synthetic hashes before choosing import over reset. No implementation has begun; this report is saved for review, and I will wait for approval.
