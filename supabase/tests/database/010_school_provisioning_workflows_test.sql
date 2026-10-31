begin;
select plan(28);
select has_table('public','school_operation_audit','school operation audit exists');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.school_operation_audit'::regclass),'school audit enforces forced RLS');
select ok(not has_table_privilege('authenticated','public.school_operation_audit','INSERT'),'browser cannot forge school audit rows');
select ok(not has_table_privilege('authenticated','public.academic_years','INSERT'),'browser cannot write academic years directly');
select ok(not has_function_privilege('anon','public.provision_school(uuid,text,text,text,text,text)','EXECUTE'),'anonymous cannot provision schools');

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('1a000000-0000-4000-8000-000000000001','authenticated','authenticated','provision-platform@example.invalid','{}','{}'),
 ('1a000000-0000-4000-8000-000000000002','authenticated','authenticated','provision-org-a@example.invalid','{}','{}'),
 ('1a000000-0000-4000-8000-000000000003','authenticated','authenticated','provision-org-b@example.invalid','{}','{}'),
 ('1a000000-0000-4000-8000-000000000004','authenticated','authenticated','provision-teacher@example.invalid','{}','{}');
insert into public.persons (id,auth_user_id) values
 ('2a000000-0000-4000-8000-000000000001','1a000000-0000-4000-8000-000000000001'),
 ('2a000000-0000-4000-8000-000000000002','1a000000-0000-4000-8000-000000000002'),
 ('2a000000-0000-4000-8000-000000000003','1a000000-0000-4000-8000-000000000003'),
 ('2a000000-0000-4000-8000-000000000004','1a000000-0000-4000-8000-000000000004');
insert into public.organizations (id,name,slug) values
 ('3a000000-0000-4000-8000-000000000001','Provision Org A','provision-org-a'),
 ('3a000000-0000-4000-8000-000000000002','Provision Org B','provision-org-b');
insert into public.platform_memberships (id,person_id,status,started_at)
values ('7c000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000001','active',now());
insert into public.platform_membership_roles(membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason)
values ('7c000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000001','PLATFORM_ADMIN','7c000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000001','initial platform test authority');
insert into public.organization_memberships (id,organization_id,person_id,status,started_at) values
 ('7d000000-0000-4000-8000-000000000001','3a000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000002','active',now()),
 ('7d000000-0000-4000-8000-000000000002','3a000000-0000-4000-8000-000000000002','2a000000-0000-4000-8000-000000000003','active',now());
insert into public.organization_membership_roles(organization_id,membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason)
values ('3a000000-0000-4000-8000-000000000001','7d000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000002','ORGANIZATION_MANAGER','7d000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000002','initial organization test authority'),
 ('3a000000-0000-4000-8000-000000000002','7d000000-0000-4000-8000-000000000002','2a000000-0000-4000-8000-000000000003','ORGANIZATION_MANAGER','7d000000-0000-4000-8000-000000000002','2a000000-0000-4000-8000-000000000003','initial organization test authority');

set local role authenticated;
set local request.jwt.claims='{"sub":"1a000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(set_config('test.school_a',public.provision_school('3a000000-0000-4000-8000-000000000001','Provisioned School A','PROV-A','prov-a@example.invalid','+250780000001','Kigali')::text,true) is not null,'platform admin provisions school and becomes its initial manager');
select ok(private.has_school_permission(current_setting('test.school_a')::uuid,'academics.manage'),'initial school manager has school-scoped academic permission');
select throws_ok($$select public.provision_school('3a000000-0000-4000-8000-000000000001','Second school','PROV-A2','prov-a2@example.invalid')$$,'23505',null,'person cannot acquire a second active school membership through provisioning');
reset role;
select is((select count(*)::integer from public.school_membership_roles where school_id=current_setting('test.school_a')::uuid and role_key='SCHOOL_MANAGER' and status='active'),1,'provisioning creates one initial manager role assignment');

set local role authenticated;
set local request.jwt.claims='{"sub":"1a000000-0000-4000-8000-000000000002","role":"authenticated"}';
select ok(set_config('test.school_a2',public.provision_school('3a000000-0000-4000-8000-000000000001','Provisioned School A2','PROV-A2','prov-a2@example.invalid')::text,true) is not null,'organization manager creates a school only in its organization');
select throws_ok($$select public.provision_school('3a000000-0000-4000-8000-000000000002','Wrong organization','PROV-WRONG','prov-wrong@example.invalid')$$,'42501',null,'organization manager cannot provision in another organization');
select is((select count(*)::integer from public.schools where organization_id='3a000000-0000-4000-8000-000000000001'),2,'organization manager can see registry rows only for its organization');
select public.update_school_profile(current_setting('test.school_a')::uuid,'School A Updated','+250780000009','Kigali address','BR-2');
select throws_ok($$select public.update_school_settings(current_setting('test.school_a')::uuid,'Africa/Kigali','rw-RW','RWF','CBC','08:00',1)$$,'42501',null,'organization membership alone cannot edit school operational settings');
reset role;

set local role authenticated;
set local request.jwt.claims='{"sub":"1a000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.update_school_settings(current_setting('test.school_a')::uuid,'Africa/Kigali','rw-RW','RWF','CBC','08:00',1);
select is((select timezone from public.school_settings where school_id=current_setting('test.school_a')::uuid),'Africa/Kigali','supported IANA time zone is accepted and persisted');
select throws_ok($$select public.update_school_settings(current_setting('test.school_a')::uuid,'Mars/Olympus','rw-RW','RWF','CBC','08:00',1)$$,'22023',null,'unsupported time zone is rejected before settings are persisted');
select is((select timezone from public.school_settings where school_id=current_setting('test.school_a')::uuid),'Africa/Kigali','invalid time zone leaves the prior setting unchanged');
select ok(set_config('test.year_id',public.create_academic_year(current_setting('test.school_a')::uuid,'2026-2027','2026-09-01','2027-08-31')::text,true) is not null,'authorized school manager creates a draft academic year');
select public.activate_academic_year(current_setting('test.school_a')::uuid,current_setting('test.year_id')::uuid);
select is((select status from public.academic_years where id=current_setting('test.year_id')::uuid),'active','academic year activation is recorded');
select ok(set_config('test.term_id',public.create_academic_term(current_setting('test.school_a')::uuid,current_setting('test.year_id')::uuid,'Term One',1,'term','2026-09-01','2026-12-20')::text,true) is not null,'term is created within its academic year dates');
select throws_ok($$select public.create_academic_term(current_setting('test.school_a')::uuid,current_setting('test.year_id')::uuid,'Invalid Term',2,'term','2026-08-01','2026-12-01')$$,'22023',null,'term outside academic year date range is rejected');
select public.set_academic_term_status(current_setting('test.school_a')::uuid,current_setting('test.term_id')::uuid,'active');
select throws_ok($$select public.close_academic_year(current_setting('test.school_a')::uuid,current_setting('test.year_id')::uuid)$$,'23514',null,'year cannot close while a term remains active');
select ok(set_config('test.level_id',public.create_education_level(current_setting('test.school_a')::uuid,'P1','Primary 1','primary',1,'CBC')::text,true) is not null,'school manager creates a flexible Rwanda CBC education level');
select ok(set_config('test.section_id',public.create_class_section(current_setting('test.school_a')::uuid,current_setting('test.year_id')::uuid,current_setting('test.level_id')::uuid,'P1-A','Primary 1 A','A',45)::text,true) is not null,'school manager creates a class section in its school and year');
select public.set_academic_term_status(current_setting('test.school_a')::uuid,current_setting('test.term_id')::uuid,'closed');
select public.close_academic_year(current_setting('test.school_a')::uuid,current_setting('test.year_id')::uuid);
select is((select status from public.academic_years where id=current_setting('test.year_id')::uuid),'closed','academic year closure is recorded after terms close');
reset role;

select ok((select count(*)>=8 from public.school_operation_audit where school_id=current_setting('test.school_a')::uuid),'school and academic actions append audit records');
select throws_ok($$update public.school_operation_audit set event_type='rewritten'$$,'55000',null,'school audit rejects updates');
select throws_ok($$delete from public.school_operation_audit$$,'55000',null,'school audit rejects deletes');
select throws_ok($$truncate public.school_operation_audit$$,'55000',null,'school audit rejects truncate');
select * from finish();
rollback;
