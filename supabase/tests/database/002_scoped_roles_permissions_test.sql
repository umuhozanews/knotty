begin;

select plan(54);

select has_table('private', 'role_definitions', 'private role definitions table exists');
select has_table('private', 'permission_catalog', 'private permission catalog exists');
select has_table('private', 'role_permissions', 'private role permission mapping exists');
select has_table('private', 'delegable_roles', 'private delegable role mapping exists');
select has_table('public', 'platform_membership_roles', 'platform role assignments exist');
select has_table('public', 'organization_membership_roles', 'organization role assignments exist');
select has_table('public', 'school_membership_roles', 'school role assignments exist');

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'private.role_definitions'::regclass), 'role definitions use forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'private.permission_catalog'::regclass), 'permission catalog uses forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'private.role_permissions'::regclass), 'role permissions use forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'private.delegable_roles'::regclass), 'delegable roles use forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.platform_membership_roles'::regclass), 'platform assignments use forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.organization_membership_roles'::regclass), 'organization assignments use forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.school_membership_roles'::regclass), 'school assignments use forced RLS');

select ok(exists (select 1 from pg_constraint where conrelid = 'private.role_permissions'::regclass and conname = 'role_permissions_role_fkey'), 'role permissions reference a role in the same scope');
select ok(exists (select 1 from pg_constraint where conrelid = 'private.role_permissions'::regclass and conname = 'role_permissions_permission_fkey'), 'role permissions reference a permission in the same scope');
select ok(exists (select 1 from pg_constraint where conrelid = 'private.delegable_roles'::regclass and conname = 'delegable_roles_delegator_role_fkey'), 'delegator role scope is constrained');
select ok(exists (select 1 from pg_constraint where conrelid = 'private.delegable_roles'::regclass and conname = 'delegable_roles_delegate_role_fkey'), 'delegate role scope is constrained');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.platform_membership_roles'::regclass and conname = 'platform_membership_roles_assigner_fkey'), 'platform assignment actor must have platform membership');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.organization_membership_roles'::regclass and conname = 'organization_membership_roles_assigner_fkey'), 'organization actor FK includes organization and person');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.school_membership_roles'::regclass and conname = 'school_membership_roles_assigner_fkey'), 'school actor FK includes school and person');
select ok(exists (select 1 from pg_indexes where indexname = 'school_membership_roles_one_active'), 'school assignments prevent duplicate active role grants');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
 ('11000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'roles-a@example.invalid', '{}'::jsonb, '{}'::jsonb),
 ('11000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'roles-b@example.invalid', '{}'::jsonb, '{}'::jsonb);
insert into public.persons (id, auth_user_id) values
 ('21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001'),
 ('21000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000002');
insert into public.organizations (id, name, slug) values
 ('31000000-0000-4000-8000-000000000001', 'Role Org A', 'role-org-a'),
 ('31000000-0000-4000-8000-000000000002', 'Role Org B', 'role-org-b');
insert into public.schools (id, organization_id, name, code, email) values
 ('41000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'Role School A', 'ROLE-A', 'role-a@example.invalid'),
 ('41000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', 'Role School B', 'ROLE-B', 'role-b@example.invalid');
insert into public.platform_memberships (id, person_id, status, started_at) values
 ('51000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'active', now()),
 ('51000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'active', now());
insert into public.organization_memberships (id, organization_id, person_id, status, started_at) values
 ('61000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'active', now()),
 ('61000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000002', 'active', now()),
 ('61000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'active', now());
insert into public.school_memberships (id, school_id, person_id, status, started_at) values
 ('71000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'active', now()),
 ('71000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'active', now());

insert into private.role_definitions (scope, role_key, display_name) values
 ('platform', 'TEST_PLATFORM_ROLE', 'Test platform role'),
 ('organization', 'TEST_ORG_ROLE', 'Test organization role'),
 ('school', 'TEST_SCHOOL_ROLE', 'Test school role'),
 ('school', 'TEST_SCHOOL_DELEGATE', 'Test school delegate role');
insert into private.permission_catalog (scope, permission_key, description) values
 ('platform', 'test.platform.permission', 'Test-only platform permission'),
 ('organization', 'test.organization.permission', 'Test-only organization permission'),
 ('school', 'test.school.permission', 'Test-only school permission');
insert into private.role_permissions (scope, role_key, permission_key) values
 ('platform', 'TEST_PLATFORM_ROLE', 'test.platform.permission'),
 ('organization', 'TEST_ORG_ROLE', 'test.organization.permission'),
 ('school', 'TEST_SCHOOL_ROLE', 'test.school.permission');
insert into private.delegable_roles (scope, delegator_role_key, delegate_role_key) values
 ('school', 'TEST_SCHOOL_ROLE', 'TEST_SCHOOL_DELEGATE');

select is((select count(*)::integer from private.role_permissions where permission_key like 'test.%'), 3, 'same-scope role permission mappings are accepted');
select is((select count(*)::integer from private.delegable_roles where delegator_role_key = 'TEST_SCHOOL_ROLE'), 1, 'same-scope delegation mapping is accepted');
select throws_ok($$insert into private.delegable_roles (scope, delegator_role_key, delegate_role_key) values ('school', 'TEST_SCHOOL_ROLE', 'TEST_SCHOOL_ROLE')$$, '23514', null, 'self-delegation is rejected by the check constraint');
select throws_ok($$insert into private.role_permissions (scope, role_key, permission_key) values ('school', 'TEST_ORG_ROLE', 'test.school.permission')$$, '23503', null, 'role from another scope cannot receive a permission');
select throws_ok($$insert into private.role_permissions (scope, role_key, permission_key) values ('school', 'TEST_SCHOOL_ROLE', 'test.organization.permission')$$, '23503', null, 'permission from another scope cannot be attached to a role');
select throws_ok($$insert into private.delegable_roles (scope, delegator_role_key, delegate_role_key) values ('school', 'TEST_SCHOOL_ROLE', 'TEST_ORG_ROLE')$$, '23503', null, 'delegation cannot cross role scopes');
select throws_ok($$insert into private.role_definitions (scope, role_key, display_name) values ('district', 'BAD_SCOPE', 'Invalid')$$, '23514', null, 'role definitions reject unknown scopes');

insert into public.platform_membership_roles (membership_id, person_id, role_key, assigned_by_membership_id, assigned_by_person_id)
values ('51000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'TEST_PLATFORM_ROLE', '51000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001');
insert into public.organization_membership_roles (organization_id, membership_id, person_id, role_key, assigned_by_membership_id, assigned_by_person_id)
values ('31000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'TEST_ORG_ROLE', '61000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001');
insert into public.school_membership_roles (school_id, membership_id, person_id, role_key, assigned_by_membership_id, assigned_by_person_id)
values
 ('41000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'TEST_SCHOOL_ROLE', '71000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001'),
 ('41000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'TEST_SCHOOL_ROLE', '71000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002');
select is((select count(*)::integer from public.platform_membership_roles), 1, 'platform role assignment with matching membership and actor is accepted');
select is((select count(*)::integer from public.organization_membership_roles), 1, 'organization role assignment with matching tenant and actor is accepted');
select is((select count(*)::integer from public.school_membership_roles), 2, 'school role assignments with matching schools and actors are accepted');
select throws_ok($$insert into public.school_membership_roles (school_id, membership_id, person_id, role_key, assigned_by_membership_id, assigned_by_person_id) values ('41000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'TEST_SCHOOL_ROLE', '71000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001')$$, '23503', null, 'school assignment cannot target a membership from another school');
select throws_ok($$insert into public.school_membership_roles (school_id, membership_id, person_id, role_key, assigned_by_membership_id, assigned_by_person_id) values ('41000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'SCHOOL_MANAGER', '71000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002')$$, '23503', null, 'school actor from another school cannot assign a role');
select throws_ok($$insert into public.organization_membership_roles (organization_id, membership_id, person_id, role_key, assigned_by_membership_id, assigned_by_person_id) values ('31000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'ORGANIZATION_MANAGER', '61000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000002')$$, '23503', null, 'organization actor from another organization cannot assign a role');
select throws_ok($$insert into public.platform_membership_roles (membership_id, person_id, scope, role_key, assigned_by_membership_id, assigned_by_person_id) values ('51000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'school', 'TEST_PLATFORM_ROLE', '51000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001')$$, '23514', null, 'platform assignment cannot claim a different scope');

update public.school_membership_roles set status = 'revoked', revoked_by_membership_id = membership_id, revoked_by_person_id = person_id, revoked_at = now();
insert into public.school_membership_roles (school_id, membership_id, person_id, role_key, assigned_by_membership_id, assigned_by_person_id)
values ('41000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'TEST_SCHOOL_ROLE', '71000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from public.school_membership_roles where membership_id = '71000000-0000-4000-8000-000000000001'), 2, 'revoked role history is retained when a role is assigned again');
select throws_ok($$insert into public.school_membership_roles (school_id, membership_id, person_id, role_key, assigned_by_membership_id, assigned_by_person_id) values ('41000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'TEST_SCHOOL_ROLE', '71000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001')$$, '23505', null, 'duplicate active role assignment is rejected');
select throws_ok($$insert into public.school_membership_roles (school_id, membership_id, person_id, role_key, assigned_by_membership_id, assigned_by_person_id, status, revoked_at) values ('41000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'TEST_SCHOOL_ROLE', '71000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'revoked', now())$$, '23514', null, 'revocation requires both actor membership and actor person');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.platform_membership_roles), 1, 'authenticated user reads their own platform role assignments');
select is((select count(*)::integer from public.organization_membership_roles), 1, 'authenticated user reads their own organization role assignments');
select is((select count(*)::integer from public.school_membership_roles), 2, 'authenticated user reads their own school role assignment history');
select is((select count(*)::integer from public.school_membership_roles where person_id = '21000000-0000-4000-8000-000000000002'), 0, 'user cannot read another school member assignment by ID');
select ok(has_schema_privilege('authenticated', 'private', 'USAGE')
  and has_table_privilege('authenticated', 'private.role_definitions', 'SELECT')
  and has_table_privilege('authenticated', 'private.permission_catalog', 'SELECT')
  and has_table_privilege('authenticated', 'private.role_permissions', 'SELECT')
  and has_table_privilege('authenticated', 'private.delegable_roles', 'SELECT'),
  'authenticated users have read-only access to the explicitly granted role catalogs');
select ok(not has_table_privilege('authenticated', 'public.school_membership_roles', 'INSERT'), 'authenticated user has no direct role assignment INSERT grant');
select ok(not has_table_privilege('authenticated', 'public.school_membership_roles', 'UPDATE'), 'authenticated user has no direct role assignment UPDATE grant');
select ok(not has_table_privilege('authenticated', 'public.school_membership_roles', 'DELETE'), 'authenticated user has no direct role assignment DELETE grant');
select ok(not has_table_privilege('authenticated', 'public.platform_membership_roles', 'INSERT') and not has_table_privilege('authenticated', 'public.organization_membership_roles', 'INSERT') and not has_table_privilege('authenticated', 'public.school_membership_roles', 'INSERT'), 'authenticated users cannot directly create any scoped role assignment');
select ok(not has_table_privilege('authenticated', 'public.platform_membership_roles', 'UPDATE') and not has_table_privilege('authenticated', 'public.organization_membership_roles', 'UPDATE') and not has_table_privilege('authenticated', 'public.school_membership_roles', 'UPDATE'), 'authenticated users cannot directly change any scoped role assignment');
select ok(not has_table_privilege('service_role', 'public.school_membership_roles', 'INSERT'), 'service role has no direct role assignment write grant');
select ok(not has_table_privilege('anon', 'public.school_membership_roles', 'SELECT'), 'anonymous user cannot read role assignments');
select is((select count(*)::integer from pg_proc where proname = 'assign_membership_role'), 0, 'no assignment RPC is exposed before authorization seeds are approved');
select throws_ok($$insert into public.school_membership_roles (school_id, membership_id, person_id, role_key, assigned_by_membership_id, assigned_by_person_id) values ('41000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'TEST_SCHOOL_ROLE', '71000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002')$$, '42501', null, 'authenticated user cannot directly assign a role, even within their school');
select throws_ok($$update public.school_membership_roles set status = 'revoked'$$, '42501', null, 'authenticated user cannot directly revoke role history');
reset role;

select * from finish();
rollback;
