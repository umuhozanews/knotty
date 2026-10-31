-- Flexible school-specific curriculum and class organization. Mutations remain
-- closed until role permissions and authenticated provisioning workflows exist.
create table public.education_levels (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  level_code text not null,
  name text not null,
  stage text not null default 'other' check (stage in ('early_childhood','primary','lower_secondary','upper_secondary','tvet','other')),
  display_order smallint not null default 0,
  curriculum_framework text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id),
  unique (school_id, level_code),
  check (length(btrim(level_code)) > 0),
  check (length(btrim(name)) > 0)
);
create index education_levels_school_order_idx on public.education_levels (school_id,is_active,display_order,name);

create table public.class_sections (
  id uuid primary key default gen_random_uuid(), school_id uuid not null,
  academic_year_id uuid not null, education_level_id uuid not null,
  section_code text not null, name text not null, stream_name text,
  capacity integer check (capacity is null or capacity > 0),
  status text not null default 'active' check (status in ('active','closed')),
  created_by_membership_id uuid not null, created_by_person_id uuid not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id,school_id,academic_year_id), unique (id,school_id),
  unique (school_id,academic_year_id,section_code),
  foreign key (academic_year_id,school_id) references public.academic_years(id,school_id) on delete restrict,
  foreign key (education_level_id,school_id) references public.education_levels(id,school_id) on delete restrict,
  foreign key (school_id,created_by_membership_id,created_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  check (length(btrim(section_code)) > 0), check (length(btrim(name)) > 0)
);
create index class_sections_school_year_level_idx on public.class_sections (school_id,academic_year_id,education_level_id,status,name);
create index class_sections_creator_idx on public.class_sections (school_id,created_by_membership_id,created_by_person_id);

create table public.subjects (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete restrict,
  subject_code text not null, name text not null,
  subject_category text not null default 'general' check (subject_category in ('core','elective','co_curricular','general')),
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id,school_id), unique (school_id,subject_code),
  check (length(btrim(subject_code)) > 0), check (length(btrim(name)) > 0)
);
create index subjects_school_active_name_idx on public.subjects (school_id,is_active,name);

create table public.class_subjects (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, academic_year_id uuid not null,
  class_section_id uuid not null, subject_id uuid not null, created_at timestamptz not null default now(),
  unique (school_id,class_section_id,subject_id), unique (id,school_id),
  foreign key (class_section_id,school_id,academic_year_id) references public.class_sections(id,school_id,academic_year_id) on delete restrict,
  foreign key (subject_id,school_id) references public.subjects(id,school_id) on delete restrict
);
create index class_subjects_subject_idx on public.class_subjects (school_id,subject_id,class_section_id);

-- teacher_details uses staff_record_id as its primary key; this composite
-- index lets downstream assignment rows prove the same school scope.
create unique index teacher_details_staff_school_key
  on public.teacher_details (staff_record_id,school_id);

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, academic_year_id uuid not null,
  class_section_id uuid not null, staff_record_id uuid not null, subject_id uuid,
  assignment_kind text not null check (assignment_kind in ('subject_teacher','class_teacher')),
  status text not null default 'active' check (status in ('active','ended','revoked')),
  starts_on date not null default current_date, ends_on date,
  assigned_by_membership_id uuid not null, assigned_by_person_id uuid not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((assignment_kind='subject_teacher' and subject_id is not null) or (assignment_kind='class_teacher' and subject_id is null)),
  check ((status='active' and ends_on is null) or (status in ('ended','revoked') and ends_on >= starts_on)),
  foreign key (class_section_id,school_id,academic_year_id) references public.class_sections(id,school_id,academic_year_id) on delete restrict,
  foreign key (staff_record_id,school_id) references public.teacher_details(staff_record_id,school_id) on delete restrict,
  foreign key (school_id,class_section_id,subject_id) references public.class_subjects(school_id,class_section_id,subject_id) on delete restrict,
  foreign key (school_id,assigned_by_membership_id,assigned_by_person_id) references public.school_memberships(school_id,id,person_id) on delete restrict
);
create unique index teacher_assignments_active_subject_teacher_key on public.teacher_assignments (school_id,academic_year_id,class_section_id,subject_id,staff_record_id) where status='active' and assignment_kind='subject_teacher';
create unique index teacher_assignments_one_active_class_teacher on public.teacher_assignments (school_id,academic_year_id,class_section_id) where status='active' and assignment_kind='class_teacher';
create index teacher_assignments_staff_year_idx on public.teacher_assignments (school_id,staff_record_id,academic_year_id,status);
create index teacher_assignments_class_year_idx on public.teacher_assignments (school_id,class_section_id,academic_year_id,status);

create table public.student_enrollments (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, student_id uuid not null, academic_year_id uuid not null,
  status text not null default 'enrolled' check (status in ('enrolled','completed','withdrawn','transferred','graduated')),
  enrolled_at timestamptz not null default now(), ended_at timestamptz,
  created_by_membership_id uuid not null, created_by_person_id uuid not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id,school_id,academic_year_id),
  foreign key (school_id,student_id) references public.student_records(school_id,id) on delete restrict,
  foreign key (academic_year_id,school_id) references public.academic_years(id,school_id) on delete restrict,
  foreign key (school_id,created_by_membership_id,created_by_person_id) references public.school_memberships(school_id,id,person_id) on delete restrict,
  check ((status='enrolled' and ended_at is null) or (status<>'enrolled' and ended_at is not null))
);
create unique index student_enrollments_one_per_year on public.student_enrollments (school_id,student_id,academic_year_id);
create index student_enrollments_school_year_status_idx on public.student_enrollments (school_id,academic_year_id,status,student_id);
create index student_enrollments_actor_idx on public.student_enrollments (school_id,created_by_membership_id,created_by_person_id);

create table public.student_class_placements (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, academic_year_id uuid not null,
  enrollment_id uuid not null, class_section_id uuid not null,
  starts_on date not null default current_date, ends_on date,
  status text not null default 'active' check (status in ('active','ended','transferred')),
  assigned_by_membership_id uuid not null, assigned_by_person_id uuid not null, created_at timestamptz not null default now(),
  unique (id,school_id),
  foreign key (enrollment_id,school_id,academic_year_id) references public.student_enrollments(id,school_id,academic_year_id) on delete restrict,
  foreign key (class_section_id,school_id,academic_year_id) references public.class_sections(id,school_id,academic_year_id) on delete restrict,
  foreign key (school_id,assigned_by_membership_id,assigned_by_person_id) references public.school_memberships(school_id,id,person_id) on delete restrict,
  check ((status='active' and ends_on is null) or (status in ('ended','transferred') and ends_on is not null and ends_on >= starts_on))
);
create unique index student_class_placements_one_active on public.student_class_placements (enrollment_id) where status='active';
create index student_class_placements_section_idx on public.student_class_placements (school_id,class_section_id,status,starts_on);
create index student_class_placements_actor_idx on public.student_class_placements (school_id,assigned_by_membership_id,assigned_by_person_id);

alter table public.education_levels enable row level security; alter table public.education_levels force row level security;
alter table public.class_sections enable row level security; alter table public.class_sections force row level security;
alter table public.subjects enable row level security; alter table public.subjects force row level security;
alter table public.class_subjects enable row level security; alter table public.class_subjects force row level security;
alter table public.teacher_assignments enable row level security; alter table public.teacher_assignments force row level security;
alter table public.student_enrollments enable row level security; alter table public.student_enrollments force row level security;
alter table public.student_class_placements enable row level security; alter table public.student_class_placements force row level security;

create policy education_levels_select_active_member on public.education_levels for select to authenticated using (exists (select 1 from public.school_memberships sm join public.persons p on p.id=sm.person_id where sm.school_id=education_levels.school_id and sm.status='active' and p.status='active' and p.auth_user_id=(select auth.uid())));
create policy class_sections_select_active_member on public.class_sections for select to authenticated using (exists (select 1 from public.school_memberships sm join public.persons p on p.id=sm.person_id where sm.school_id=class_sections.school_id and sm.status='active' and p.status='active' and p.auth_user_id=(select auth.uid())));
create policy subjects_select_active_member on public.subjects for select to authenticated using (exists (select 1 from public.school_memberships sm join public.persons p on p.id=sm.person_id where sm.school_id=subjects.school_id and sm.status='active' and p.status='active' and p.auth_user_id=(select auth.uid())));
create policy class_subjects_select_active_member on public.class_subjects for select to authenticated using (exists (select 1 from public.school_memberships sm join public.persons p on p.id=sm.person_id where sm.school_id=class_subjects.school_id and sm.status='active' and p.status='active' and p.auth_user_id=(select auth.uid())));
create policy teacher_assignments_select_self on public.teacher_assignments for select to authenticated using (exists (select 1 from public.staff_records sr join public.persons p on p.id=sr.person_id where sr.id=teacher_assignments.staff_record_id and sr.school_id=teacher_assignments.school_id and p.status='active' and p.auth_user_id=(select auth.uid())));
create policy student_enrollments_select_self on public.student_enrollments for select to authenticated using (exists (select 1 from public.student_records sr where sr.id=student_enrollments.student_id and sr.school_id=student_enrollments.school_id and sr.auth_user_id=(select auth.uid())));
create policy student_class_placements_select_self on public.student_class_placements for select to authenticated using (exists (select 1 from public.student_enrollments e join public.student_records sr on sr.id=e.student_id and sr.school_id=e.school_id where e.id=student_class_placements.enrollment_id and e.school_id=student_class_placements.school_id and sr.auth_user_id=(select auth.uid())));

revoke all privileges on table public.education_levels,public.class_sections,public.subjects,public.class_subjects,public.teacher_assignments,public.student_enrollments,public.student_class_placements from public,anon,authenticated,service_role;
grant usage on schema public to authenticated;
grant select on table public.education_levels,public.class_sections,public.subjects,public.class_subjects,public.teacher_assignments,public.student_enrollments,public.student_class_placements to authenticated;
