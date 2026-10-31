-- Scoped role and permission catalog plus auditable membership assignments.
-- Role/permission/delegation rows are intentionally unseeded: the approved
-- product design does not yet define their complete scope/grant matrix.

-- Global protected built-in roles only. Tenant-specific custom roles require
-- their separately approved school_custom_roles model and are not represented
-- by this global catalog.
create table private.role_definitions (
  scope text not null
    check (scope in ('platform', 'organization', 'school')),
  role_key text not null,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_definitions_pkey primary key (scope, role_key),
  constraint role_definitions_key_nonblank_check
    check (length(btrim(role_key)) > 0),
  constraint role_definitions_display_name_nonblank_check
    check (length(btrim(display_name)) > 0)
);

create table private.permission_catalog (
  scope text not null
    check (scope in ('platform', 'organization', 'school')),
  permission_key text not null,
  description text not null,
  is_sensitive boolean not null default false,
  custom_assignable boolean not null default false,
  created_at timestamptz not null default now(),
  constraint permission_catalog_pkey primary key (scope, permission_key),
  constraint permission_catalog_key_nonblank_check
    check (length(btrim(permission_key)) > 0),
  constraint permission_catalog_description_nonblank_check
    check (length(btrim(description)) > 0)
);

create table private.role_permissions (
  scope text not null,
  role_key text not null,
  permission_key text not null,
  granted_at timestamptz not null default now(),
  constraint role_permissions_pkey
    primary key (scope, role_key, permission_key),
  constraint role_permissions_role_fkey
    foreign key (scope, role_key)
    references private.role_definitions(scope, role_key) on delete restrict,
  constraint role_permissions_permission_fkey
    foreign key (scope, permission_key)
    references private.permission_catalog(scope, permission_key) on delete restrict
);

create index role_permissions_permission_idx
  on private.role_permissions (scope, permission_key, role_key);

create table private.delegable_roles (
  scope text not null,
  delegator_role_key text not null,
  delegate_role_key text not null,
  created_at timestamptz not null default now(),
  constraint delegable_roles_pkey
    primary key (scope, delegator_role_key, delegate_role_key),
  constraint delegable_roles_delegator_role_fkey
    foreign key (scope, delegator_role_key)
    references private.role_definitions(scope, role_key) on delete restrict,
  constraint delegable_roles_delegate_role_fkey
    foreign key (scope, delegate_role_key)
    references private.role_definitions(scope, role_key) on delete restrict,
  constraint delegable_roles_not_self_check
    check (delegator_role_key <> delegate_role_key)
);

create index delegable_roles_delegate_idx
  on private.delegable_roles (scope, delegate_role_key, delegator_role_key);

create table public.platform_membership_roles (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null,
  person_id uuid not null,
  scope text not null default 'platform' check (scope = 'platform'),
  role_key text not null,
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  assigned_by_membership_id uuid not null,
  assigned_by_person_id uuid not null,
  assigned_at timestamptz not null default now(),
  revoked_by_membership_id uuid,
  revoked_by_person_id uuid,
  revoked_at timestamptz,
  constraint platform_membership_roles_role_fkey
    foreign key (scope, role_key)
    references private.role_definitions(scope, role_key) on delete restrict,
  constraint platform_membership_roles_membership_person_fkey
    foreign key (membership_id, person_id)
    references public.platform_memberships(id, person_id) on delete restrict,
  constraint platform_membership_roles_assigner_fkey
    foreign key (assigned_by_membership_id, assigned_by_person_id)
    references public.platform_memberships(id, person_id) on delete restrict,
  constraint platform_membership_roles_revoker_fkey
    foreign key (revoked_by_membership_id, revoked_by_person_id)
    references public.platform_memberships(id, person_id) on delete restrict,
  constraint platform_membership_roles_revocation_metadata_check check (
    (status = 'active' and revoked_at is null
      and revoked_by_membership_id is null and revoked_by_person_id is null)
    or (status = 'revoked' and revoked_at is not null
      and revoked_by_membership_id is not null and revoked_by_person_id is not null)
  ),
  constraint platform_membership_roles_time_order_check check (
    revoked_at is null or revoked_at >= assigned_at
  )
);

create unique index platform_membership_roles_one_active
  on public.platform_membership_roles (membership_id, role_key)
  where status = 'active';
create index platform_membership_roles_person_idx
  on public.platform_membership_roles (person_id, status, role_key);
create index platform_membership_roles_assigner_idx
  on public.platform_membership_roles (assigned_by_membership_id, assigned_by_person_id);

create table public.organization_membership_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  membership_id uuid not null,
  person_id uuid not null,
  scope text not null default 'organization' check (scope = 'organization'),
  role_key text not null,
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  assigned_by_membership_id uuid not null,
  assigned_by_person_id uuid not null,
  assigned_at timestamptz not null default now(),
  revoked_by_membership_id uuid,
  revoked_by_person_id uuid,
  revoked_at timestamptz,
  constraint organization_membership_roles_role_fkey
    foreign key (scope, role_key)
    references private.role_definitions(scope, role_key) on delete restrict,
  constraint organization_membership_roles_membership_person_fkey
    foreign key (organization_id, membership_id, person_id)
    references public.organization_memberships(organization_id, id, person_id)
    on delete restrict,
  constraint organization_membership_roles_assigner_fkey
    foreign key (organization_id, assigned_by_membership_id, assigned_by_person_id)
    references public.organization_memberships(organization_id, id, person_id)
    on delete restrict,
  constraint organization_membership_roles_revoker_fkey
    foreign key (organization_id, revoked_by_membership_id, revoked_by_person_id)
    references public.organization_memberships(organization_id, id, person_id)
    on delete restrict,
  constraint organization_membership_roles_revocation_metadata_check check (
    (status = 'active' and revoked_at is null
      and revoked_by_membership_id is null and revoked_by_person_id is null)
    or (status = 'revoked' and revoked_at is not null
      and revoked_by_membership_id is not null and revoked_by_person_id is not null)
  ),
  constraint organization_membership_roles_time_order_check check (
    revoked_at is null or revoked_at >= assigned_at
  )
);

create unique index organization_membership_roles_one_active
  on public.organization_membership_roles (organization_id, membership_id, role_key)
  where status = 'active';
create index organization_membership_roles_person_idx
  on public.organization_membership_roles (organization_id, person_id, status, role_key);
create index organization_membership_roles_assigner_idx
  on public.organization_membership_roles
    (organization_id, assigned_by_membership_id, assigned_by_person_id);

create table public.school_membership_roles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  membership_id uuid not null,
  person_id uuid not null,
  scope text not null default 'school' check (scope = 'school'),
  role_key text not null,
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  assigned_by_membership_id uuid not null,
  assigned_by_person_id uuid not null,
  assigned_at timestamptz not null default now(),
  revoked_by_membership_id uuid,
  revoked_by_person_id uuid,
  revoked_at timestamptz,
  constraint school_membership_roles_role_fkey
    foreign key (scope, role_key)
    references private.role_definitions(scope, role_key) on delete restrict,
  constraint school_membership_roles_membership_person_fkey
    foreign key (school_id, membership_id, person_id)
    references public.school_memberships(school_id, id, person_id)
    on delete restrict,
  constraint school_membership_roles_assigner_fkey
    foreign key (school_id, assigned_by_membership_id, assigned_by_person_id)
    references public.school_memberships(school_id, id, person_id)
    on delete restrict,
  constraint school_membership_roles_revoker_fkey
    foreign key (school_id, revoked_by_membership_id, revoked_by_person_id)
    references public.school_memberships(school_id, id, person_id)
    on delete restrict,
  constraint school_membership_roles_revocation_metadata_check check (
    (status = 'active' and revoked_at is null
      and revoked_by_membership_id is null and revoked_by_person_id is null)
    or (status = 'revoked' and revoked_at is not null
      and revoked_by_membership_id is not null and revoked_by_person_id is not null)
  ),
  constraint school_membership_roles_time_order_check check (
    revoked_at is null or revoked_at >= assigned_at
  )
);

create unique index school_membership_roles_one_active
  on public.school_membership_roles (school_id, membership_id, role_key)
  where status = 'active';
create index school_membership_roles_person_idx
  on public.school_membership_roles (school_id, person_id, status, role_key);
create index school_membership_roles_assigner_idx
  on public.school_membership_roles (school_id, assigned_by_membership_id, assigned_by_person_id);

-- Catalogs are migration-managed, private, and not Data API exposed. Every
-- relation has RLS as defense in depth but no client policy or grant.
alter table private.role_definitions enable row level security;
alter table private.role_definitions force row level security;
alter table private.permission_catalog enable row level security;
alter table private.permission_catalog force row level security;
alter table private.role_permissions enable row level security;
alter table private.role_permissions force row level security;
alter table private.delegable_roles enable row level security;
alter table private.delegable_roles force row level security;

alter table public.platform_membership_roles enable row level security;
alter table public.platform_membership_roles force row level security;
alter table public.organization_membership_roles enable row level security;
alter table public.organization_membership_roles force row level security;
alter table public.school_membership_roles enable row level security;
alter table public.school_membership_roles force row level security;

create policy platform_membership_roles_select_self
  on public.platform_membership_roles for select to authenticated
  using (exists (
    select 1
    from public.persons p
    where p.id = platform_membership_roles.person_id
      and p.auth_user_id = (select auth.uid())
  ));

create policy organization_membership_roles_select_self
  on public.organization_membership_roles for select to authenticated
  using (exists (
    select 1
    from public.persons p
    where p.id = organization_membership_roles.person_id
      and p.auth_user_id = (select auth.uid())
  ));

create policy school_membership_roles_select_self
  on public.school_membership_roles for select to authenticated
  using (exists (
    select 1
    from public.persons p
    where p.id = school_membership_roles.person_id
      and p.auth_user_id = (select auth.uid())
  ));

-- Direct browser/service-role writes are denied. Role assignment and
-- revocation remain unavailable until the approved role/delegation matrix
-- supports a narrowly scoped, actor-checked RPC in a later migration.
revoke all privileges on table
  private.role_definitions,
  private.permission_catalog,
  private.role_permissions,
  private.delegable_roles,
  public.platform_membership_roles,
  public.organization_membership_roles,
  public.school_membership_roles
from public, anon, authenticated, service_role;

grant usage on schema public to authenticated;
grant select on table
  public.platform_membership_roles,
  public.organization_membership_roles,
  public.school_membership_roles
to authenticated;
