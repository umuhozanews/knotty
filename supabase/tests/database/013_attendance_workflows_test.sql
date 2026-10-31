begin;
select plan(34);
select ok(has_function_privilege('authenticated','public.record_student_attendance(uuid,uuid,date,text,timestamp with time zone,timestamp with time zone,text)','EXECUTE'),'authenticated scoped student attendance RPC exists');
select ok(has_function_privilege('authenticated','public.record_staff_attendance(uuid,uuid,date,text,timestamp with time zone,timestamp with time zone,text)','EXECUTE'),'authenticated scoped staff attendance RPC exists');
select ok(has_function_privilege('authenticated','public.set_attendance_device_status(uuid,uuid,text,text)','EXECUTE'),'device lifecycle is managed by a scoped workflow');
select ok(has_function_privilege('authenticated','public.record_virtual_student_tap(uuid,uuid,uuid,timestamp with time zone)','EXECUTE'),'virtual card tap fallback uses scoped idempotent RPC');
select ok(has_function_privilege('authenticated','public.correct_student_attendance(uuid,uuid,text,timestamp with time zone,timestamp with time zone,text)','EXECUTE'),'attendance correction uses audited RPC');
select ok(not has_function_privilege('authenticated','public.process_attendance_scan(uuid,uuid,bytea,bytea,uuid,text)','EXECUTE'),'browser cannot submit trusted NFC scan operations');
select ok(has_function_privilege('service_role','public.process_attendance_scan(uuid,uuid,bytea,bytea,uuid,text)','EXECUTE'),'Edge Function service boundary can process a device scan');
select ok(position('v_local_time time;' in pg_get_functiondef('public.process_attendance_scan(uuid,uuid,bytea,bytea,uuid,text)'::regprocedure))>0,'scan RPC declares its school-local time as time');
select ok(position('v_local_time>(select school_day_start' in pg_get_functiondef('public.process_attendance_scan(uuid,uuid,bytea,bytea,uuid,text)'::regprocedure))>0,'scan lateness compares school-local time with the configured school day start');
select ok(not has_table_privilege('authenticated','public.attendance_records','INSERT'),'attendance records cannot be directly inserted');
select ok(not has_table_privilege('authenticated','public.attendance_records','UPDATE'),'attendance rows require correction workflow');
select ok(not has_table_privilege('authenticated','public.attendance_scan_events','INSERT'),'scan events cannot be forged from browser');
select ok(not has_table_privilege('authenticated','public.attendance_devices','INSERT'),'devices require managed registration workflow');
select has_column('public','attendance_scan_events','scan_direction','scan records retain entry or exit direction');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='attendance_scan_events_school_id_idempotency_key_key'),'scan event idempotency is unique within school');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='attendance_records' and policyname='attendance_records_select_scoped'),'attendance reads are class/guardian scoped');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='attendance_scan_events' and policyname='attendance_scan_events_select_authorized'),'scan event reads are scoped');
select has_trigger('public','attendance_scan_events','attendance_scan_events_no_update_delete','scan event history cannot be updated or deleted');
select has_trigger('public','attendance_scan_events','attendance_scan_events_no_truncate','scan event history cannot be truncated');
select has_trigger('public','attendance_correction_audit','attendance_correction_audit_no_truncate','correction audit cannot be truncated');
select throws_ok($$select public.record_student_attendance('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',current_date,'present')$$,'42501',null,'unauthorized manual attendance is denied');
select throws_ok($$select public.correct_student_attendance('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','present',now(),null,'correction')$$,'42501',null,'unauthorized attendance correction is denied');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.attendance_records'::regclass),'attendance rows require RLS');

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('1d000000-0000-4000-8000-000000000001','authenticated','authenticated','attendance-manager@example.invalid','{}','{}'),
 ('1d000000-0000-4000-8000-000000000002','authenticated','authenticated','attendance-student@example.invalid','{}','{}'),
 ('1d000000-0000-4000-8000-000000000003','authenticated','authenticated','attendance-student-two@example.invalid','{}','{}');
insert into public.persons (id,auth_user_id) values
 ('2d000000-0000-4000-8000-000000000001','1d000000-0000-4000-8000-000000000001'),
 ('2d000000-0000-4000-8000-000000000002','1d000000-0000-4000-8000-000000000002'),
 ('2d000000-0000-4000-8000-000000000003','1d000000-0000-4000-8000-000000000003');
insert into public.organizations (id,name,slug) values
 ('3d000000-0000-4000-8000-000000000001','Attendance Test Org','attendance-test-org');
insert into public.schools (id,organization_id,name,code,email) values
 ('4d000000-0000-4000-8000-000000000001','3d000000-0000-4000-8000-000000000001','Attendance Test School','ATT-TEST','attendance-school@example.invalid');
insert into public.school_settings (school_id) values ('4d000000-0000-4000-8000-000000000001');
insert into public.school_memberships (id,school_id,person_id,status,started_at) values
 ('7d000000-0000-4000-8000-000000000001','4d000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000001','active',now()),
 ('7d000000-0000-4000-8000-000000000002','4d000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000002','active',now()),
 ('7d000000-0000-4000-8000-000000000003','4d000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000003','active',now());
insert into public.school_membership_roles (school_id,membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason)
values ('4d000000-0000-4000-8000-000000000001','7d000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000001','SCHOOL_MANAGER','7d000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000001','attendance workflow test authority');
insert into public.student_records (id,school_id,person_id,auth_user_id,school_membership_id,admission_number,status,created_by_membership_id,created_by_person_id)
values ('8d000000-0000-4000-8000-000000000001','4d000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000002','1d000000-0000-4000-8000-000000000002','7d000000-0000-4000-8000-000000000002','ATT-001','active','7d000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000001');
insert into public.student_records (id,school_id,person_id,auth_user_id,school_membership_id,admission_number,status,created_by_membership_id,created_by_person_id)
values ('8d000000-0000-4000-8000-000000000002','4d000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000003','1d000000-0000-4000-8000-000000000003','7d000000-0000-4000-8000-000000000003','ATT-002','active','7d000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claims='{"sub":"1d000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.update_school_settings('4d000000-0000-4000-8000-000000000001','Africa/Kigali','rw-RW','RWF'::char(3),'CBC',time '07:00',1::smallint);
select ok(set_config('test.virtual_tap_event',public.record_virtual_student_tap(
 '4d000000-0000-4000-8000-000000000001','8d000000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000001','2026-10-30 22:30:00+00'
)::text,true) is not null,'valid virtual tap records an attendance event');
select is((select attendance_date from public.attendance_records where student_id='8d000000-0000-4000-8000-000000000001'),'2026-10-31'::date,'virtual tap uses school-local date across UTC midnight');
select is((select status from public.attendance_records where student_id='8d000000-0000-4000-8000-000000000001'),'present','virtual tap compares the school-local time to school day start');
select is(public.record_virtual_student_tap('4d000000-0000-4000-8000-000000000001','8d000000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000001','2026-10-30 22:30:00+00')::text,current_setting('test.virtual_tap_event'),'replaying the idempotency key returns the original tap event');
select is((select count(*)::integer from public.attendance_scan_events where school_id='4d000000-0000-4000-8000-000000000001' and idempotency_key='9d000000-0000-4000-8000-000000000001'),1,'replayed tap does not create a second event');
select ok(set_config('test.duplicate_tap_event',public.record_virtual_student_tap(
 '4d000000-0000-4000-8000-000000000001','8d000000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000002','2026-10-30 22:31:00+00'
)::text,true) is not null,'second same-day tap event is persisted');
select is((select outcome from public.attendance_scan_events where id=current_setting('test.duplicate_tap_event')::uuid),'duplicate','a second tap on the same school-local day is recorded as duplicate');
select ok(set_config('test.next_local_day_event',public.record_virtual_student_tap(
 '4d000000-0000-4000-8000-000000000001','8d000000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000003','2026-10-31 22:00:00+00'
)::text,true) is not null,'tap before UTC midnight rolls into the following school-local day');
select is((select attendance_date from public.attendance_records where student_id='8d000000-0000-4000-8000-000000000001' and attendance_date='2026-11-01'),'2026-11-01'::date,'school-local date advances independently of UTC date');
select ok(public.record_virtual_student_tap(
 '4d000000-0000-4000-8000-000000000001','8d000000-0000-4000-8000-000000000002','9d000000-0000-4000-8000-000000000004','2026-11-01 06:00:00+00'
) is not null,'a separate student scan tests late classification after the configured local day start');
select is((select status from public.attendance_records where student_id='8d000000-0000-4000-8000-000000000002' and attendance_date='2026-11-01'),'late','school-local time after day start is classified late');
reset role;
select * from finish();
rollback;
