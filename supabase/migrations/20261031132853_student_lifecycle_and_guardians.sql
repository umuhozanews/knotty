-- Student identity/profile and multi-guardian foundations. Student Auth
-- provisioning is a trusted server workflow and must precede row creation.

alter table private.permission_catalog
  drop constraint permission_catalog_scope_check,
  add constraint permission_catalog_scope_check
    check (scope in ('platform', 'organization', 'school', 'guardian'));

create table public.student_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  person_id uuid not null,
  auth_user_id uuid not null,
  school_membership_id uuid not null,
  admission_number text not null,
  date_of_birth date,
  gender text,
  nationality text,
  admission_date date not null default current_date,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'inactive', 'transferred', 'withdrawn', 'graduated', 'archived')),
  profile_photo_path text,
  created_by_membership_id uuid not null,
  created_by_person_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_records_admission_number_nonblank_check
    check (length(btrim(admission_number)) > 0),
  constraint student_records_school_person_key unique (school_id, person_id),
  constraint student_records_school_id_key unique (school_id, id),
  constraint student_records_school_id_person_key unique (school_id, id, person_id),
  constraint student_records_person_auth_fkey
    foreign key (person_id, auth_user_id)
    references public.persons(id, auth_user_id) on delete restrict,
  constraint student_records_school_membership_person_fkey
    foreign key (school_id, school_membership_id, person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  constraint student_records_created_by_school_member_fkey
    foreign key (school_id, created_by_membership_id, created_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict
);

create unique index student_records_admission_number_key
  on public.student_records (school_id, lower(admission_number));
create unique index student_one_active_record_per_person
  on public.student_records (person_id) where status = 'active';
create index student_records_school_status_idx
  on public.student_records (school_id, status, admission_date desc);
create index student_records_membership_idx
  on public.student_records (school_id, school_membership_id);
create index student_records_auth_user_idx
  on public.student_records (auth_user_id, school_id);

create table public.student_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid not null,
  document_kind text not null check (length(btrim(document_kind)) > 0),
  storage_object_path text not null unique,
  original_filename text not null check (length(btrim(original_filename)) > 0),
  content_type text not null,
  byte_size bigint not null check (byte_size > 0),
  uploaded_by_membership_id uuid not null,
  uploaded_by_person_id uuid not null,
  created_at timestamptz not null default now(),
  constraint student_documents_student_scope_fkey
    foreign key (school_id, student_id)
    references public.student_records(school_id, id) on delete restrict,
  constraint student_documents_uploader_school_member_fkey
    foreign key (school_id, uploaded_by_membership_id, uploaded_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict
);
create index student_documents_student_created_idx
  on public.student_documents (school_id, student_id, created_at desc);

create table public.guardian_relationships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid not null,
  guardian_person_id uuid not null,
  guardian_auth_user_id uuid,
  relationship_type text not null
    check (relationship_type in ('parent', 'legal_guardian', 'caregiver', 'other')),
  status text not null
    check (status in ('pending', 'active', 'suspended', 'revoked', 'expired')),
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
  created_by_membership_id uuid not null,
  created_by_person_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_relationships_id_scope_student_guardian_key
    unique (school_id, id, student_id, guardian_person_id, guardian_auth_user_id),
  constraint guardian_relationships_school_id_student_key
    unique (school_id, id, student_id),
  constraint guardian_relationships_student_scope_fkey
    foreign key (school_id, student_id)
    references public.student_records(school_id, id) on delete restrict,
  constraint guardian_relationships_person_auth_fkey
    foreign key (guardian_person_id, guardian_auth_user_id)
    references public.persons(id, auth_user_id) on delete restrict,
  constraint guardian_relationships_created_by_school_member_fkey
    foreign key (school_id, created_by_membership_id, created_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  constraint guardian_relationships_verified_by_school_member_fkey
    foreign key (school_id, relationship_verified_by_membership_id, relationship_verified_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  constraint guardian_relationships_approved_by_school_member_fkey
    foreign key (school_id, approved_by_membership_id, approved_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  constraint guardian_relationships_suspended_by_school_member_fkey
    foreign key (school_id, suspended_by_membership_id, suspended_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  constraint guardian_relationships_revoked_by_school_member_fkey
    foreign key (school_id, revoked_by_membership_id, revoked_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  constraint guardian_relationships_expired_by_school_member_fkey
    foreign key (school_id, expired_by_membership_id, expired_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  constraint guardian_relationships_auth_verification_pair_check
    check ((guardian_auth_user_id is null) = (identity_verified_at is null)),
  constraint guardian_relationships_relationship_verification_actor_check
    check ((relationship_verified_at is null) = (relationship_verified_by_membership_id is null)
      and (relationship_verified_at is null) = (relationship_verified_by_person_id is null)),
  constraint guardian_relationships_approval_actor_check
    check ((approved_at is null) = (approved_by_membership_id is null)
      and (approved_at is null) = (approved_by_person_id is null)),
  constraint guardian_relationships_suspension_actor_check
    check ((suspended_at is null) = (suspended_by_membership_id is null)
      and (suspended_at is null) = (suspended_by_person_id is null)),
  constraint guardian_relationships_revocation_actor_check
    check ((revoked_at is null) = (revoked_by_membership_id is null)
      and (revoked_at is null) = (revoked_by_person_id is null)),
  constraint guardian_relationships_expiration_actor_check
    check ((expired_at is null) = (expired_by_membership_id is null)
      and (expired_at is null) = (expired_by_person_id is null)),
  constraint guardian_relationships_active_state_check check (
    status <> 'active' or (guardian_auth_user_id is not null
      and identity_verified_at is not null and relationship_verified_at is not null
      and approved_at is not null and activated_at is not null
      and suspended_at is null and revoked_at is null and expired_at is null)
  ),
  constraint guardian_relationships_pending_state_check check (
    status <> 'pending' or (activated_at is null and suspended_at is null
      and revoked_at is null and expired_at is null)
  ),
  constraint guardian_relationships_suspended_state_check check (
    status <> 'suspended' or (guardian_auth_user_id is not null
      and identity_verified_at is not null and relationship_verified_at is not null
      and approved_at is not null and activated_at is not null
      and suspended_at is not null and revoked_at is null and expired_at is null)
  ),
  constraint guardian_relationships_revoked_state_check check (
    status <> 'revoked' or (activated_at is not null and revoked_at is not null
      and revoked_by_membership_id is not null and revoked_by_person_id is not null
      and guardian_auth_user_id is not null and identity_verified_at is not null
      and relationship_verified_at is not null and approved_at is not null
      and suspended_at is null and expired_at is null)
  ),
  constraint guardian_relationships_expired_state_check check (
    status <> 'expired' or (activated_at is not null and expired_at is not null
      and expired_by_membership_id is not null and expired_by_person_id is not null
      and guardian_auth_user_id is not null and identity_verified_at is not null
      and relationship_verified_at is not null and approved_at is not null
      and revoked_at is null and suspended_at is null)
  ),
  constraint guardian_relationships_lifecycle_time_order_check check (
    (identity_verified_at is null or identity_verified_at >= created_at)
    and (relationship_verified_at is null or relationship_verified_at >= created_at)
    and (approved_at is null or approved_at >= created_at)
    and (activated_at is null or activated_at >= created_at)
    and (suspended_at is null or suspended_at >= activated_at)
    and (revoked_at is null or revoked_at >= activated_at)
    and (expired_at is null or expired_at >= activated_at)
  )
);

-- Multiple guardians may be active for one student; duplicate active links
-- for the same guardian/student pair are prevented while history is retained.
create unique index guardian_relationship_one_active_per_pair
  on public.guardian_relationships (school_id, student_id, guardian_person_id)
  where status = 'active';
create index guardian_relationship_student_status_idx
  on public.guardian_relationships (school_id, student_id, status);
create index guardian_relationship_person_auth_status_idx
  on public.guardian_relationships (guardian_person_id, guardian_auth_user_id, status);

create table public.guardian_relationship_permissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  guardian_relationship_id uuid not null,
  student_id uuid not null,
  guardian_person_id uuid not null,
  guardian_auth_user_id uuid not null,
  scope text not null default 'guardian' check (scope = 'guardian'),
  permission_key text not null,
  status text not null check (status in ('active', 'revoked', 'expired')),
  granted_by_membership_id uuid not null,
  granted_by_person_id uuid not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_by_membership_id uuid,
  revoked_by_person_id uuid,
  revoked_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  constraint guardian_relationship_permissions_relationship_fkey
    foreign key (school_id, guardian_relationship_id, student_id, guardian_person_id, guardian_auth_user_id)
    references public.guardian_relationships (school_id, id, student_id, guardian_person_id, guardian_auth_user_id)
    on delete restrict,
  constraint guardian_relationship_permissions_grant_actor_fkey
    foreign key (school_id, granted_by_membership_id, granted_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  constraint guardian_relationship_permissions_revoke_actor_fkey
    foreign key (school_id, revoked_by_membership_id, revoked_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  constraint guardian_relationship_permissions_catalog_fkey
    foreign key (scope, permission_key)
    references private.permission_catalog(scope, permission_key) on delete restrict,
  constraint guardian_relationship_permissions_revocation_metadata_check check (
    (revoked_at is null) = (revoked_by_membership_id is null)
    and (revoked_at is null) = (revoked_by_person_id is null)
  ),
  constraint guardian_relationship_permissions_state_check check (
    (status = 'active' and revoked_at is null and expired_at is null)
    or (status = 'revoked' and revoked_at is not null and expired_at is null)
    or (status = 'expired' and expired_at is not null and revoked_at is null
      and expires_at is not null and expired_at >= expires_at)
  )
);
create unique index guardian_relationship_permissions_one_active
  on public.guardian_relationship_permissions (guardian_relationship_id, permission_key)
  where status = 'active';
create index guardian_relationship_permissions_policy_lookup_idx
  on public.guardian_relationship_permissions (school_id, student_id, guardian_auth_user_id, status, permission_key);
create index guardian_relationship_permissions_expiry_idx
  on public.guardian_relationship_permissions (expires_at)
  where status = 'active' and expires_at is not null;

create table public.guardian_link_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid not null,
  guardian_person_id uuid,
  guardian_auth_user_id uuid,
  relationship_id uuid,
  relationship_type text not null
    check (relationship_type in ('parent', 'legal_guardian', 'caregiver', 'other')),
  invited_contact_hash bytea not null check (octet_length(invited_contact_hash) = 32),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  status text not null default 'invited'
    check (status in ('invited', 'identity_verified', 'approved', 'activated', 'rejected', 'revoked', 'expired')),
  identity_verified_at timestamptz,
  relationship_verified_at timestamptz,
  relationship_verified_by_membership_id uuid,
  relationship_verified_by_person_id uuid,
  approved_at timestamptz,
  approved_by_membership_id uuid,
  approved_by_person_id uuid,
  activated_at timestamptz,
  rejected_at timestamptz,
  rejected_by_membership_id uuid,
  rejected_by_person_id uuid,
  revoked_at timestamptz,
  revoked_by_membership_id uuid,
  revoked_by_person_id uuid,
  expired_at timestamptz,
  expires_at timestamptz not null,
  invited_by_membership_id uuid not null,
  invited_by_person_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_link_requests_school_student_key unique (school_id, id, student_id),
  constraint guardian_link_requests_student_fkey
    foreign key (school_id, student_id)
    references public.student_records(school_id, id) on delete restrict,
  constraint guardian_link_requests_guardian_auth_fkey
    foreign key (guardian_person_id, guardian_auth_user_id)
    references public.persons(id, auth_user_id) on delete restrict,
  constraint guardian_link_requests_relationship_fkey
    foreign key (school_id, relationship_id, student_id, guardian_person_id, guardian_auth_user_id)
    references public.guardian_relationships(school_id, id, student_id, guardian_person_id, guardian_auth_user_id)
    on delete restrict,
  constraint guardian_link_requests_inviter_fkey
    foreign key (school_id, invited_by_membership_id, invited_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  constraint guardian_link_requests_verifier_fkey
    foreign key (school_id, relationship_verified_by_membership_id, relationship_verified_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  constraint guardian_link_requests_approver_fkey
    foreign key (school_id, approved_by_membership_id, approved_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  constraint guardian_link_requests_rejector_fkey
    foreign key (school_id, rejected_by_membership_id, rejected_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  constraint guardian_link_requests_revoker_fkey
    foreign key (school_id, revoked_by_membership_id, revoked_by_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict,
  constraint guardian_link_requests_guardian_pair_check
    check ((guardian_person_id is null) = (guardian_auth_user_id is null)),
  constraint guardian_link_requests_verifier_pair_check
    check ((relationship_verified_at is null) = (relationship_verified_by_membership_id is null)
      and (relationship_verified_at is null) = (relationship_verified_by_person_id is null)),
  constraint guardian_link_requests_approver_pair_check
    check ((approved_at is null) = (approved_by_membership_id is null)
      and (approved_at is null) = (approved_by_person_id is null)),
  constraint guardian_link_requests_rejector_pair_check
    check ((rejected_at is null) = (rejected_by_membership_id is null)
      and (rejected_at is null) = (rejected_by_person_id is null)),
  constraint guardian_link_requests_revoker_pair_check
    check ((revoked_at is null) = (revoked_by_membership_id is null)
      and (revoked_at is null) = (revoked_by_person_id is null)),
  constraint guardian_link_requests_identity_state_check check (
    status not in ('identity_verified', 'approved', 'activated', 'revoked')
    or (guardian_person_id is not null and guardian_auth_user_id is not null
      and identity_verified_at is not null)
  ),
  constraint guardian_link_requests_approval_state_check check (
    status not in ('approved', 'activated', 'revoked')
    or (relationship_verified_at is not null and approved_at is not null)
  ),
  constraint guardian_link_requests_activation_state_check check (
    status not in ('activated', 'revoked')
    or (relationship_id is not null and activated_at is not null)
  ),
  constraint guardian_link_requests_rejected_state_check check (
    status <> 'rejected' or (rejected_at is not null
      and rejected_by_membership_id is not null and rejected_by_person_id is not null)
  ),
  constraint guardian_link_requests_revoked_state_check check (
    status <> 'revoked' or (revoked_at is not null
      and revoked_by_membership_id is not null and revoked_by_person_id is not null)
  ),
  constraint guardian_link_requests_expired_state_check
    check (status <> 'expired' or expired_at is not null),
  constraint guardian_link_requests_expiry_order_check check (expires_at > created_at)
);

create unique index guardian_link_requests_one_open_contact
  on public.guardian_link_requests (school_id, student_id, invited_contact_hash)
  where status in ('invited', 'identity_verified', 'approved');
create index guardian_link_requests_student_status_idx
  on public.guardian_link_requests (school_id, student_id, status, expires_at);
create index guardian_link_requests_guardian_status_idx
  on public.guardian_link_requests (guardian_auth_user_id, status, expires_at)
  where guardian_auth_user_id is not null;

create table public.guardian_link_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  request_id uuid,
  relationship_id uuid,
  student_id uuid not null,
  actor_membership_id uuid not null,
  actor_person_id uuid not null,
  event_type text not null check (length(btrim(event_type)) > 0),
  event_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_data) = 'object'),
  created_at timestamptz not null default now(),
  constraint guardian_link_audit_request_fkey
    foreign key (school_id, request_id, student_id)
    references public.guardian_link_requests(school_id, id, student_id) on delete restrict,
  constraint guardian_link_audit_relationship_fkey
    foreign key (school_id, relationship_id, student_id)
    references public.guardian_relationships(school_id, id, student_id) on delete restrict,
  constraint guardian_link_audit_actor_fkey
    foreign key (school_id, actor_membership_id, actor_person_id)
    references public.school_memberships(school_id, id, person_id) on delete restrict
);
create index guardian_link_audit_student_created_idx
  on public.guardian_link_audit (school_id, student_id, created_at desc);

create function private.reject_guardian_link_audit_mutation()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  raise exception 'guardian_link_audit is append-only' using errcode = '55000';
end;
$$;
revoke all on function private.reject_guardian_link_audit_mutation()
  from public, anon, authenticated, service_role;
create trigger guardian_link_audit_no_update_delete
  before update or delete on public.guardian_link_audit
  for each row execute function private.reject_guardian_link_audit_mutation();
create trigger guardian_link_audit_no_truncate
  before truncate on public.guardian_link_audit
  for each statement execute function private.reject_guardian_link_audit_mutation();

alter table public.student_records enable row level security;
alter table public.student_records force row level security;
alter table public.student_documents enable row level security;
alter table public.student_documents force row level security;
alter table public.guardian_relationships enable row level security;
alter table public.guardian_relationships force row level security;
alter table public.guardian_relationship_permissions enable row level security;
alter table public.guardian_relationship_permissions force row level security;
alter table public.guardian_link_requests enable row level security;
alter table public.guardian_link_requests force row level security;
alter table public.guardian_link_audit enable row level security;
alter table public.guardian_link_audit force row level security;

create policy student_records_select_self
  on public.student_records for select to authenticated
  using (auth_user_id = (select auth.uid()) and exists (
    select 1 from public.persons p
    where p.id = student_records.person_id and p.status = 'active'
      and p.auth_user_id = (select auth.uid())
  ) and exists (
    select 1 from public.school_memberships sm
    where sm.school_id = student_records.school_id
      and sm.id = student_records.school_membership_id
      and sm.person_id = student_records.person_id
      and sm.status = 'active'
  ));
create policy student_documents_select_student_self
  on public.student_documents for select to authenticated
  using (exists (
    select 1 from public.student_records sr
    where sr.id = student_documents.student_id
      and sr.school_id = student_documents.school_id
      and sr.auth_user_id = (select auth.uid())
  ));
create policy guardian_relationships_select_guardian_self
  on public.guardian_relationships for select to authenticated
  using (guardian_auth_user_id = (select auth.uid())
    and identity_verified_at is not null
    and (valid_until is null or valid_until > now())
    and status in ('pending', 'active', 'suspended')
    and exists (
      select 1 from public.persons p
      where p.id = guardian_relationships.guardian_person_id
        and p.auth_user_id = (select auth.uid())
        and p.status = 'active'
    ));
create policy guardian_relationship_permissions_select_guardian_self
  on public.guardian_relationship_permissions for select to authenticated
  using (guardian_auth_user_id = (select auth.uid())
    and status = 'active' and (expires_at is null or expires_at > now())
    and exists (
      select 1 from public.guardian_relationships gr
      where gr.school_id = guardian_relationship_permissions.school_id
        and gr.id = guardian_relationship_permissions.guardian_relationship_id
        and gr.student_id = guardian_relationship_permissions.student_id
        and gr.guardian_person_id = guardian_relationship_permissions.guardian_person_id
        and gr.guardian_auth_user_id = (select auth.uid())
        and exists (
          select 1 from public.persons gp
          where gp.id = gr.guardian_person_id
            and gp.auth_user_id = (select auth.uid())
            and gp.status = 'active'
        )
        and gr.status = 'active' and gr.identity_verified_at is not null
        and gr.relationship_verified_at is not null and gr.approved_at is not null
        and (gr.valid_until is null or gr.valid_until > now())
    ));
create policy guardian_link_requests_select_verified_self
  on public.guardian_link_requests for select to authenticated
  using (guardian_auth_user_id = (select auth.uid())
    and identity_verified_at is not null
    and status in ('identity_verified', 'approved', 'activated')
    and expires_at > now()
    and exists (
      select 1 from public.persons p
      where p.id = guardian_link_requests.guardian_person_id
        and p.auth_user_id = (select auth.uid()) and p.status = 'active'
    )
    and (status <> 'activated' or exists (
      select 1 from public.guardian_relationships gr
      where gr.school_id = guardian_link_requests.school_id
        and gr.id = guardian_link_requests.relationship_id
        and gr.student_id = guardian_link_requests.student_id
        and gr.guardian_person_id = guardian_link_requests.guardian_person_id
        and gr.guardian_auth_user_id = (select auth.uid())
        and gr.status = 'active'
    )));

revoke all privileges on table
  public.student_records, public.student_documents,
  public.guardian_relationships, public.guardian_relationship_permissions,
  public.guardian_link_requests, public.guardian_link_audit
from public, anon, authenticated, service_role;
grant usage on schema public to authenticated;
grant select on table
  public.student_records, public.student_documents,
  public.guardian_relationships, public.guardian_relationship_permissions
to authenticated;

-- Invitation hashes are credential material; grant only request status and
-- workflow metadata to the verified invitee, never token/contact hashes.
grant select (
  id, school_id, student_id, guardian_person_id, guardian_auth_user_id,
  relationship_id, relationship_type, status, identity_verified_at,
  relationship_verified_at, relationship_verified_by_membership_id,
  relationship_verified_by_person_id, approved_at, approved_by_membership_id,
  approved_by_person_id, activated_at, rejected_at, rejected_by_membership_id,
  rejected_by_person_id, revoked_at, revoked_by_membership_id,
  revoked_by_person_id, expired_at, expires_at, invited_by_membership_id,
  invited_by_person_id, created_at, updated_at
) on public.guardian_link_requests to authenticated;
