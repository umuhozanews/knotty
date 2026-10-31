begin;
select plan(23);
select ok(has_function_privilege('authenticated','public.register_staff(uuid,text,text,text,text,date,text[],text,text)','EXECUTE'),'school actor can use scoped staff registration workflow');
select ok(not has_table_privilege('authenticated','public.staff_records','INSERT'),'staff rows cannot be inserted directly');
select ok(not has_table_privilege('authenticated','public.teacher_assignments','INSERT'),'teacher assignments cannot be inserted directly');
select ok(not has_table_privilege('authenticated','public.class_subjects','INSERT'),'subject class links cannot be inserted directly');
select ok(has_function_privilege('authenticated','public.assign_teacher(uuid,uuid,uuid,uuid,text,uuid,date)','EXECUTE'),'teacher assignment uses trusted RPC');
select ok(has_function_privilege('authenticated','public.promote_student(uuid,uuid,uuid,uuid,uuid)','EXECUTE'),'promotion uses atomic trusted RPC');
select has_index('public','student_enrollments_one_current_per_student','only one current enrollment per school student');
select throws_ok($$select public.create_subject('00000000-0000-4000-8000-000000000001','X','x','not_a_category')$$,'42501',null,'unauthorized subject creation is denied');
select throws_ok($$select public.assign_subject_to_class('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004')$$,'42501',null,'cross-school or unauthorized subject assignment is denied');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.staff_records'::regclass),'staff records remain protected by forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.teacher_assignments'::regclass),'teacher assignments remain protected by forced RLS');
select ok(has_function_privilege('authenticated','public.end_teacher_assignment(uuid,uuid,text)','EXECUTE'),'teacher assignment history is ended through workflow');
select ok(has_function_privilege('authenticated','public.update_staff_status(uuid,uuid,text,text)','EXECUTE'),'employment status lifecycle uses workflow');
select ok(has_function_privilege('authenticated','public.create_subject(uuid,text,text,text)','EXECUTE'),'subject creation uses workflow');
select ok(has_function_privilege('authenticated','public.assign_subject_to_class(uuid,uuid,uuid,uuid)','EXECUTE'),'class subject assignment uses workflow');
select ok(has_function_privilege('authenticated','public.place_student(uuid,uuid,uuid,uuid,date)','EXECUTE'),'student placement operation remains available');
select ok(not has_function_privilege('anon','public.promote_student(uuid,uuid,uuid,uuid,uuid)','EXECUTE'),'anonymous promotion is denied');

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('1c000000-0000-4000-8000-000000000001','authenticated','authenticated','staff-manager@example.invalid','{}','{}');
insert into public.persons (id,auth_user_id) values
 ('2c000000-0000-4000-8000-000000000001','1c000000-0000-4000-8000-000000000001');
insert into public.organizations (id,name,slug) values
 ('3c000000-0000-4000-8000-000000000001','Staff Workflow Test Org','staff-workflow-test-org');
insert into public.schools (id,organization_id,name,code,email) values
 ('4c000000-0000-4000-8000-000000000001','3c000000-0000-4000-8000-000000000001','Staff Workflow School A','STAFF-WF-A','staff-workflow-a@example.invalid'),
 ('4c000000-0000-4000-8000-000000000002','3c000000-0000-4000-8000-000000000001','Staff Workflow School B','STAFF-WF-B','staff-workflow-b@example.invalid');
insert into public.school_memberships (id,school_id,person_id,status,started_at) values
 ('7c000000-0000-4000-8000-000000000001','4c000000-0000-4000-8000-000000000001','2c000000-0000-4000-8000-000000000001','active',now());
insert into public.school_membership_roles (school_id,membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason)
values ('4c000000-0000-4000-8000-000000000001','7c000000-0000-4000-8000-000000000001','2c000000-0000-4000-8000-000000000001','SCHOOL_MANAGER','7c000000-0000-4000-8000-000000000001','2c000000-0000-4000-8000-000000000001','staff workflow test authority');
set local role authenticated;
set local request.jwt.claims='{"sub":"1c000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.register_staff('4c000000-0000-4000-8000-000000000002','OTHER-001','Other School Teacher','Teacher','Science',current_date,array['teaching'],'BEd','Science')$$,'42501',null,'school manager cannot register staff in another school');
select ok(set_config('test.registered_staff_id',public.register_staff(
 '4c000000-0000-4000-8000-000000000001','STAFF-001','Workflow Teacher','Teacher','Mathematics',current_date,array['teaching'],'BEd','Mathematics'
)::text,true) is not null,'authorized manager registers a teaching staff member');
reset role;
select is((select employment_status from public.staff_records where id=current_setting('test.registered_staff_id')::uuid),'active','new staff member starts active in the authorized school');
select ok(exists(select 1 from public.staff_record_categories where staff_record_id=current_setting('test.registered_staff_id')::uuid and school_id='4c000000-0000-4000-8000-000000000001' and category_key='teaching'),'staff registration persists the assigned category');
select is((select qualification from public.teacher_details where staff_record_id=current_setting('test.registered_staff_id')::uuid),'BEd','teaching staff registration persists teacher qualifications');
select ok(exists(select 1 from public.school_operation_audit where entity_type='staff' and entity_id=current_setting('test.registered_staff_id')::uuid and event_type='staff_registered'),'staff registration appends its school audit event');

select * from finish();
rollback;
