-- Unified per-school staff records. Teacher-specific data extends a staff
-- record rather than creating a second person/employment identity.

create table public.staff_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  person_id uuid not null,
  school_membership_id uuid not null,
  employee_number text not null,
  job_title text not null,
  department text,
  employment_status text not null default 'active'
    check (employment_status in ('active', 'on_leave', 'suspended', 'terminated')),
  hired_on date not null default current_date,
  ended_on date,
  profile_photo_path text,
  created_by_membership_id uuid not null,
  created_by_person_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_records_employee_number_nonblank_check
    check (length(btrim(employee_number)) > 0),
  constraint staff_records_job_title_nonblank_check
    check (length(btrim(job_title)) > 0),
  constraint staff_records_employment_dates_check check (
    hired_on is not null and
    ((employment_status = 'terminated' and ended_on is not null and ended_on >= hired_on)
     or (employment_status <> 'terminated' and ended_on is null))
  ),
  constraint staff_records_school_person_key unique (school_id, person_id),
  constraint staff_records_id_school_key unique (id, school_id),
  constraint staff_records_id_school_person_key unique (id, school_id, person_id),
  constraint staff_records_membership_person_fkey
    foreign key (school_id, school_membership_id, person_id)
    references public.school_memberships(school_id, id, person_id)
    on delete restrict,
  constraint staff_records_created_by_school_member_fkey
    foreign key (school_id, created_by_membership_id, created_by_person_id)
    references public.school_memberships(school_id, id, person_id)
    on delete restrict
);

create unique index staff_records_school_employee_number_key
  on public.staff_records (school_id, lower(employee_number));
create index staff_records_school_status_idx
  on public.staff_records (school_id, employment_status, employee_number);
create index staff_records_person_idx
  on public.staff_records (person_id);
create index staff_records_creator_idx
  on public.staff_records (school_id, created_by_membership_id, created_by_person_id);

create table public.staff_record_categories (
  school_id uuid not null,
  staff_record_id uuid not null,
  category_key text not null
    check (category_key in ('teaching', 'non_teaching')),
  assigned_by_membership_id uuid not null,
  assigned_by_person_id uuid not null,
  assigned_at timestamptz not null default now(),
  constraint staff_record_categories_pkey
    primary key (school_id, staff_record_id, category_key),
  constraint staff_record_categories_staff_fkey
    foreign key (staff_record_id, school_id)
    references public.staff_records(id, school_id) on delete restrict,
  constraint staff_record_categories_actor_fkey
    foreign key (school_id, assigned_by_membership_id, assigned_by_person_id)
    references public.school_memberships(school_id, id, person_id)
    on delete restrict
);

create index staff_record_categories_category_idx
  on public.staff_record_categories (school_id, category_key, staff_record_id);

create table public.teacher_details (
  staff_record_id uuid primary key,
  school_id uuid not null,
  category_key text not null default 'teaching'
    check (category_key = 'teaching'),
  qualification text,
  specialization text,
  hired_to_teach_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_details_staff_fkey
    foreign key (staff_record_id, school_id)
    references public.staff_records(id, school_id) on delete restrict,
  constraint teacher_details_teaching_category_fkey
    foreign key (school_id, staff_record_id, category_key)
    references public.staff_record_categories(school_id, staff_record_id, category_key)
    on delete restrict
);

create index teacher_details_school_idx
  on public.teacher_details (school_id, staff_record_id);

alter table public.staff_records enable row level security;
alter table public.staff_records force row level security;
alter table public.staff_record_categories enable row level security;
alter table public.staff_record_categories force row level security;
alter table public.teacher_details enable row level security;
alter table public.teacher_details force row level security;

create policy staff_records_select_self
  on public.staff_records for select to authenticated
  using (exists (
    select 1
    from public.persons p
    where p.id = staff_records.person_id
      and p.status = 'active'
      and p.auth_user_id = (select auth.uid())
  ));

create policy staff_record_categories_select_self
  on public.staff_record_categories for select to authenticated
  using (exists (
    select 1
    from public.staff_records sr
    join public.persons p on p.id = sr.person_id
    where sr.id = staff_record_categories.staff_record_id
      and sr.school_id = staff_record_categories.school_id
      and p.status = 'active'
      and p.auth_user_id = (select auth.uid())
  ));

create policy teacher_details_select_self
  on public.teacher_details for select to authenticated
  using (exists (
    select 1
    from public.staff_records sr
    join public.persons p on p.id = sr.person_id
    where sr.id = teacher_details.staff_record_id
      and sr.school_id = teacher_details.school_id
      and p.status = 'active'
      and p.auth_user_id = (select auth.uid())
  ));

revoke all privileges on table
  public.staff_records,
  public.staff_record_categories,
  public.teacher_details
from public, anon, authenticated, service_role;

grant usage on schema public to authenticated;
grant select on table
  public.staff_records,
  public.staff_record_categories,
  public.teacher_details
to authenticated;
