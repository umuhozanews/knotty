begin;

select plan(37);

select has_table('public', 'school_settings', 'school settings table exists');
select has_table('public', 'academic_years', 'academic year table exists');
select has_table('public', 'academic_terms', 'academic term table exists');
select has_table('public', 'school_calendar_events', 'school calendar event table exists');

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.school_settings'::regclass), 'school settings use forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.academic_years'::regclass), 'academic years use forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.academic_terms'::regclass), 'academic terms use forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.school_calendar_events'::regclass), 'school calendar events use forced RLS');

select ok(exists (select 1 from pg_indexes where indexname = 'academic_years_one_active_per_school'), 'at most one active academic year is allowed per school');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.academic_terms'::regclass and conname = 'academic_terms_year_scope_fkey'), 'academic term year relationship includes school scope');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.school_calendar_events'::regclass and conname = 'school_calendar_events_term_scope_fkey'), 'calendar term relationship includes school and academic year');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.academic_years'::regclass and conname = 'academic_years_created_by_school_member_fkey'), 'academic year creator is constrained to the same school membership');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.academic_terms'::regclass and conname = 'academic_terms_created_by_school_member_fkey'), 'academic term creator is constrained to the same school membership');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.school_calendar_events'::regclass and conname = 'school_calendar_events_created_by_school_member_fkey'), 'calendar event creator is constrained to the same school membership');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
 ('12000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'school-a@example.invalid', '{}'::jsonb, '{}'::jsonb),
 ('12000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'school-b@example.invalid', '{}'::jsonb, '{}'::jsonb);
insert into public.persons (id, auth_user_id) values
 ('22000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001'),
 ('22000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000002');
insert into public.organizations (id, name, slug) values
 ('32000000-0000-4000-8000-000000000001', 'School Test Org', 'school-test-org');
insert into public.schools (id, organization_id, name, code, email) values
 ('42000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', 'School Test A', 'SCHOOL-A', 'school-a-office@example.invalid'),
 ('42000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000001', 'School Test B', 'SCHOOL-B', 'school-b-office@example.invalid');
insert into public.school_memberships (id, school_id, person_id, status, started_at) values
 ('72000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 'active', now()),
 ('72000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', 'active', now());

insert into public.school_settings (school_id, curriculum_framework, default_currency)
values ('42000000-0000-4000-8000-000000000001', 'CBC', 'RWF'),
       ('42000000-0000-4000-8000-000000000002', 'CBC', 'RWF');
insert into public.academic_years (id, school_id, name, start_date, end_date, status, activated_at, activated_by_membership_id, activated_by_person_id, created_by_membership_id, created_by_person_id) values
 ('82000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '2026', date '2026-01-01', date '2026-12-31', 'active', now(), '72000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001'),
 ('82000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', '2026', date '2026-01-01', date '2026-12-31', 'active', now(), '72000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002');
insert into public.academic_terms (id, school_id, academic_year_id, name, sequence_number, term_kind, start_date, end_date, created_by_membership_id, created_by_person_id) values
 ('92000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', 'Term I', 1, 'term', date '2026-01-01', date '2026-04-30', '72000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001'),
 ('92000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', 'Term I', 1, 'term', date '2026-01-01', date '2026-04-30', '72000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002');
insert into public.school_calendar_events (school_id, academic_year_id, academic_term_id, title, event_type, audience, starts_at, ends_at, created_by_membership_id, created_by_person_id) values
 ('42000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'Term opening', 'activity', 'school', timestamptz '2026-01-05 07:00:00+02', timestamptz '2026-01-05 18:00:00+02', '72000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001'),
 ('42000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', null, 'Guardian meeting', 'meeting', 'guardians', timestamptz '2026-02-05 07:00:00+02', timestamptz '2026-02-05 08:00:00+02', '72000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001'),
 ('42000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', 'Term opening', 'activity', 'school', timestamptz '2026-01-05 07:00:00+02', timestamptz '2026-01-05 18:00:00+02', '72000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002');

select is((select count(*)::integer from public.school_settings), 2, 'one settings profile can exist per school');
select is((select count(*)::integer from public.academic_years where status = 'active'), 2, 'different schools can each activate their academic year');
select is((select count(*)::integer from public.academic_terms where school_id = '42000000-0000-4000-8000-000000000001'), 1, 'school academic term can be linked to its academic year');
select is((select count(*)::integer from public.school_calendar_events where academic_term_id is not null), 2, 'calendar events can reference scoped academic terms');

select throws_ok($$insert into public.academic_years (school_id, name, start_date, end_date, status, activated_at, activated_by_membership_id, activated_by_person_id, created_by_membership_id, created_by_person_id) values ('42000000-0000-4000-8000-000000000001', '2026 duplicate active', date '2026-01-01', date '2026-12-31', 'active', now(), '72000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001')$$, '23505', null, 'a school cannot have two active academic years');
select throws_ok($$insert into public.academic_terms (school_id, academic_year_id, name, sequence_number, start_date, end_date, created_by_membership_id, created_by_person_id) values ('42000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000001', 'Wrong school', 2, date '2026-05-01', date '2026-06-30', '72000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002')$$, '23503', null, 'academic year from another school cannot be linked');
select throws_ok($$insert into public.academic_terms (school_id, academic_year_id, name, sequence_number, start_date, end_date, created_by_membership_id, created_by_person_id) values ('42000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', 'Duplicate sequence', 1, date '2026-05-01', date '2026-06-30', '72000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001')$$, '23505', null, 'term sequence number cannot be duplicated in a school year');
select throws_ok($$insert into public.school_calendar_events (school_id, academic_year_id, academic_term_id, title, event_type, starts_at, ends_at, created_by_membership_id, created_by_person_id) values ('42000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002', 'Wrong term', 'activity', timestamptz '2026-02-01 07:00:00+02', timestamptz '2026-02-01 08:00:00+02', '72000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001')$$, '23503', null, 'calendar event cannot mix academic term tenant and year');
select throws_ok($$insert into public.school_calendar_events (school_id, academic_year_id, title, event_type, starts_at, ends_at, created_by_membership_id, created_by_person_id) values ('42000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', 'Missing year with term', 'activity', timestamptz '2026-02-01 07:00:00+02', timestamptz '2026-02-01 08:00:00+02', '72000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001')$$, '23514', null, 'calendar term reference requires an academic year');
select throws_ok($$insert into public.school_settings (school_id, curriculum_framework, default_currency) values ('42000000-0000-4000-8000-000000000001', 'CBC', 'USD')$$, '23505', null, 'school settings enforces one row per school');
select throws_ok($$insert into public.school_settings (school_id, curriculum_framework, default_currency) values ('42000000-0000-4000-8000-000000000001', 'CBC', 'rwf')$$, '23514', null, 'school currency uses a three-letter uppercase ISO code');

set local role authenticated;
set local request.jwt.claims = '{"sub":"12000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.school_settings), 1, 'school member reads settings only for their school');
select is((select count(*)::integer from public.school_settings where school_id = '42000000-0000-4000-8000-000000000002'), 0, 'school settings from another school are hidden by RLS');
select is((select count(*)::integer from public.academic_years), 1, 'school member reads academic years only for their school');
select is((select count(*)::integer from public.academic_terms), 1, 'school member reads terms only for their school');
select is((select count(*)::integer from public.school_calendar_events), 1, 'school member reads school-audience calendar events for their school');
select is((select count(*)::integer from public.school_calendar_events where audience = 'guardians'), 0, 'guardian-only events remain unavailable without guardian authorization');
select ok(not has_table_privilege('anon', 'public.academic_years', 'SELECT'), 'anonymous role cannot read academic data');
select ok(not has_table_privilege('authenticated', 'public.academic_years', 'INSERT'), 'authenticated role cannot directly mutate academic data');
select ok(not has_table_privilege('service_role', 'public.academic_years', 'INSERT'), 'service role cannot bypass authorization through direct table writes');
select throws_ok($$insert into public.academic_years (school_id, name, start_date, end_date, created_by_membership_id, created_by_person_id) values ('42000000-0000-4000-8000-000000000001', 'Unauthorized', date '2027-01-01', date '2027-12-31', '72000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001')$$, '42501', null, 'authenticated school member cannot create an academic year directly');
select throws_ok($$update public.school_settings set curriculum_framework = 'OTHER'$$, '42501', null, 'authenticated school member cannot directly change school settings');
reset role;

select * from finish();
rollback;
