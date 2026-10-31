begin;

select plan(24);

select has_table('public', 'staff_records', 'unified staff records table exists');
select has_table('public', 'staff_record_categories', 'staff categories table exists');
select has_table('public', 'teacher_details', 'teacher details extension exists');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.staff_records'::regclass), 'staff records use forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.staff_record_categories'::regclass), 'staff categories use forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.teacher_details'::regclass), 'teacher details use forced RLS');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.staff_records'::regclass and conname = 'staff_records_school_person_key'), 'only one staff record is allowed per person per school');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.staff_records'::regclass and conname = 'staff_records_membership_person_fkey'), 'staff record is bound to matching school membership and person');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.teacher_details'::regclass and conname = 'teacher_details_teaching_category_fkey'), 'teacher details require the teaching category');
select ok(exists (select 1 from pg_indexes where indexname = 'staff_records_school_employee_number_key'), 'employee numbers are unique within a school');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
 ('13000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'staff-a@example.invalid', '{}'::jsonb, '{}'::jsonb),
 ('13000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'staff-b@example.invalid', '{}'::jsonb, '{}'::jsonb);
insert into public.persons (id, auth_user_id) values
 ('23000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001'),
 ('23000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000002');
insert into public.organizations (id, name, slug) values
 ('33000000-0000-4000-8000-000000000001', 'Staff Org', 'staff-org');
insert into public.schools (id, organization_id, name, code, email) values
 ('43000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', 'Staff School A', 'STAFF-A', 'staff-school-a@example.invalid'),
 ('43000000-0000-4000-8000-000000000002', '33000000-0000-4000-8000-000000000001', 'Staff School B', 'STAFF-B', 'staff-school-b@example.invalid');
insert into public.school_memberships (id, school_id, person_id, status, started_at) values
 ('73000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', 'active', now()),
 ('73000000-0000-4000-8000-000000000002', '43000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000002', 'active', now());
insert into public.staff_records (id, school_id, person_id, school_membership_id, employee_number, job_title, created_by_membership_id, created_by_person_id) values
 ('83000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', 'EMP-001', 'Teacher', '73000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001'),
 ('83000000-0000-4000-8000-000000000002', '43000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000002', 'EMP-001', 'Teacher', '73000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000002');
insert into public.staff_record_categories (school_id, staff_record_id, category_key, assigned_by_membership_id, assigned_by_person_id) values
 ('43000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', 'teaching', '73000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001'),
 ('43000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', 'non_teaching', '73000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001');
insert into public.teacher_details (staff_record_id, school_id, qualification, specialization)
values ('83000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 'Bachelor of Education', 'Mathematics');

select is((select count(*)::integer from public.staff_records), 2, 'same employee number can be reused in different schools');
select is((select count(*)::integer from public.staff_record_categories where staff_record_id = '83000000-0000-4000-8000-000000000001'), 2, 'one staff record may carry multiple responsibilities');
select throws_ok($$insert into public.staff_records (school_id, person_id, school_membership_id, employee_number, job_title, created_by_membership_id, created_by_person_id) values ('43000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', 'EMP-002', 'Duplicate person', '73000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001')$$, '23505', null, 'duplicate staff records for one person and school are rejected');
select throws_ok($$insert into public.staff_records (school_id, person_id, school_membership_id, employee_number, job_title, created_by_membership_id, created_by_person_id) values ('43000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000002', 'EMP-003', 'Wrong school', '73000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001')$$, '23503', null, 'staff person membership cannot cross schools');
select throws_ok($$insert into public.teacher_details (staff_record_id, school_id, category_key) values ('83000000-0000-4000-8000-000000000002', '43000000-0000-4000-8000-000000000002', 'teaching')$$, '23503', null, 'teacher detail cannot exist without a teaching staff category');
update public.staff_records set employment_status = 'terminated', ended_on = current_date where id = '83000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.staff_records where id = '83000000-0000-4000-8000-000000000001' and employment_status = 'terminated'), 1, 'staff lifecycle status retains the existing staff record');

set local role authenticated;
set local request.jwt.claims = '{"sub":"13000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.staff_records), 1, 'staff user can read their own employment record');
select is((select count(*)::integer from public.staff_records where id = '83000000-0000-4000-8000-000000000002'), 0, 'staff user cannot read another school staff record');
select is((select count(*)::integer from public.staff_record_categories), 2, 'staff user can read their own category assignments');
select is((select count(*)::integer from public.teacher_details), 1, 'teacher can read their own teaching details');
select ok(not has_table_privilege('authenticated', 'public.staff_records', 'INSERT'), 'authenticated users cannot directly create staff records');
select ok(not has_table_privilege('authenticated', 'public.teacher_details', 'UPDATE'), 'authenticated users cannot directly edit teacher details');
select ok(not has_table_privilege('anon', 'public.staff_records', 'SELECT'), 'anonymous users cannot read staff records');
select throws_ok($$update public.staff_records set employment_status = 'terminated'$$, '42501', null, 'authenticated staff user cannot directly mutate an employment record');
reset role;

select * from finish();
rollback;
