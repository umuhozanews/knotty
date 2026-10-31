begin;
select plan(21);
select has_function('public','register_student_from_edge','uuid, uuid, uuid, text, text, date, text, text, text, text, text, uuid, uuid','trusted student registration RPC exists');
select ok(not has_function_privilege('authenticated','public.register_student_from_edge(uuid,uuid,uuid,text,text,date,text,text,text,text,text,uuid,uuid)','EXECUTE'),'browser cannot create/link arbitrary student Auth identities');
select ok(has_function_privilege('service_role','public.register_student_from_edge(uuid,uuid,uuid,text,text,date,text,text,text,text,text,uuid,uuid)','EXECUTE'),'trusted edge server can invoke student registration RPC');
select ok(has_function_privilege('authenticated','public.place_student(uuid,uuid,uuid,uuid,date)','EXECUTE'),'authenticated caller can use scoped placement workflow');
select ok(has_function_privilege('authenticated','public.change_student_status(uuid,uuid,text,text)','EXECUTE'),'authenticated caller can use scoped student lifecycle workflow');
select ok(has_function_privilege('authenticated','public.create_guardian_link_request(uuid,uuid,bytea,bytea,text,timestamp with time zone)','EXECUTE'),'authenticated caller can create authorized guardian request');
select ok(has_function_privilege('authenticated','public.approve_guardian_link_request(uuid,text)','EXECUTE'),'authenticated caller can use approval workflow');
select ok(has_function_privilege('authenticated','public.revoke_guardian_relationship(uuid,uuid,text)','EXECUTE'),'authenticated caller can revoke relationship through audited workflow');
select ok(not has_table_privilege('authenticated','public.student_records','INSERT'),'direct student insertion remains denied');
select ok(not has_table_privilege('authenticated','public.student_enrollments','INSERT'),'direct enrollment insertion remains denied');
select ok(not has_table_privilege('authenticated','public.guardian_relationships','INSERT'),'direct guardian relationship insertion remains denied');
select ok(not has_table_privilege('authenticated','public.student_documents','INSERT'),'direct document metadata insertion remains denied');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.guardian_relationships'::regclass),'guardian relationship RLS remains forced');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.student_records'::regclass),'student record RLS remains forced');
select has_column('public','guardian_relationships','guardian_school_membership_id','active guardian relationship ties to exact school membership');
select has_index('public','guardian_relationship_one_active_per_pair','only one active guardian link for each student/guardian pair');

-- Exercise the trusted registration write path. This catches column/value
-- misalignment that catalog and privilege assertions cannot detect.
insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('1b000000-0000-4000-8000-000000000001','authenticated','authenticated','registration-manager@example.invalid','{}','{}'),
 ('1b000000-0000-4000-8000-000000000002','authenticated','authenticated','registration-student@example.invalid','{}','{}');
insert into public.persons (id,auth_user_id) values
 ('2b000000-0000-4000-8000-000000000001','1b000000-0000-4000-8000-000000000001');
insert into public.organizations (id,name,slug)
values ('3b000000-0000-4000-8000-000000000001','Registration Test Org','registration-test-org');
insert into public.schools (id,organization_id,name,code,email)
values ('4b000000-0000-4000-8000-000000000001','3b000000-0000-4000-8000-000000000001','Registration Test School','REG-TEST','registration-school@example.invalid');
insert into public.school_memberships (id,school_id,person_id,status,started_at)
values ('7b000000-0000-4000-8000-000000000001','4b000000-0000-4000-8000-000000000001','2b000000-0000-4000-8000-000000000001','active',now());
insert into public.school_membership_roles (school_id,membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason)
values ('4b000000-0000-4000-8000-000000000001','7b000000-0000-4000-8000-000000000001','2b000000-0000-4000-8000-000000000001','SCHOOL_MANAGER','7b000000-0000-4000-8000-000000000001','2b000000-0000-4000-8000-000000000001','registration workflow test authority');
set local role service_role;
select set_config('test.registered_student_id',public.register_student_from_edge(
 '1b000000-0000-4000-8000-000000000001','1b000000-0000-4000-8000-000000000002','4b000000-0000-4000-8000-000000000001',
 'REG-001','Registration Test Student','2015-04-12','female','Rwandan','email','registration-student@example.invalid','registration-student@example.invalid',null,null
)::text,true);
reset role;
select is((select admission_number from public.student_records where id=current_setting('test.registered_student_id')::uuid),'REG-001','registration persists the supplied admission number');
select ok(exists(select 1 from public.student_records sr join public.school_memberships sm on sm.id=sr.school_membership_id and sm.school_id=sr.school_id and sm.person_id=sr.person_id where sr.id=current_setting('test.registered_student_id')::uuid and sm.status='invited'),'registration links the student record to its invited school membership');
select is((select status from public.student_records where id=current_setting('test.registered_student_id')::uuid),'pending','newly registered student remains pending activation');
select ok(exists(select 1 from public.school_membership_roles smr join public.student_records sr on sr.school_membership_id=smr.membership_id and sr.person_id=smr.person_id where sr.id=current_setting('test.registered_student_id')::uuid and smr.role_key='STUDENT' and smr.status='active'),'registration assigns the student role to the linked membership');
select ok(exists(select 1 from public.school_operation_audit where entity_id=current_setting('test.registered_student_id')::uuid and event_type='student_registered'),'registration appends the student registration audit event');

select * from finish();
rollback;
