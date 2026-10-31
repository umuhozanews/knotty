-- Private identity data is deliberately outside the Data API's exposed schemas.
create schema if not exists private;
revoke all privileges on schema private
  from public, anon, authenticated, service_role;

create table public.persons (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique
    references auth.users(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'merged')),
  merged_into_person_id uuid
    references public.persons(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint persons_id_auth_user_id_key unique (id, auth_user_id),
  constraint persons_merge_state_check check (
    (status = 'merged') = (merged_into_person_id is not null)
  ),
  constraint persons_not_merged_into_self_check check (
    merged_into_person_id is null or merged_into_person_id <> id
  )
);

create index persons_merged_into_person_idx
  on public.persons (merged_into_person_id)
  where merged_into_person_id is not null;

-- Deliberately do not place legal identity or contact fields on persons.
-- Government identifiers are omitted until their business need and handling
-- policy are approved.
create table private.person_private_identity (
  person_id uuid primary key
    references public.persons(id) on delete restrict,
  legal_name text,
  date_of_birth date,
  nationality text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_private_identity_legal_name_nonblank_check
    check (legal_name is null or length(btrim(legal_name)) > 0),
  constraint person_private_identity_nationality_nonblank_check
    check (nationality is null or length(btrim(nationality)) > 0)
);

create table private.person_contact_points (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null
    references public.persons(id) on delete restrict,
  contact_type text not null
    check (contact_type in ('email', 'phone')),
  contact_value text not null,
  normalized_value text not null,
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_contact_points_value_nonblank_check
    check (length(btrim(contact_value)) > 0),
  constraint person_contact_points_normalized_nonblank_check
    check (length(btrim(normalized_value)) > 0),
  constraint person_contact_points_person_type_value_key
    unique (person_id, contact_type, normalized_value)
);

create unique index person_contact_points_one_primary_per_type
  on private.person_contact_points (person_id, contact_type)
  where is_primary;
create index person_contact_points_person_idx
  on private.person_contact_points (person_id);

-- Organization business identifiers retain the existing Prisma slug and
-- names. The legacy TIN is deferred until its access policy is designed.
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  legal_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_nonblank_check
    check (length(btrim(name)) > 0),
  constraint organizations_slug_nonblank_check
    check (length(btrim(slug)) > 0),
  constraint organizations_id_slug_key unique (id, slug)
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  name text not null,
  code text not null unique,
  email text not null unique,
  phone text,
  address text,
  logo text,
  branch_code text,
  subscription_plan text not null default 'BASIC'
    check (subscription_plan in ('BASIC', 'PREMIUM')),
  tap_out_after_minutes integer not null default 180,
  school_start_time time not null default time '08:30',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schools_name_nonblank_check
    check (length(btrim(name)) > 0),
  constraint schools_code_nonblank_check
    check (length(btrim(code)) > 0),
  constraint schools_email_nonblank_check
    check (length(btrim(email)) > 0),
  constraint schools_id_organization_id_key
    unique (id, organization_id),
  constraint schools_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id) on delete restrict
);

create index schools_organization_id_idx
  on public.schools (organization_id)
  where organization_id is not null;

-- Membership rows are historical records. There is intentionally no
-- permanent UNIQUE(scope_id, person_id) constraint.
create table public.platform_memberships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null
    references public.persons(id) on delete restrict,
  status text not null default 'invited'
    check (status in ('invited', 'active', 'suspended', 'revoked')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_memberships_id_person_id_key unique (id, person_id),
  constraint platform_memberships_status_dates_check check (
    (status in ('active', 'suspended') and started_at is not null and ended_at is null)
    or (status = 'invited' and started_at is null and ended_at is null)
    or (status = 'revoked' and ended_at is not null)
  ),
  constraint platform_memberships_time_order_check check (
    started_at is null or ended_at is null or ended_at >= started_at
  )
);

create unique index platform_memberships_one_active_per_person
  on public.platform_memberships (person_id)
  where status = 'active';
create index platform_memberships_person_status_idx
  on public.platform_memberships (person_id, status);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  person_id uuid not null
    references public.persons(id) on delete restrict,
  status text not null default 'invited'
    check (status in ('invited', 'active', 'suspended', 'revoked')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_scope_actor_key
    unique (organization_id, id, person_id),
  constraint organization_memberships_status_dates_check check (
    (status in ('active', 'suspended') and started_at is not null and ended_at is null)
    or (status = 'invited' and started_at is null and ended_at is null)
    or (status = 'revoked' and ended_at is not null)
  ),
  constraint organization_memberships_time_order_check check (
    started_at is null or ended_at is null or ended_at >= started_at
  )
);

create unique index organization_memberships_one_active_per_person
  on public.organization_memberships (organization_id, person_id)
  where status = 'active';
create index organization_memberships_person_status_idx
  on public.organization_memberships (person_id, status);
create index organization_memberships_organization_status_idx
  on public.organization_memberships (organization_id, status);

create table public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null
    references public.schools(id) on delete restrict,
  person_id uuid not null
    references public.persons(id) on delete restrict,
  status text not null default 'invited'
    check (status in ('invited', 'active', 'suspended', 'revoked')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_memberships_scope_id_key unique (school_id, id),
  constraint school_memberships_scope_actor_key
    unique (school_id, id, person_id),
  constraint school_memberships_status_dates_check check (
    (status in ('active', 'suspended') and started_at is not null and ended_at is null)
    or (status = 'invited' and started_at is null and ended_at is null)
    or (status = 'revoked' and ended_at is not null)
  ),
  constraint school_memberships_time_order_check check (
    started_at is null or ended_at is null or ended_at >= started_at
  )
);

-- The first index is the core, cross-school invariant. The second is retained
-- as the explicitly required per-school invariant. No non-partial uniqueness
-- prevents a person from returning after an old membership is revoked.
create unique index school_memberships_one_active_global
  on public.school_memberships (person_id)
  where status = 'active';
create unique index school_memberships_one_active_per_school
  on public.school_memberships (person_id, school_id)
  where status = 'active';
create index school_memberships_person_status_idx
  on public.school_memberships (person_id, status);
create index school_memberships_school_status_idx
  on public.school_memberships (school_id, status);

-- Keep an authenticated user's readable surface limited to their own identity
-- and membership rows, plus the school/organization metadata for active scopes.
alter table public.persons enable row level security;
alter table public.persons force row level security;
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.schools enable row level security;
alter table public.schools force row level security;
alter table public.platform_memberships enable row level security;
alter table public.platform_memberships force row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_memberships force row level security;
alter table public.school_memberships enable row level security;
alter table public.school_memberships force row level security;
alter table private.person_private_identity enable row level security;
alter table private.person_private_identity force row level security;
alter table private.person_contact_points enable row level security;
alter table private.person_contact_points force row level security;

create policy persons_select_self
  on public.persons for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy platform_memberships_select_self
  on public.platform_memberships for select to authenticated
  using (exists (
    select 1
    from public.persons p
    where p.id = platform_memberships.person_id
      and p.auth_user_id = (select auth.uid())
  ));

create policy organization_memberships_select_self
  on public.organization_memberships for select to authenticated
  using (exists (
    select 1
    from public.persons p
    where p.id = organization_memberships.person_id
      and p.auth_user_id = (select auth.uid())
  ));

create policy organizations_select_active_member
  on public.organizations for select to authenticated
  using (exists (
    select 1
    from public.organization_memberships om
    join public.persons p on p.id = om.person_id
    where om.organization_id = organizations.id
      and om.status = 'active'
      and p.auth_user_id = (select auth.uid())
  ));

create policy school_memberships_select_self
  on public.school_memberships for select to authenticated
  using (exists (
    select 1
    from public.persons p
    where p.id = school_memberships.person_id
      and p.auth_user_id = (select auth.uid())
  ));

create policy schools_select_active_member
  on public.schools for select to authenticated
  using (exists (
    select 1
    from public.school_memberships sm
    join public.persons p on p.id = sm.person_id
    where sm.school_id = schools.id
      and sm.status = 'active'
      and p.auth_user_id = (select auth.uid())
  ));

-- The private schema is not in the Data API's exposed schema list. It has no
-- user policies or grants: future access must use reviewed, narrow functions.
revoke all privileges on table
  public.persons,
  public.organizations,
  public.schools,
  public.platform_memberships,
  public.organization_memberships,
  public.school_memberships,
  private.person_private_identity,
  private.person_contact_points
from public, anon, authenticated, service_role;

grant usage on schema public to authenticated;
grant select on table
  public.persons,
  public.organizations,
  public.schools,
  public.platform_memberships,
  public.organization_memberships,
  public.school_memberships
to authenticated;

-- No direct insert, update, delete, truncate, or sequence privileges are
-- granted to API roles. No SECURITY DEFINER function is needed in this layer.
