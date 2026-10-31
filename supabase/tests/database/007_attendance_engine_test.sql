begin;
select plan(24);
select has_table('public','attendance_devices','attendance device registry exists');
select has_table('public','attendance_records','daily attendance record exists');
select has_table('public','staff_attendance_records','daily staff attendance record exists');
select has_table('public','attendance_scan_events','idempotent scan event ledger exists');
select has_table('public','attendance_correction_audit','correction audit exists');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.attendance_records'::regclass),'attendance records enforce RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.staff_attendance_records'::regclass),'staff attendance records enforce RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.attendance_devices'::regclass),'device registry enforces RLS');
select ok(exists(select 1 from pg_indexes where indexname='attendance_records_school_date_student_id_key') or exists(select 1 from pg_constraint where conrelid='public.attendance_records'::regclass and contype='u'),'one daily record per student is enforced');
select ok(exists(select 1 from pg_constraint where conrelid='public.attendance_scan_events'::regclass and conname='attendance_scan_events_school_id_idempotency_key_key'),'scan idempotency key is school scoped');
select ok(not has_table_privilege('authenticated','public.attendance_records','INSERT'),'browser cannot write attendance directly');
select ok(not has_table_privilege('authenticated','public.staff_attendance_records','INSERT'),'browser cannot write staff attendance directly');
select ok(not has_table_privilege('service_role','public.attendance_scan_events','INSERT'),'service role does not bypass scan authorization');

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('17000000-0000-4000-8000-000000000001','authenticated','authenticated','attendance-a@example.invalid','{}','{}'),
 ('17000000-0000-4000-8000-000000000002','authenticated','authenticated','attendance-b@example.invalid','{}','{}');
insert into public.persons (id,auth_user_id) values
 ('27000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000001'),
 ('27000000-0000-4000-8000-000000000002','17000000-0000-4000-8000-000000000002');
insert into public.organizations (id,name,slug) values ('37000000-0000-4000-8000-000000000001','Attendance Org','attendance-org');
insert into public.schools (id,organization_id,name,code,email) values
 ('47000000-0000-4000-8000-000000000001','37000000-0000-4000-8000-000000000001','Attendance A','ATT-A','att-a@example.invalid'),
 ('47000000-0000-4000-8000-000000000002','37000000-0000-4000-8000-000000000001','Attendance B','ATT-B','att-b@example.invalid');
insert into public.school_memberships (id,school_id,person_id,status,started_at) values
 ('77000000-0000-4000-8000-000000000001','47000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','active',now()),
 ('77000000-0000-4000-8000-000000000002','47000000-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000002','active',now());
insert into public.student_records (id,school_id,person_id,auth_user_id,school_membership_id,admission_number,status,created_by_membership_id,created_by_person_id) values
 ('87000000-0000-4000-8000-000000000001','47000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000001','ATT-STU-A','active','77000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001'),
 ('87000000-0000-4000-8000-000000000002','47000000-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000002','17000000-0000-4000-8000-000000000002','77000000-0000-4000-8000-000000000002','ATT-STU-B','active','77000000-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000002');
insert into public.attendance_records (school_id,student_id,attendance_date,status,source,created_by_membership_id,created_by_person_id)
values ('47000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001','2026-10-31','present','manual','77000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001');
select throws_ok($$insert into public.attendance_records (school_id,student_id,attendance_date,status,source,created_by_membership_id,created_by_person_id) values ('47000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001','2026-10-31','late','manual','77000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001')$$,'23505',null,'duplicate daily attendance is rejected');
insert into public.attendance_scan_events (school_id,idempotency_key,actor_membership_id,actor_person_id,student_id,attendance_record_id,scan_type,outcome,occurred_at)
values ('47000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001',(select id from public.attendance_records where student_id='87000000-0000-4000-8000-000000000001'),'manual','accepted',now());
select throws_ok($$insert into public.attendance_scan_events (school_id,idempotency_key,actor_membership_id,actor_person_id,student_id,scan_type,outcome,occurred_at) values ('47000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001','manual','duplicate',now())$$,'23505',null,'replayed scan event is rejected by idempotency key');
select throws_ok($$insert into public.attendance_records (school_id,student_id,attendance_date,status,source,created_by_membership_id,created_by_person_id) values ('47000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000002','2026-10-31','present','manual','77000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001')$$,'23503',null,'cross-school student and actor references are rejected');

set local role authenticated;
set local request.jwt.claims='{"sub":"17000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.attendance_records),1,'student reads own attendance');
select is((select count(*)::integer from public.attendance_records where student_id='87000000-0000-4000-8000-000000000002'),0,'student cannot read other school attendance');
select ok(has_table_privilege('authenticated','public.attendance_scan_events','SELECT'),'scan event SELECT is granted for RLS-authorized readers');
select is((select count(*)::integer from public.attendance_scan_events),0,'student cannot read scan event history without attendance.read permission');
select throws_ok($$update public.attendance_scan_events set outcome='error'$$,'42501',null,'scan event cannot be updated by API role');
select throws_ok($$insert into public.attendance_records (school_id,student_id,attendance_date,status,source) values ('47000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001','2026-11-01','present','manual')$$,'42501',null,'student cannot create attendance');
reset role;
select ok(exists(select 1 from pg_trigger where tgname='attendance_scan_events_no_update_delete'),'scan audit history rejects updates and deletes');
select ok(exists(select 1 from pg_trigger where tgname='attendance_scan_events_no_truncate'),'scan audit history rejects truncate');
select * from finish();
rollback;
