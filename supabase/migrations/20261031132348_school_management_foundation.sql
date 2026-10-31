-- Initial school settings, academic cycle and calendar structures.
-- Mutating workflows are intentionally unavailable until scoped role and
-- permission grants have been approved and wired through secure RPCs.

create table public.school_settings (
  school_id uuid primary key
    references public.schools(id) on delete restrict,
  timezone text not null default 'Africa/Kigali',
  locale text not null default 'rw-RW',
  default_currency char(3) not null default 'RWF'
    check (default_currency ~ '^[A-Z]{3}$'),
  curriculum_framework text not null default 'CBC'
    check (curriculum_framework in ('CBC', 'OTHER')),
  school_day_start time not null default time '08:00',
  week_starts_on smallint not null default 1
    check (week_starts_on between 1 and 7),
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  updated_by_membership_id uuid,
  updated_by_person_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_settings_actor_pair_check check (
    (updated_by_membership_id is null) = (updated_by_person_id is null)
  ),
  constraint school_settings_updated_by_school_member_fkey
    foreign key (school_id, updated_by_membership_id, updated_by_person_id)
    references public.school_memberships(school_id, id, person_id)
    on delete restrict
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null
    references public.schools(id) on delete restrict,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'closed')),
  activated_at timestamptz,
  activated_by_membership_id uuid,
  activated_by_person_id uuid,
  closed_at timestamptz,
  closed_by_membership_id uuid,
  closed_by_person_id uuid,
  created_by_membership_id uuid not null,
  created_by_person_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_years_name_nonblank_check
    check (length(btrim(name)) > 0),
  constraint academic_years_date_order_check check (end_date > start_date),
  constraint academic_years_id_school_id_key unique (id, school_id),
  constraint academic_years_created_by_school_member_fkey
    foreign key (school_id, created_by_membership_id, created_by_person_id)
    references public.school_memberships(school_id, id, person_id)
    on delete restrict,
  constraint academic_years_activated_by_school_member_fkey
    foreign key (school_id, activated_by_membership_id, activated_by_person_id)
    references public.school_memberships(school_id, id, person_id)
    on delete restrict,
  constraint academic_years_closed_by_school_member_fkey
    foreign key (school_id, closed_by_membership_id, closed_by_person_id)
    references public.school_memberships(school_id, id, person_id)
    on delete restrict,
  constraint academic_years_activation_metadata_check check (
    (status in ('draft', 'closed') and activated_at is null
      and activated_by_membership_id is null and activated_by_person_id is null)
    or (status = 'active' and activated_at is not null
      and activated_by_membership_id is not null and activated_by_person_id is not null)
    or (status = 'closed' and activated_at is not null
      and activated_by_membership_id is not null and activated_by_person_id is not null)
  ),
  constraint academic_years_closure_metadata_check check (
    (status = 'closed' and closed_at is not null
      and closed_by_membership_id is not null and closed_by_person_id is not null)
    or (status in ('draft', 'active') and closed_at is null
      and closed_by_membership_id is null and closed_by_person_id is null)
  ),
  constraint academic_years_actor_time_order_check check (
    (activated_at is null or activated_at >= created_at)
    and (closed_at is null or closed_at >= created_at)
  )
);

create unique index academic_years_one_active_per_school
  on public.academic_years (school_id)
  where status = 'active';
create unique index academic_years_school_name_key
  on public.academic_years (school_id, lower(name));
create index academic_years_school_dates_idx
  on public.academic_years (school_id, start_date desc, end_date);
create index academic_years_creator_idx
  on public.academic_years (school_id, created_by_membership_id, created_by_person_id);

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_year_id uuid not null,
  name text not null,
  sequence_number smallint not null
    check (sequence_number between 1 and 6),
  term_kind text not null default 'term'
    check (term_kind in ('term', 'semester', 'trimester', 'quarter', 'other')),
  start_date date not null,
  end_date date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'active', 'closed')),
  created_by_membership_id uuid not null,
  created_by_person_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_terms_name_nonblank_check
    check (length(btrim(name)) > 0),
  constraint academic_terms_date_order_check check (end_date > start_date),
  constraint academic_terms_year_scope_fkey
    foreign key (academic_year_id, school_id)
    references public.academic_years(id, school_id) on delete restrict,
  constraint academic_terms_created_by_school_member_fkey
    foreign key (school_id, created_by_membership_id, created_by_person_id)
    references public.school_memberships(school_id, id, person_id)
    on delete restrict,
  constraint academic_terms_id_school_year_key
    unique (id, school_id, academic_year_id),
  constraint academic_terms_year_sequence_key
    unique (school_id, academic_year_id, sequence_number)
);

create index academic_terms_year_dates_idx
  on public.academic_terms (school_id, academic_year_id, start_date, end_date);
create index academic_terms_creator_idx
  on public.academic_terms (school_id, created_by_membership_id, created_by_person_id);

create table public.school_calendar_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null
    references public.schools(id) on delete restrict,
  academic_year_id uuid,
  academic_term_id uuid,
  title text not null,
  description text,
  event_type text not null
    check (event_type in ('holiday', 'closure', 'exam', 'activity', 'deadline', 'meeting', 'other')),
  audience text not null default 'school'
    check (audience in ('school', 'staff', 'students', 'guardians')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_all_day boolean not null default false,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled')),
  created_by_membership_id uuid not null,
  created_by_person_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_calendar_events_title_nonblank_check
    check (length(btrim(title)) > 0),
  constraint school_calendar_events_time_order_check check (ends_at > starts_at),
  constraint school_calendar_events_term_requires_year_check
    check (academic_term_id is null or academic_year_id is not null),
  constraint school_calendar_events_year_scope_fkey
    foreign key (academic_year_id, school_id)
    references public.academic_years(id, school_id) on delete restrict,
  constraint school_calendar_events_term_scope_fkey
    foreign key (academic_term_id, school_id, academic_year_id)
    references public.academic_terms(id, school_id, academic_year_id)
    on delete restrict,
  constraint school_calendar_events_created_by_school_member_fkey
    foreign key (school_id, created_by_membership_id, created_by_person_id)
    references public.school_memberships(school_id, id, person_id)
    on delete restrict
);

create index school_calendar_events_school_starts_idx
  on public.school_calendar_events (school_id, starts_at, id);
create index school_calendar_events_year_starts_idx
  on public.school_calendar_events (school_id, academic_year_id, starts_at)
  where academic_year_id is not null;
create index school_calendar_events_term_starts_idx
  on public.school_calendar_events (school_id, academic_term_id, starts_at)
  where academic_term_id is not null;
create index school_calendar_events_creator_idx
  on public.school_calendar_events (school_id, created_by_membership_id, created_by_person_id);

alter table public.school_settings enable row level security;
alter table public.school_settings force row level security;
alter table public.academic_years enable row level security;
alter table public.academic_years force row level security;
alter table public.academic_terms enable row level security;
alter table public.academic_terms force row level security;
alter table public.school_calendar_events enable row level security;
alter table public.school_calendar_events force row level security;

create policy school_settings_select_active_member
  on public.school_settings for select to authenticated
  using (exists (
    select 1
    from public.school_memberships sm
    join public.persons p on p.id = sm.person_id
    where sm.school_id = school_settings.school_id
      and sm.status = 'active'
      and p.status = 'active'
      and p.auth_user_id = (select auth.uid())
  ));

create policy academic_years_select_active_member
  on public.academic_years for select to authenticated
  using (exists (
    select 1
    from public.school_memberships sm
    join public.persons p on p.id = sm.person_id
    where sm.school_id = academic_years.school_id
      and sm.status = 'active'
      and p.status = 'active'
      and p.auth_user_id = (select auth.uid())
  ));

create policy academic_terms_select_active_member
  on public.academic_terms for select to authenticated
  using (exists (
    select 1
    from public.school_memberships sm
    join public.persons p on p.id = sm.person_id
    where sm.school_id = academic_terms.school_id
      and sm.status = 'active'
      and p.status = 'active'
      and p.auth_user_id = (select auth.uid())
  ));

create policy school_calendar_events_select_active_member
  on public.school_calendar_events for select to authenticated
  using (
    school_calendar_events.audience = 'school'
    and exists (
      select 1
      from public.school_memberships sm
      join public.persons p on p.id = sm.person_id
      where sm.school_id = school_calendar_events.school_id
        and sm.status = 'active'
        and p.status = 'active'
        and p.auth_user_id = (select auth.uid())
    )
  );

revoke all privileges on table
  public.school_settings,
  public.academic_years,
  public.academic_terms,
  public.school_calendar_events
from public, anon, authenticated, service_role;

grant usage on schema public to authenticated;
grant select on table
  public.school_settings,
  public.academic_years,
  public.academic_terms,
  public.school_calendar_events
to authenticated;
