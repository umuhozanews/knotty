# IshuriHUB Supabase Identity and Tenancy Design V3

**Purpose:** targeted correction of V2. This remains a design report, not an implementation or migration. No database was contacted, no SQL executed, and no application files changed. V2 is preserved.

## 1. Confirmed decisions and contradictions resolved

| Confirmed decision | V3 interpretation |
|---|---|
| One active school membership per person | Membership history is retained; one global partial unique index enforces active membership. There is no permanent person/school unique constraint, so return to a prior school is possible. |
| Every student has a Supabase Auth account | Every `student_records` row has non-null Auth ID, exact person/Auth composite FK and same-school active membership link. Auth provisioning precedes row creation. |
| One active guardian per student | Partial unique index on the student for active links. Guardian identity is not a school membership and can have relationships across schools. |
| Unified staff | Canonical `staff_records` one per person/school; `staff_record_categories` describes active categories; typed category detail tables hold category-specific fields. `staff_category_details` is removed from the canonical name set. |
| Hybrid roles | Protected built-ins are migration-managed. School custom roles can contain only catalog permissions marked custom-assignable. |
| Three management levels | Platform Admin, Organization Manager and School Admin have separate scopes. Org/platform membership alone never authorizes school student-data access. |
| Immutable finance | Pending intent is mutable under a state machine; posted ledger headers, entries and audit events are append-only. Corrections are new reversal/refund/adjustment transactions. |
| Password migration | Compatible bcrypt/Argon2 hashes may be imported using the trusted Supabase Auth Admin API after isolated compatibility tests; otherwise force secure reset/invitation. |

V2 has material inconsistencies corrected here: permanent `(person_id,school_id)` membership uniqueness; guardian request FK not binding the exact relationship/student/person tuple; account request activation not requiring target-record identity; cross-currency ledger balancing; generic `staff_category_details` wording versus `staff_record_categories` plus typed details; and a conflict where `SECURITY INVOKER` was expected to mutate tables with no caller write grants.

## 2. Canonical relationship keys and school membership history

The following target keys are prerequisites for the composite FKs later in this document:

```sql
create table public.persons (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  status text not null check (status in ('active','inactive','merged')),
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
  unique (school_id, id),
  unique (school_id, id, person_id),
  check (
    (status in ('active','suspended') and started_at is not null and ended_at is null)
    or (status = 'invited' and started_at is null and ended_at is null)
    or (status = 'revoked' and ended_at is not null)
  )
);

create unique index school_memberships_one_active_global
  on public.school_memberships(person_id)
  where status = 'active';

create unique index school_memberships_one_active_per_school
  on public.school_memberships(person_id, school_id)
  where status = 'active';

create index school_memberships_person_status_idx
  on public.school_memberships(person_id, status);
create index school_memberships_school_status_idx
  on public.school_memberships(school_id, status);
```

There is deliberately **no** `UNIQUE(person_id,school_id)` or `UNIQUE(school_id,person_id)` constraint. The partial indexes permit any number of historical memberships for a person/school pair, but at most one active membership globally. The per-school partial index is logically implied by the global index, retained to make the requested invariant explicit and to support school-scoped access patterns.

### Atomic transfer

`private.transfer_school_membership(person_id, old_membership_id, new_school_id, reason)` is the only transfer write path. It must be a single database transaction: lock the person and old membership; derive actor from `auth.uid()`; authorize current school and destination-school provisioning; mark the old row revoked with end time and audit event; insert/activate the destination row; transfer/update school-owned active identity links as approved; write destination audit event; commit. The partial unique index is the final race guard. Any failure rolls back old revocation and new activation together. Return-to-same-school creates a new membership row; historical rows remain.

Students require Auth and a matching membership. Guardians do **not** require a school membership; guardian relationships are independent, school-scoped links. Platform and organization memberships are independent of this cardinality.

## 3. Student, staff and account identity constraints

### Student rows require Auth

```sql
create table public.student_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  person_id uuid not null,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  school_membership_id uuid not null,
  student_code text not null,
  status text not null check (
    status in ('pending','active','inactive','transferred','archived')
  ),
  created_at timestamptz not null default now(),
  unique (school_id,id),
  unique (school_id,id,person_id),
  unique (school_id,person_id),
  unique (school_id,student_code),
  foreign key (person_id,auth_user_id)
    references public.persons(id,auth_user_id) on delete restrict,
  foreign key (school_id,school_membership_id,person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict
);
create unique index student_one_active_record_per_person
  on public.student_records(person_id) where status = 'active';
create index student_records_school_status_idx
  on public.student_records(school_id,status);
create index student_records_membership_idx
  on public.student_records(school_id,school_membership_id);
```

The unique composite on `(person_id,auth_user_id)` ensures the student Auth ID equals the Auth ID linked to that person. The required membership FK proves school/person matching. A trusted activation function additionally checks membership status and student role; the cross-row status/role facts are not ordinary CHECK constraints. The global active-record index prevents a transfer from leaving two active student records.

### Unified staff category model

Canonical naming is `staff_records`, `staff_record_categories`, and typed category detail tables. There is no `staff_category_details` table in V3.

```sql
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
  unique (school_id,id),
  unique (school_id,id,person_id),
  unique (school_id,person_id),
  unique (school_id,staff_number),
  foreign key (school_id,school_membership_id,person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict
);
create index staff_records_school_status_idx
  on public.staff_records(school_id,employment_status);
create index staff_records_membership_idx
  on public.staff_records(school_id,school_membership_id)
  where school_membership_id is not null;

create table public.staff_record_categories (
  school_id uuid not null,
  staff_record_id uuid not null,
  category text not null check (
    category in ('teaching','administrative','health','student_support','operations','other')
  ),
  status text not null check (status in ('active','inactive')),
  primary key (staff_record_id,category),
  foreign key (school_id,staff_record_id)
    references public.staff_records(school_id,id) on delete restrict
);

create table public.teacher_details (
  school_id uuid not null,
  staff_record_id uuid primary key,
  qualification text,
  specialization text,
  join_date date,
  foreign key (school_id,staff_record_id)
    references public.staff_records(school_id,id) on delete restrict
);
```

Other category-specific details should use separately typed tables only when fields are defined and needed; do not add a generic JSON details table by default. `staff_record_categories` is the category membership table; `teacher_details` is the typed teaching extension. `Teacher` and `Staff` remain source tables for migration and map to one target row per person/school only after identity review, never by name alone.

### Student and staff account provisioning order

Student request sequence: create pending admission/person; trusted Edge Function calls Supabase Auth Admin to invite/create an unconfirmed Auth identity; verify contact and school admission separately; trusted database RPC binds the Auth ID to the person, creates/activates the school membership and inserts the student row in one DB transaction. A student row is never inserted without Auth ID. Staff record may exist without Auth; linking requires verified account ownership and independent school employment approval. If Auth creation succeeds but DB activation fails, retain a pending/idempotent request and retry or expire it; do not claim the two separate systems committed atomically.

## 4. Guardian relationships, requests and permissions

Guardian verification means both: (a) Auth verified control of an email/phone, and (b) school-approved evidence that this person is entitled to the specific student relationship. Contact verification alone never establishes entitlement.

```sql
create table public.guardian_relationships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  guardian_person_id uuid not null,
  guardian_auth_user_id uuid,
  relationship_type text not null
    check (relationship_type in ('parent','legal_guardian','caregiver','other')),
  status text not null
    check (status in ('pending','active','suspended','revoked','expired')),
  identity_verified_at timestamptz,
  relationship_verified_at timestamptz,
  relationship_verified_by_membership_id uuid,
  relationship_verified_by_person_id uuid,
  approved_at timestamptz,
  approved_by_membership_id uuid,
  approved_by_person_id uuid,
  activated_at timestamptz,
  suspended_at timestamptz,
  suspended_by_membership_id uuid,
  suspended_by_person_id uuid,
  suspension_reason text,
  revoked_at timestamptz,
  revoked_by_membership_id uuid,
  revoked_by_person_id uuid,
  revocation_reason text,
  expired_at timestamptz,
  expired_by_membership_id uuid,
  expired_by_person_id uuid,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (school_id,id,student_id,guardian_person_id,guardian_auth_user_id),
  foreign key (school_id,student_id)
    references public.student_records(school_id,id) on delete restrict,
  foreign key (guardian_person_id,guardian_auth_user_id)
    references public.persons(id,auth_user_id) on delete restrict,
  foreign key (school_id,relationship_verified_by_membership_id,
               relationship_verified_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,approved_by_membership_id,approved_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,suspended_by_membership_id,suspended_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,revoked_by_membership_id,revoked_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,expired_by_membership_id,expired_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,

  check ((guardian_auth_user_id is null) = (identity_verified_at is null)),
  check ((relationship_verified_at is null) =
         (relationship_verified_by_membership_id is null)),
  check ((relationship_verified_at is null) =
         (relationship_verified_by_person_id is null)),
  check ((approved_at is null) = (approved_by_membership_id is null)),
  check ((approved_at is null) = (approved_by_person_id is null)),
  check (approved_at is null or (
    identity_verified_at is not null and relationship_verified_at is not null
  )),
  check ((suspended_at is null) = (suspended_by_membership_id is null)),
  check ((suspended_at is null) = (suspended_by_person_id is null)),
  check ((revoked_at is null) = (revoked_by_membership_id is null)),
  check ((revoked_at is null) = (revoked_by_person_id is null)),
  check ((expired_at is null) = (expired_by_membership_id is null)),
  check ((expired_at is null) = (expired_by_person_id is null)),
  check (status <> 'active' or (
    guardian_auth_user_id is not null and identity_verified_at is not null
    and relationship_verified_at is not null and approved_at is not null
    and activated_at is not null and suspended_at is null
    and revoked_at is null and expired_at is null
  )),
  check (status <> 'pending' or (
    activated_at is null and suspended_at is null and revoked_at is null
    and expired_at is null
  )),
  check (status <> 'suspended' or (
    guardian_auth_user_id is not null and identity_verified_at is not null
    and relationship_verified_at is not null and approved_at is not null
    and activated_at is not null and suspended_at is not null
    and revoked_at is null and expired_at is null
  )),
  check (status <> 'revoked' or (
    activated_at is not null and revoked_at is not null
    and revoked_by_membership_id is not null and revoked_by_person_id is not null
    and expired_at is null and suspended_at is null
  )),
  check (status <> 'expired' or (
    activated_at is not null and expired_at is not null
    and expired_by_membership_id is not null and expired_by_person_id is not null
    and guardian_auth_user_id is not null and identity_verified_at is not null
    and relationship_verified_at is not null and approved_at is not null
    and revoked_at is null and suspended_at is null
  ))
);

create unique index guardian_one_active_per_student
  on public.guardian_relationships(student_id) where status = 'active';
create index guardian_relationship_school_student_status_idx
  on public.guardian_relationships(school_id,student_id,status);
create index guardian_relationship_person_auth_status_idx
  on public.guardian_relationships(guardian_person_id,guardian_auth_user_id,status);
```

The guardian request must bind to the **exact** relationship, school, student and guardian identity. The composite unique key above exists for this FK:

```sql
create table public.guardian_link_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  guardian_person_id uuid,
  guardian_auth_user_id uuid,
  guardian_relationship_id uuid,
  invited_contact_ciphertext bytea not null,
  invited_contact_hash bytea not null check (octet_length(invited_contact_hash) = 32),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  status text not null check (
    status in ('invited','identity_verified','approved','activated','rejected','expired','revoked')
  ),
  invited_by_membership_id uuid not null,
  invited_by_person_id uuid not null,
  identity_verified_at timestamptz,
  relationship_verified_by_membership_id uuid,
  relationship_verified_by_person_id uuid,
  relationship_verified_at timestamptz,
  approved_by_membership_id uuid,
  approved_by_person_id uuid,
  approved_at timestamptz,
  activated_at timestamptz,
  rejected_by_membership_id uuid,
  rejected_by_person_id uuid,
  rejected_at timestamptz,
  revoked_by_membership_id uuid,
  revoked_by_person_id uuid,
  revoked_at timestamptz,
  expired_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id,id),

  foreign key (school_id,student_id)
    references public.student_records(school_id,id) on delete restrict,
  foreign key (guardian_person_id,guardian_auth_user_id)
    references public.persons(id,auth_user_id) on delete restrict,
  foreign key (school_id,guardian_relationship_id,student_id,
               guardian_person_id,guardian_auth_user_id)
    references public.guardian_relationships
      (school_id,id,student_id,guardian_person_id,guardian_auth_user_id)
    on delete restrict,
  foreign key (school_id,invited_by_membership_id,invited_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,relationship_verified_by_membership_id,
               relationship_verified_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,approved_by_membership_id,approved_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,rejected_by_membership_id,rejected_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,revoked_by_membership_id,revoked_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,

  check ((guardian_person_id is null) = (guardian_auth_user_id is null)),
  check ((guardian_auth_user_id is null) = (identity_verified_at is null)),
  check ((relationship_verified_at is null) =
         (relationship_verified_by_membership_id is null)),
  check ((relationship_verified_at is null) =
         (relationship_verified_by_person_id is null)),
  check ((approved_at is null) = (approved_by_membership_id is null)),
  check ((approved_at is null) = (approved_by_person_id is null)),
  check ((rejected_at is null) = (rejected_by_membership_id is null)),
  check ((rejected_at is null) = (rejected_by_person_id is null)),
  check ((revoked_at is null) = (revoked_by_membership_id is null)),
  check ((revoked_at is null) = (revoked_by_person_id is null)),
  check ((expired_at is not null) = (status='expired')),
  check (status <> 'invited' or (
    identity_verified_at is null and relationship_verified_at is null
    and approved_at is null and activated_at is null
    and rejected_at is null and revoked_at is null
  )),
  check (status <> 'identity_verified' or (
    guardian_person_id is not null and guardian_auth_user_id is not null
    and identity_verified_at is not null and relationship_verified_at is null
    and approved_at is null and activated_at is null
    and rejected_at is null and revoked_at is null and expired_at is null
  )),
  check (status <> 'approved' or (
    identity_verified_at is not null and relationship_verified_at is not null
    and approved_at is not null and activated_at is null
    and rejected_at is null and revoked_at is null and expired_at is null
  )),
  check (status <> 'activated' or (
    guardian_person_id is not null and guardian_auth_user_id is not null
    and guardian_relationship_id is not null and identity_verified_at is not null
    and relationship_verified_at is not null and approved_at is not null
    and activated_at is not null and rejected_at is null
    and revoked_at is null and expired_at is null
  )),
  check (status <> 'rejected' or (
    rejected_at is not null and rejected_by_membership_id is not null
    and rejected_by_person_id is not null and activated_at is null
    and revoked_at is null and expired_at is null
  )),
  check (status <> 'revoked' or (
    revoked_at is not null and revoked_by_membership_id is not null
    and revoked_by_person_id is not null and activated_at is null
    and rejected_at is null and expired_at is null
  )),
  check (status <> 'expired' or (
    expired_at is not null and activated_at is null
    and rejected_at is null and revoked_at is null
  ))
);
create index guardian_request_target_status_idx
  on public.guardian_link_requests(school_id,student_id,status,expires_at);
create index guardian_request_contact_hash_idx
  on public.guardian_link_requests(invited_contact_hash,status);
```

The request declaration includes `expired_at`. PostgreSQL CHECK constraints cannot safely encode a changing clock. The expiry transition sets `status='expired'` and `expired_at`; RLS independently checks `expires_at > now()` for pending requests.

`guardian_relationship_permissions` uses a surrogate PK and preserves repeated historical grants. Each grant has a composite relationship FK and grant/revoke actors as same-school membership/person pairs. A partial unique index permits one active grant per relationship/key. RLS additionally checks expiry. Revocation or expiry is audited and the next request is denied.

```sql
create table public.guardian_relationship_permissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  guardian_relationship_id uuid not null,
  student_id uuid not null,
  guardian_person_id uuid not null,
  guardian_auth_user_id uuid not null,
  scope text not null default 'guardian' check (scope='guardian'),
  permission_key text not null,
  status text not null check (status in ('active','revoked','expired')),
  granted_by_membership_id uuid not null,
  granted_by_person_id uuid not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_by_membership_id uuid,
  revoked_by_person_id uuid,
  revoked_at timestamptz,
  revocation_reason text,
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (school_id,guardian_relationship_id,student_id,
               guardian_person_id,guardian_auth_user_id)
    references public.guardian_relationships
      (school_id,id,student_id,guardian_person_id,guardian_auth_user_id)
    on delete restrict,
  foreign key (school_id,granted_by_membership_id,granted_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,revoked_by_membership_id,revoked_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (scope,permission_key)
    references private.permission_catalog(scope,permission_key) on delete restrict,
  check ((revoked_at is null) = (revoked_by_membership_id is null)),
  check ((revoked_at is null) = (revoked_by_person_id is null)),
  check (status <> 'revoked' or revoked_at is not null),
  check (status <> 'expired' or expired_at is not null),
  check (status <> 'active' or (revoked_at is null and expired_at is null))
);
create unique index guardian_permission_one_active
  on public.guardian_relationship_permissions(guardian_relationship_id,permission_key)
  where status='active';
create index guardian_permission_policy_lookup_idx
  on public.guardian_relationship_permissions
    (school_id,student_id,guardian_auth_user_id,status,permission_key);
create index guardian_permission_expiry_idx
  on public.guardian_relationship_permissions(expires_at)
  where status='active' and expires_at is not null;

create table public.guardian_link_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  request_id uuid,
  relationship_id uuid,
  actor_membership_id uuid,
  actor_person_id uuid,
  event_type text not null check (
    event_type in ('invited','identity_verified','relationship_verified','approved',
      'activated','rejected','expired','suspended','revoked','permission_granted','permission_revoked')
  ),
  event_at timestamptz not null default now(),
  reason text,
  details jsonb not null default '{}'::jsonb,
  check (request_id is not null or relationship_id is not null),
  check ((actor_membership_id is null) = (actor_person_id is null)),
  foreign key (school_id,request_id)
    references public.guardian_link_requests(school_id,id) on delete restrict,
  foreign key (school_id,relationship_id)
    references public.guardian_relationships(school_id,id) on delete restrict,
  foreign key (school_id,actor_membership_id,actor_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict
);
create index guardian_link_audit_request_time_idx on public.guardian_link_audit(request_id,event_at);
create index guardian_link_audit_relationship_time_idx
  on public.guardian_link_audit(relationship_id,event_at);
```

`guardian_link_audit` uses PK `id`, FKs `(school_id,request_id)`, `(school_id,relationship_id)` and `(school_id,actor_membership_id,actor_person_id)`, an event enum/check, timestamp, reason and details. Index `(request_id,event_at)` and `(relationship_id,event_at)`. Rows are append-only.

## 5. Student/staff account-link request lifecycle

Student Auth creation precedes the student row. Staff records may precede Auth and can be linked after proof. Email/phone verification proves contact control; school approval establishes entitlement. The trusted completion function also proves the Auth ID maps to the exact person.

```sql
create table public.account_link_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  person_id uuid not null references public.persons(id) on delete restrict,
  target_kind text not null check (target_kind in ('student','staff')),
  student_record_id uuid,
  staff_record_id uuid,
  verified_auth_user_id uuid references auth.users(id),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  invited_contact_ciphertext bytea not null,
  invited_contact_hash bytea not null check (octet_length(invited_contact_hash) = 32),
  status text not null check (
    status in ('invited','identity_verified','approved','completed','rejected','expired','revoked')
  ),
  invited_by_membership_id uuid not null,
  invited_by_person_id uuid not null,
  identity_verified_at timestamptz,
  approved_by_membership_id uuid,
  approved_by_person_id uuid,
  approved_at timestamptz,
  completed_at timestamptz,
  rejected_by_membership_id uuid,
  rejected_by_person_id uuid,
  rejected_at timestamptz,
  revoked_by_membership_id uuid,
  revoked_by_person_id uuid,
  revoked_at timestamptz,
  expired_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id,id),
  foreign key (school_id,student_record_id,person_id)
    references public.student_records(school_id,id,person_id) on delete restrict,
  foreign key (school_id,staff_record_id,person_id)
    references public.staff_records(school_id,id,person_id) on delete restrict,
  foreign key (person_id,verified_auth_user_id)
    references public.persons(id,auth_user_id) on delete restrict,
  foreign key (school_id,invited_by_membership_id,invited_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,approved_by_membership_id,approved_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,rejected_by_membership_id,rejected_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,revoked_by_membership_id,revoked_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  check (
    (target_kind='student' and staff_record_id is null)
    or (target_kind='staff' and student_record_id is null and staff_record_id is not null)
  ),
  check ((verified_auth_user_id is null) = (identity_verified_at is null)),
  check ((approved_at is null) = (approved_by_membership_id is null)),
  check ((approved_at is null) = (approved_by_person_id is null)),
  check ((rejected_at is null) = (rejected_by_membership_id is null)),
  check ((rejected_at is null) = (rejected_by_person_id is null)),
  check ((revoked_at is null) = (revoked_by_membership_id is null)),
  check ((revoked_at is null) = (revoked_by_person_id is null)),
  check (status <> 'identity_verified' or (
    verified_auth_user_id is not null and identity_verified_at is not null
    and approved_at is null and completed_at is null
    and rejected_at is null and revoked_at is null and expired_at is null
  )),
  check (status <> 'approved' or (
    verified_auth_user_id is not null and identity_verified_at is not null
    and approved_at is not null and completed_at is null
    and rejected_at is null and revoked_at is null and expired_at is null
  )),
  check (status <> 'completed' or (
    verified_auth_user_id is not null and identity_verified_at is not null
    and approved_at is not null
    and completed_at is not null
    and rejected_at is null and revoked_at is null and expired_at is null
    and ((target_kind='student' and student_record_id is not null)
      or (target_kind='staff' and staff_record_id is not null))
  )),
  check (status <> 'invited' or (
    verified_auth_user_id is null and approved_at is null and completed_at is null
    and rejected_at is null and revoked_at is null and expired_at is null
  )),
  check (status <> 'rejected' or (
    rejected_at is not null and rejected_by_membership_id is not null
    and rejected_by_person_id is not null and completed_at is null
    and revoked_at is null and expired_at is null
  )),
  check (status <> 'revoked' or (
    revoked_at is not null and revoked_by_membership_id is not null
    and revoked_by_person_id is not null and completed_at is null
    and rejected_at is null and expired_at is null
  )),
  check (status <> 'expired' or (
    expired_at is not null and completed_at is null
    and rejected_at is null and revoked_at is null
  )),
  check ((status='completed') = (completed_at is not null)),
  check ((status='rejected') = (rejected_at is not null)),
  check ((status='revoked') = (revoked_at is not null)),
  check ((status='expired') = (expired_at is not null))
);
create index account_link_target_status_expiry_idx
  on public.account_link_requests(school_id,target_kind,person_id,status,expires_at);
create index account_link_contact_hash_idx
  on public.account_link_requests(invited_contact_hash,status);
```

When verified, the Auth identity must be bound to that exact person in the same trusted workflow. At completion a deferred/transactional integrity check verifies `persons.auth_user_id = verified_auth_user_id`; the final student FK independently enforces that match. Staff completion also updates the staff row’s optional membership/person link only after checking school membership. No request can be completed for a different student/person/school. The exact-person cross-table condition is enforced by the completion function, not by a plain CHECK.

`account_link_audit` has PK `id`, FK `(school_id,account_link_request_id)`, paired actor membership/person columns with composite same-school FK, event type, `event_at`, reason/details; index `(account_link_request_id,event_at)`. `person_merge_audit` has PK `id`, unique case/event sequencing as chosen, source/canonical/actor person FKs, event type/time, evidence reference and reason; indexes by merge ID/time and involved people/time. Both are append-only.

```sql
create table public.account_link_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  account_link_request_id uuid not null,
  actor_membership_id uuid,
  actor_person_id uuid,
  event_type text not null check (
    event_type in ('invited','identity_verified','approved','completed',
      'rejected','expired','revoked')
  ),
  event_at timestamptz not null default now(),
  reason text,
  details jsonb not null default '{}'::jsonb,
  check ((actor_membership_id is null) = (actor_person_id is null)),
  foreign key (school_id,account_link_request_id)
    references public.account_link_requests(school_id,id) on delete restrict,
  foreign key (school_id,actor_membership_id,actor_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict
);
create index account_link_audit_request_time_idx
  on public.account_link_audit(account_link_request_id,event_at);

create table public.person_merge_audit (
  id uuid primary key default gen_random_uuid(),
  merge_id uuid not null,
  event_number integer not null check (event_number > 0),
  event_type text not null check (
    event_type in ('proposed','approved','started','completed','failed',
      'correction_proposed','corrected','rejected')
  ),
  source_person_id uuid not null references public.persons(id) on delete restrict,
  canonical_person_id uuid not null references public.persons(id) on delete restrict,
  actor_person_id uuid not null references public.persons(id) on delete restrict,
  actor_platform_membership_id uuid not null,
  event_at timestamptz not null default now(),
  evidence_reference text,
  reason text not null,
  details jsonb not null default '{}'::jsonb,
  unique (merge_id,event_number),
  check (source_person_id <> canonical_person_id),
  foreign key (actor_platform_membership_id,actor_person_id)
    references public.platform_memberships(id,person_id) on delete restrict
);
create index person_merge_audit_case_time_idx
  on public.person_merge_audit(merge_id,event_at);
create index person_merge_audit_people_time_idx
  on public.person_merge_audit(source_person_id,canonical_person_id,event_at);
```

`financial_event_audit` has PK `id`, tenant FK, optional `(school_id,ledger_transaction_id)` FK, actor type, composite school-membership/person FK for human events, `(school_id,idempotency_key)` unique, event timestamp and indexes `(school_id,event_at)` and `(school_id,ledger_transaction_id,event_at)`. System events require null human actor fields; the trusted provider-posting RPC records provider event identity without attributing it to a human.

## 6. Financial ledger integrity

Pending provider attempts live in `payment_intents`; they are not ledger entries and may transition through a constrained state machine. A successful, independently verified provider result creates a posted ledger transaction once. Callback/provider verification is performed by an Edge Function; Postgres never validates provider secrets by itself.

```sql
create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  account_type text not null,
  student_id uuid,
  currency char(3) not null default 'RWF',
  status text not null check (status in ('active','frozen','closed')),
  unique (school_id,id),
  unique (school_id,id,currency),
  foreign key (school_id,student_id)
    references public.student_records(school_id,id) on delete restrict
);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  currency char(3) not null,
  idempotency_key text not null,
  event_type text not null,
  correction_kind text not null default 'none'
    check (correction_kind in ('none','full_reversal','partial_refund','adjustment')),
  source_type text not null,
  source_reference text,
  external_provider text,
  external_reference text,
  reverses_transaction_id uuid,
  actor_type text not null check (actor_type in ('human','system')),
  actor_school_membership_id uuid,
  actor_person_id uuid,
  posted_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (school_id,id),
  unique (school_id,id,currency),
  unique (school_id,idempotency_key),
  foreign key (school_id,reverses_transaction_id)
    references public.ledger_transactions(school_id,id) on delete restrict,
  foreign key (school_id,actor_school_membership_id,actor_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  check (
    (actor_type='human' and actor_school_membership_id is not null and actor_person_id is not null)
    or (actor_type='system' and actor_school_membership_id is null and actor_person_id is null)
  ),
  check ((correction_kind='none') = (reverses_transaction_id is null))
);
create unique index ledger_provider_reference_unique
  on public.ledger_transactions(external_provider,external_reference)
  where external_reference is not null;
create unique index ledger_one_full_reversal
  on public.ledger_transactions(school_id,reverses_transaction_id)
  where correction_kind='full_reversal';
create index ledger_transactions_source_idx
  on public.ledger_transactions(school_id,source_type,source_reference);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  transaction_id uuid not null,
  account_id uuid not null,
  currency char(3) not null,
  amount_minor bigint not null check (amount_minor <> 0),
  created_at timestamptz not null default now(),
  foreign key (school_id,transaction_id,currency)
    references public.ledger_transactions(school_id,id,currency) on delete restrict,
  foreign key (school_id,account_id,currency)
    references public.financial_accounts(school_id,id,currency) on delete restrict
);
create index ledger_entries_transaction_idx
  on public.ledger_entries(school_id,transaction_id);
create index ledger_entries_account_time_idx
  on public.ledger_entries(school_id,account_id,created_at);

create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  financial_account_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  provider text not null,
  idempotency_key text not null,
  provider_reference text,
  status text not null check (
    status in ('created','pending','succeeded','failed','cancelled','reconciliation_required')
  ),
  ledger_transaction_id uuid,
  created_by_membership_id uuid,
  created_by_person_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id,idempotency_key),
  foreign key (school_id,financial_account_id,currency)
    references public.financial_accounts(school_id,id,currency) on delete restrict,
  foreign key (school_id,ledger_transaction_id,currency)
    references public.ledger_transactions(school_id,id,currency) on delete restrict,
  foreign key (school_id,created_by_membership_id,created_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  check ((created_by_membership_id is null) = (created_by_person_id is null)),
  check (status <> 'succeeded' or ledger_transaction_id is not null)
);
create unique index payment_intent_provider_ref_unique
  on public.payment_intents(provider,provider_reference)
  where provider_reference is not null;
create index payment_intents_state_time_idx
  on public.payment_intents(school_id,status,created_at);
```

Currency consistency is enforced by composite FKs from every entry to both its transaction and financial account `(school_id,id,currency)`. The posting function groups and balances entries by currency; one header currency means all its entries must use that currency. It checks `SUM(amount_minor)=0` for the transaction/currency before commit. No cross-currency netting is accepted.

Full reversal: new transaction, exact sign-reversed entries, `correction_kind='full_reversal'`; partial unique index allows at most one full reversal per original. Partial refunds: multiple new transactions may reference the captured payment/source; under a lock on the original transaction/payment intent, the function ensures cumulative successful refunds do not exceed the captured amount and no full reversal already consumed it. Adjustment is a separately authorized new balanced transaction with reason/approval. Every operation has a unique school-scoped idempotency key; provider reference is unique where present. The function serializes concurrent refund/reversal attempts by locking the original payment/ledger header before summing existing posted corrections.

`financial_event_audit` is append-only and records intent, callback, post, reversal, refund, adjustment, reconciliation and failure events. Its actor membership/person FK is composite with school; system callbacks have `actor_type='system'` and no human actor. Audit events are idempotent by `(school_id,idempotency_key)`.

```sql
create table public.financial_event_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  ledger_transaction_id uuid,
  source_type text not null,
  source_reference text,
  actor_type text not null check (actor_type in ('human','system')),
  actor_school_membership_id uuid,
  actor_person_id uuid,
  event_type text not null check (
    event_type in ('initiated','provider_callback','posted','reversed','refund',
      'adjustment','reconciled','failed')
  ),
  idempotency_key text not null,
  event_at timestamptz not null default now(),
  reason text,
  details jsonb not null default '{}'::jsonb,
  unique (school_id,idempotency_key),
  foreign key (school_id,ledger_transaction_id)
    references public.ledger_transactions(school_id,id) on delete restrict,
  foreign key (school_id,actor_school_membership_id,actor_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  check (
    (actor_type='human' and actor_school_membership_id is not null and actor_person_id is not null)
    or (actor_type='system' and actor_school_membership_id is null and actor_person_id is null)
  )
);
create index financial_audit_school_time_idx
  on public.financial_event_audit(school_id,event_at);
create index financial_audit_ledger_time_idx
  on public.financial_event_audit(school_id,ledger_transaction_id,event_at);
```

### Database grants and immutability controls

Posted headers and entries have no direct application write path. RLS is enabled on all public ledger and audit tables. Read is granted only to authenticated clients and filtered by finance/account-owner/guardian finance policies. Mutation is performed only by reviewed posting/reversal functions.

```sql
revoke all privileges on public.ledger_transactions,
  public.ledger_entries, public.financial_event_audit
  from public, anon, authenticated, service_role;

revoke all privileges on public.guardian_link_audit,
  public.account_link_audit, public.person_merge_audit
  from public, anon, authenticated, service_role;

grant select on public.ledger_transactions,
  public.ledger_entries, public.financial_event_audit to authenticated;
grant select on public.guardian_link_audit,
  public.account_link_audit, public.person_merge_audit to authenticated;

-- The dedicated function owner receives only the table privileges needed by
-- the exact posting/audit functions. No browser/service-role direct writes.
-- The function owner is NOLOGIN and has no BYPASSRLS.

revoke update, delete, truncate on public.ledger_transactions,
  public.ledger_entries, public.financial_event_audit
  from anon, authenticated, service_role;
revoke insert, update, delete, truncate on public.guardian_link_audit,
  public.account_link_audit, public.person_merge_audit
  from public, anon, authenticated, service_role;
```

Attach `BEFORE UPDATE OR DELETE` triggers that always raise on ledger headers, entries and append-only audit rows. PostgreSQL row triggers do not intercept `TRUNCATE`, so explicitly revoke `TRUNCATE` and do not grant table ownership to application/function roles. Only a restricted migration/DB owner can alter these controls. No service key is exposed to the frontend.

```sql
create function private.reject_append_only_mutation()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin
  raise exception 'append-only row cannot be changed';
end; $$;
revoke all on function private.reject_append_only_mutation()
  from public, anon, authenticated, service_role;

create trigger ledger_transactions_immutable before update or delete
  on public.ledger_transactions for each row
  execute function private.reject_append_only_mutation();
create trigger ledger_entries_immutable before update or delete
  on public.ledger_entries for each row
  execute function private.reject_append_only_mutation();
create trigger financial_event_audit_immutable before update or delete
  on public.financial_event_audit for each row
  execute function private.reject_append_only_mutation();
create trigger guardian_link_audit_immutable before update or delete
  on public.guardian_link_audit for each row
  execute function private.reject_append_only_mutation();
create trigger account_link_audit_immutable before update or delete
  on public.account_link_audit for each row
  execute function private.reject_append_only_mutation();
create trigger person_merge_audit_immutable before update or delete
  on public.person_merge_audit for each row
  execute function private.reject_append_only_mutation();
-- REVOKE above blocks TRUNCATE for API roles; only a controlled migration
-- owner may alter triggers, change grants or truncate these tables.
```

## 7. Function security and trust boundaries

V2’s contradiction is resolved as follows:

- Read/check helpers use `SECURITY INVOKER` whenever their grants and RLS allow it.
- If clients have no direct table write privileges, an invoker RPC cannot perform the protected write. Atomic membership transfer, role change, guardian activation, student provisioning DB commit and ledger posting therefore use narrowly scoped `SECURITY DEFINER` RPCs. This is intentional privilege elevation, not an implicit RLS bypass.
- Each definer function is owned by a dedicated `NOLOGIN`, `NOBYPASSRLS` role with only required table/column privileges, not by `postgres` or a general migration owner. The function-owner role is not granted to clients. RLS remains enabled; policies scoped `TO` that non-login owner permit only the specific function-owned operations. Functions contain explicit caller/tenant/permission/state checks.
- Set `search_path=''`, fully qualify every object, use no untrusted dynamic SQL, derive acting user using `auth.uid()` (never accept actor ID as authority), lock rows before state changes, and write audit rows in the same transaction.
- Revoke function `EXECUTE` from `PUBLIC` and `anon`; grant only exact signatures to `authenticated` or the trusted Edge service role needed. `GRANT USAGE ON SCHEMA private` is only to roles that must resolve approved functions; private tables remain ungranted and schema is not Data API exposed. Function execute is a separate privilege from table grants.
- Tests must call each function as anon, an authenticated user without membership, a wrong-scope manager, a revoked member, and an allowed actor.

Supabase Auth Admin is **not** called from PostgreSQL RPC. Account creation, invite, disable, contact change, session revocation and password reset use a server-side Edge Function with Auth Admin credentials. The Edge Function authenticates the user request and checks business authorization, performs the Auth Admin operation, then invokes a database RPC for the transactional app-table changes. The database RPC receives the caller’s user JWT/context where human authorization is required. These are separate systems; use an idempotent workflow/outbox/retry state to handle Auth success followed by DB failure. Never pass a client-supplied actor ID or rely on `service_role` RLS bypass as user authorization. Supabase documents Auth Admin as a trusted server operation and Edge clients with user JWT versus admin/service client as distinct trust modes. [Edge Function security](https://supabase.com/docs/guides/functions/auth), [database functions](https://supabase.com/docs/guides/database/functions), [API grants and RLS](https://supabase.com/docs/guides/api/securing-your-api).

Required function contracts:

| Function | Mode | Contract |
|---|---|---|
| `private.has_school_permission(school_id,permission_key)` | Invoker if membership tables are queryable under caller RLS; otherwise narrow definer helper. | Requires `auth.uid`, active sole school membership, active role and permission. |
| `private.guardian_can(school_id,student_id,permission_key)` | Narrow definer helper only if needed to avoid policy recursion. | Matches Auth→person, exact active link/student/school, individual unexpired grant. |
| `private.transfer_school_membership(person_id,old_id,new_school_id,reason)` | Definer RPC. | Actor from JWT; authorized source/destination; lock and atomic revoke/create/audit. |
| `private.assign_membership_role(...)` | Definer RPC. | Actor membership composite, scope, active permission, delegable target role, no escalation, audit. |
| `private.set_custom_role_permissions(...)` | Definer RPC. | School Admin only; all permission keys exist and are `custom_assignable`; no protected grants. |
| `private.activate_guardian_relationship(request_id)` | Definer RPC. | Verified Auth/person exact match; authorized approver; exact request/student/school/person FKs; no existing active guardian; atomic request/link/audit transition. |
| `private.complete_student_account(request_id,auth_user_id)` | Definer RPC after Edge Auth Admin step. | Caller identity and school approval; exact person; creates required Auth-linked student record/membership; idempotent. |
| `private.complete_staff_account_link(request_id,auth_user_id)` | Definer RPC after Edge Auth Admin step. | Auth maps to exact person, employment approval and same-school membership; no duplicate or takeover. |
| `private.post_ledger_transaction(...)` | Definer RPC. | Actor/service context, tenant, currency, balance, idempotency, account locks and audit. |
| `private.post_refund(...)` | Definer RPC. | Locks original, verifies remaining refundable amount, idempotency and permissions. |

Custom-role table writes follow the same model: revoke direct `INSERT/UPDATE/DELETE` from authenticated clients; allow only the definer RPC owner the narrow privileges; RLS grants that non-login owner table access; function validates `custom_assignable` permissions and School Admin scope. No direct UI/table write path is needed.

## 8. RLS/grant checklist and table policy responsibility

All exposed tables enable RLS. `anon` has no privileges on identity/tenant/student/staff/guardian/finance objects. Grants and RLS are separate; default exposure is not assumed. Private identity, contacts, role catalogs, crosswalks and workflow secrets are not Data API exposed. Views must be security-invoker or unexposed.

| Table group | Read policy | Insert/update/delete policy |
|---|---|---|
| Persons/profile | Own safe fields; controlled directory projection. | Trusted linking/profile function; no client identity-link writes. |
| Private identity/contact | Dedicated least-privilege server/function only. | Trusted verification/update; no Data API writes. |
| Org/school/membership | Active membership at matching scope; management metadata only for org role. | Provisioning and scope-specific definer functions; no direct role/member escalation. |
| Role/permission catalogs | No client access. | Migration owner only. |
| Custom role definitions/permissions | Same-school School Admin reads own school. | Definer role function only; custom-assignable permission check. |
| Student records | Student self; assigned teacher; approved guardian category permission; school role permission. | Admission/account RPC; same-school immutable tenant keys. No hard delete. |
| Staff/categories/details | Staff self; authorized HR/academic scope. | HR/staff RPC; same-school FKs. Archive instead of hard delete. |
| Guardian links/grants | Guardian matching Auth person and active link; scoped registrar. | Guardian lifecycle/grant RPC only; audit each transition. |
| Requests | Invitee sees own request; authorizing school staff sees own school’s requests. | Workflow functions only. |
| Audits/legacy maps | Scoped auditor/migration role; no general user access. | Append-only function/migration inserts; no update/delete/truncate. |
| Pending payment intents | Payer and authorized bursar by school; provider service operation. | State-machine function only. |
| Ledger accounts/headers/entries | Finance permission; restricted account owner/guardian finance read. | No direct writes; posting/reversal/refund definer RPC only. |

Representative guardian policy (policy function must enforce every listed join, not accept guardian identity from the client):

```sql
create policy guardian_student_profile_read
on public.student_records for select to authenticated
using (private.guardian_can(
  school_id, id, 'guardian.student_profile.read_basic'
));
```

Representative table-level grants:

```sql
revoke all on public.student_records, public.staff_records,
  public.guardian_relationships, public.guardian_relationship_permissions
  from public, anon;
grant select on public.student_records, public.staff_records,
  public.guardian_relationships, public.guardian_relationship_permissions
  to authenticated;
-- Add insert/update only where a direct RLS policy is explicitly approved.
-- Sensitive tenant, Auth, role, financial and audit columns remain non-writable.
```

Function default execute grants must be reviewed: revoke `EXECUTE` from `PUBLIC`/`anon` and grant the exact function signature only to its caller role. Supabase notes that RLS does not itself constrain function execution, so this is mandatory. [Supabase API security guidance](https://supabase.com/docs/guides/api/securing-your-api).

## 9. Existing Prisma versus new Supabase tables

### Existing Prisma source tables to preserve during migration

| Existing Prisma table/model | V3 treatment |
|---|---|
| `Organization`, `School` | Retain IDs; add target composite keys as required; keep nullable school organization relation until approved otherwise. |
| `OrganizationMembership`, `SchoolMembership`, `PlatformMembership` | Historical source/backfill into person-based memberships and scoped roles. Reconcile cross-school active rows before enabling the global unique index. |
| `User` | Source for Auth ID/person/contact/legacy role mapping; never expose `password_hash`; retain temporarily for compatibility only. |
| `Student` | Source for `student_records`; every migrated student must have Auth user and matching person/membership before cutover. Unprovisioned records block cutover. |
| `Teacher`, `Staff` | Source rows mapped through reviewed crosswalk to one target staff record per person/school. |
| `ClassSection`, `Subject`, `AcademicTerm` | Existing assignment targets; add unique `(school_id,id)` and index FK columns. Confirm actual generated table names. |
| `KnottyCard`, `WalletTransaction`, `CanteenTransaction`, `FeePayment`, `Invoice`, `Payment`, `RefundRequest`, `ExternalPayment` | Compatibility/backfill sources; migrate immutable financial history and preserve source references. |
| Remaining school-owned Prisma module tables | Retain until each module has tenant-consistent FKs, grants/RLS and regression tests. |

### New Supabase target tables

`persons`; private `person_private_identity`; private `person_contact_points`; person-based platform/org/school memberships; three scoped membership-role assignment tables; private `role_definitions`, `permission_catalog`, `role_permissions`, `delegable_roles`; `school_custom_roles`, `school_custom_role_permissions`; `student_records`; `staff_records`; `staff_record_categories`; typed `teacher_details`; `teacher_assignments`; `guardian_relationships`; `guardian_relationship_permissions`; `guardian_link_requests`; `guardian_link_audit`; `account_link_requests`; `account_link_audit`; `person_merge_audit`; `legacy_person_map`; `legacy_staff_map`; `financial_accounts`; `payment_intents`; `ledger_transactions`; `ledger_entries`; `financial_event_audit`.

Canonical category naming is only `staff_record_categories` plus typed category detail tables. Do not create a second generic `staff_category_details` table. For audit history, canonical names are exactly those listed above. All relationship FKs to module tables must include school ID where the referenced entity is school-owned.

## 10. Password migration

The inspected backend uses `bcryptjs`; code calls `bcrypt.hash(password, 10)` and `bcrypt.compare`. No stored hashes were inspected. Current Supabase migration guidance documents bcrypt and Argon2 hash import through the Auth Admin create-user API’s supported `password_hash` input. Do not write directly to `auth.users`. Test representative synthetic hashes made with the project’s exact bcrypt implementation, prefix/encoding and cost in an isolated Supabase project. Existing UUID IDs may be preserved only if valid Auth UUIDs and all FK mappings are reconciled. Unsupported hashes or default/shared credentials require forced reset/invitation. [Supabase Auth migration guidance](https://supabase.com/kb/guides/migrate-from-auth0), [password security](https://supabase.com/docs/guides/auth/password-security).

Reset workflow: Auth enumeration-safe reset; verify contact; short-lived one-use reset; user chooses new password; revoke sessions as policy requires; notify user. School support must verify identity before changing a contact. Admins never see or set the user’s password.

## 11. Person merge and rollback

1. Detect duplicates only with verified stable identifiers/documentation; names and email/phone matches alone are not proof.
2. A reviewer approves the exact source/canonical pair and a precomputed list of dependent FKs. No open-ended merge by name.
3. Lock both persons. If both have different non-null Auth IDs, reject; no automatic account transfer or merge. If one has an Auth ID, preserve it only after explicit identity proof and account recovery approval.
4. Migrate only current ownership relationships approved in the plan. Keep source IDs in legacy maps. Do not rewrite historical audit actors, payment actors, attendance recorders, health authors or other event authors.
5. Perform all row moves, person merge pointer update, crosswalk updates and append-only merge event inserts in one transaction. Any failure rolls everything back.
6. A committed error is corrected through a compensating review/correction case and new audit events. Restore current links where safe; do not erase/overwrite the original merge events or silently rewrite history.

`persons.auth_user_id UNIQUE` prevents one Auth user from linking to multiple persons. The reviewed merge function rejects two conflicting Auth identities before moving any dependent row.

## 12. Implementation-readiness checklist

### Complete and internally consistent design portions

- One-active-school-membership cardinality with historical memberships and no permanent person/school uniqueness.
- Student required Auth identity, exact person/Auth composite relationship and one-active-student guard.
- Unified staff identity invariant and canonical category table naming.
- One active guardian per student; guardian does not require a school membership.
- Exact guardian request-to-relationship FK tuple and exact Auth/person relationship.
- Scoped assignment actor composite FK design and transfer/merge/ledger transaction invariants.
- Pending payment intent separated from immutable posted ledger.
- Currency-consistent transaction/account/entry FK strategy and per-currency balance requirement.
- Password hash support and safe fallback documented.

### DDL still missing or requiring final schema review

- Complete production-ready base DDL for organizations, schools, platform memberships, organization memberships, role catalogs, role assignments and custom role tables as one ordered migration set.
- Final DDL for guardian permission history and audit/request tables after confirming exact enum/state and retention choices. V3 gives the structural definitions, but they need SQL review and policy tests before migration.
- Complete account request DDL with deferred student-record creation path and final FK/state trigger strategy. Cross-table “person/Auth equals” at completion needs a transactional function or constraint trigger, not CHECK alone.
- Complete account/guardian request unique rules for pending invitation deduplication and token expiration cleanup.
- Complete database-side implementation of balanced-ledger enforcement, partial refund amount serialization, and immutable audit triggers.
- Full typed details for each non-teaching staff category, once fields are approved.
- Complete target FK/index migration for every school-owned Prisma business table.

### Exact RLS policies and grants still required

- Per-table `SELECT/INSERT/UPDATE/DELETE` policies, including both `USING` and `WITH CHECK` for updates.
- Column grants preventing changes to tenant IDs, Auth links, role keys, ledger/audit rows and immutable source references.
- Explicit schema/table/function grants and default privilege revocations for Data API exposure.
- Definer-owner RLS policies and ownership/grants for each narrowly scoped mutation RPC.
- Guardian/student/student-account/storage policy coverage; views must not bypass RLS.
- Restrict `TRUNCATE`, table ownership and trigger/function alteration to controlled migration operators.

### Built-in roles and permission seed matrix still required

- Exact key-by-key permission seeds for every built-in role; V3 defines the scope boundaries but does not finalize every role grant.
- Exact `custom_assignable` permission allowlist and `delegable_roles` rows.
- Explicit assignment/revocation rules for Platform Admin, Organization Manager and School Admin; no implicit hierarchy.

### Existing Prisma modules still needing tenant constraints and RLS

Students/admissions, staff/HR, classes/subjects/terms, attendance, exams/reports, fees/payments/refunds, cards/NFC/gate, wallets/canteen, library, health, discipline, visitors, transport/timetables, notifications, files/storage, analytics and audit. Preserve the current UI/API contract during phased migration, but do not expose a module until its tenant FKs, RLS, grants and tests are complete.

### Product decisions still unresolved

- How students without personal email/phone safely activate required accounts without guardian impersonation or shared credentials.
- Exact built-in permission matrix and sensitive-data access rules.
- Which school permissions can be assigned to custom roles.
- Whether school codes/student codes remain globally unique or become school-scoped; Prisma currently declares global uniqueness for key identifiers.
- Exact non-teaching staff categories/details.
- Student transfer and guardian replacement operational approvals and effective dates.
- Password-hash import versus forced reset after isolated format testing; no stored hashes were inspected.
- Record/audit retention and account deactivation policy.

### Tests required before implementation can be approved

- One active membership globally; returning to prior school creates valid historical row; concurrent transfers cannot yield two active memberships; failure rolls back atomically.
- Student insert without Auth, mismatched person/Auth, mismatched school membership or second active student record is rejected.
- Guardian request with mismatched school/student/person/Auth/relationship fails its composite FK; activated request with missing person/Auth/relationship/activation metadata fails; duplicate active guardian fails; replacement/revocation preserves history and denies subsequent access.
- Account request state transitions enforce exact target record/person/school/Auth; completed student requires student row; completed staff requires staff row; identity verification without school approval cannot complete; student provisioning retries are idempotent.
- Role actor FKs reject wrong-scope/wrong-tenant actors; assignment functions reject self-escalation and unauthorized built-in/custom permission grants.
- Currency mismatch between account, entry and transaction is rejected; balancing per currency; duplicate idempotency/provider callbacks post once; full reversal is unique and exact; parallel partial refunds cannot exceed captured amount.
- Direct UPDATE/DELETE/TRUNCATE of posted ledger/audit objects denied; immutable triggers reject changes; definer RPCs reject anon, unlinked, wrong-tenant and revoked actors.
- Person merge rejects different Auth IDs, retains original audit actor IDs, and failure rolls back every dependent change.
- Password import test with synthetic hashes and fallback reset/recovery test.

## Final readiness

V3 corrects the requested V2 integrity issues at the design level. The architecture remains **not implementation-ready**: exact role seeds, per-table RLS/grants, several ordered base-table DDLs, cross-table activation checks, ledger functions/triggers and module-level tenant constraints still require review and tests. The report intentionally marks these gaps rather than implying security is complete.

No database, application code, migration or existing file was changed. V2 remains preserved. V3 is ready for your review; I will wait for approval before implementation.
