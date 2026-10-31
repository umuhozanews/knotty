begin;
select plan(28);
select has_table('private','role_definitions','built-in role definitions exist');
select has_table('private','permission_catalog','granular permission catalog exists');
select ok((select count(*)=1 from private.role_definitions where scope='platform' and role_key='PLATFORM_ADMIN'),'platform role remains platform scoped');
select ok((select count(*)=1 from private.role_definitions where scope='organization' and role_key='ORGANIZATION_MANAGER'),'organization manager remains organization scoped');
select ok((select count(*)=10 from private.role_definitions where scope='school'),'all legacy school roles plus school manager exist');
select ok((select count(*)=1 from private.permission_catalog where scope='school' and permission_key='health.read_sensitive' and is_sensitive),'health details use a sensitive permission');
select ok((select count(*)=1 from private.permission_catalog where scope='guardian' and permission_key='health.read'),'guardian health access has a separate relationship permission');
select ok(not exists(select 1 from private.role_permissions where scope='school' and role_key='TEACHER' and permission_key='finance.refund'),'teacher cannot refund fees');
select ok(not exists(select 1 from private.role_permissions where scope='school' and role_key='PARENT' and permission_key='health.read_sensitive'),'parent role alone never grants health access');
select ok(exists(select 1 from private.role_permissions where scope='school' and role_key='NURSE' and permission_key='health.read_sensitive'),'nurse receives medical access only through its role');
select ok(exists(select 1 from private.delegable_roles where scope='school' and delegator_role_key='ADMIN' and delegate_role_key='TEACHER'),'school admin can delegate an approved staff role');
select ok(not exists(select 1 from private.delegable_roles where scope='school' and delegator_role_key='ADMIN' and delegate_role_key in ('ADMIN','SCHOOL_MANAGER')),'school admin cannot promote to manager or peer admin');
select ok(not has_function_privilege('anon','public.assign_scoped_role(text,uuid,uuid,text,text)','EXECUTE'),'anonymous caller cannot assign roles');
select ok(not has_table_privilege('authenticated','public.school_membership_roles','INSERT'),'browser cannot write role assignment rows');
select ok(not has_table_privilege('service_role','public.school_membership_roles','INSERT'),'service role has no direct role assignment write grant');

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('19000000-0000-4000-8000-000000000001','authenticated','authenticated','role-manager@example.invalid','{}','{}'),
 ('19000000-0000-4000-8000-000000000002','authenticated','authenticated','role-target@example.invalid','{}','{}'),
 ('19000000-0000-4000-8000-000000000003','authenticated','authenticated','role-foreign@example.invalid','{}','{}'),
 ('19000000-0000-4000-8000-000000000004','authenticated','authenticated','role-teacher@example.invalid','{}','{}');
insert into public.persons (id,auth_user_id) values
 ('29000000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000001'),
 ('29000000-0000-4000-8000-000000000002','19000000-0000-4000-8000-000000000002'),
 ('29000000-0000-4000-8000-000000000003','19000000-0000-4000-8000-000000000003'),
 ('29000000-0000-4000-8000-000000000004','19000000-0000-4000-8000-000000000004');
insert into public.organizations (id,name,slug) values ('39000000-0000-4000-8000-000000000001','Roles Org','roles-org');
insert into public.schools (id,organization_id,name,code,email) values
 ('49000000-0000-4000-8000-000000000001','39000000-0000-4000-8000-000000000001','Roles A','ROLE-A','role-a@example.invalid'),
 ('49000000-0000-4000-8000-000000000002','39000000-0000-4000-8000-000000000001','Roles B','ROLE-B','role-b@example.invalid');
insert into public.school_memberships (id,school_id,person_id,status,started_at) values
 ('79000000-0000-4000-8000-000000000001','49000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001','active',now()),
 ('79000000-0000-4000-8000-000000000002','49000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000002','active',now()),
 ('79000000-0000-4000-8000-000000000003','49000000-0000-4000-8000-000000000002','29000000-0000-4000-8000-000000000003','active',now()),
 ('79000000-0000-4000-8000-000000000004','49000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000004','active',now());
insert into public.platform_memberships (id,person_id,status,started_at)
values ('7a000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001','active',now());
insert into public.platform_membership_roles(membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason)
values ('7a000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001','PLATFORM_ADMIN','7a000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001','initial local test platform admin');
insert into public.organization_memberships (id,organization_id,person_id,status,started_at) values
 ('7b000000-0000-4000-8000-000000000001','39000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001','active',now()),
 ('7b000000-0000-4000-8000-000000000002','39000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000002','active',now());
insert into public.school_membership_roles(school_id,membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason)
values ('49000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001','SCHOOL_MANAGER','79000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001','initial local test manager');

set local role authenticated;
set local request.jwt.claims='{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(private.has_school_permission('49000000-0000-4000-8000-000000000001','roles.assign'),'active school manager holds the permission at its own school');
select ok(set_config('test.organization_role_assignment_id',public.assign_scoped_role('organization','39000000-0000-4000-8000-000000000001','7b000000-0000-4000-8000-000000000002','ORGANIZATION_MANAGER','organization appointment')::text,true) is not null,'platform administrator appoints an organization manager using a same-organization actor membership');
select is((select count(*)::integer from public.list_scoped_role_assignments('school','49000000-0000-4000-8000-000000000001')),1,'authorized manager can inspect assignment history in scope');
select throws_ok($$select * from public.list_scoped_role_assignments('school','49000000-0000-4000-8000-000000000002')$$,'42501',null,'manager cannot inspect another school role assignments');
select ok(set_config('test.role_assignment_id',public.assign_scoped_role('school','49000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000002','TEACHER','staff onboarding')::text,true) is not null,'authorized role assignment succeeds and returns history id');
select throws_ok($$select public.assign_scoped_role('school','49000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000003','TEACHER','cross school')$$,'42501',null,'role cannot be assigned across school scope');
select throws_ok($$select public.assign_scoped_role('school','49000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000001','ADMIN','self escalation')$$,'42501',null,'actor cannot assign a role to themselves');
select throws_ok($$select public.assign_scoped_role('school','49000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000002','TEACHER','x')$$,'42501',null,'assignment reason must be meaningful');
select public.revoke_scoped_role('school','49000000-0000-4000-8000-000000000001',current_setting('test.role_assignment_id')::uuid,'staff assignment ended');
select public.revoke_scoped_role('organization','39000000-0000-4000-8000-000000000001',current_setting('test.organization_role_assignment_id')::uuid,'organization appointment ended');
reset role;
select is((select status from public.organization_membership_roles where id=current_setting('test.organization_role_assignment_id')::uuid),'revoked','platform manager can revoke its scoped organization appointment');
select is((select status from public.school_membership_roles where id=current_setting('test.role_assignment_id')::uuid),'revoked','revocation preserves the assignment row');
select is((select revoked_reason from public.school_membership_roles where id=current_setting('test.role_assignment_id')::uuid),'staff assignment ended','revocation reason is retained');

set local role authenticated;
set local request.jwt.claims='{"sub":"19000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select public.assign_scoped_role('school','49000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000002','ADMIN','escalation attempt')$$,'42501',null,'teacher cannot grant administrator roles');
select is((select count(*)::integer from public.school_membership_roles),0,'teacher cannot enumerate other membership role assignments');
reset role;
select * from finish();
rollback;
