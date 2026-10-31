begin;

select plan(56);

select has_table('public', 'persons', 'persons table exists');
select has_table('private', 'person_private_identity', 'private identity table exists');
select has_table('private', 'person_contact_points', 'private contact table exists');
select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'schools', 'schools table exists');
select has_table('public', 'platform_memberships', 'platform memberships table exists');
select has_table('public', 'organization_memberships', 'organization memberships table exists');
select has_table('public', 'school_memberships', 'school memberships table exists');

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.persons'::regclass
      and conname = 'persons_auth_user_id_key'
      and contype = 'u'
  ),
  'one Auth identity cannot link to multiple persons'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.persons'::regclass
      and conname = 'persons_id_auth_user_id_key'
      and contype = 'u'
  ),
  'person and Auth ID composite key exists'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.school_memberships'::regclass
      and conname = 'school_memberships_scope_actor_key'
      and contype = 'u'
  ),
  'school membership scope/person composite key exists'
);
select ok(
  exists (select 1 from pg_indexes where indexname = 'school_memberships_one_active_global'),
  'global one-active-school-membership index exists'
);
select ok(
  exists (select 1 from pg_indexes where indexname = 'school_memberships_one_active_per_school'),
  'per-school one-active-membership index exists'
);
select ok(
  exists (select 1 from pg_indexes where indexname = 'organization_memberships_one_active_per_person'),
  'organization membership history permits a partial active uniqueness rule'
);
select ok(
  exists (select 1 from pg_indexes where indexname = 'platform_memberships_one_active_per_person'),
  'platform membership history permits a partial active uniqueness rule'
);
select ok(
  (
    select count(*) = 8 and bool_and(c.relrowsecurity and c.relforcerowsecurity)
    from pg_class c
    where c.oid = any (array[
      to_regclass('public.persons')::oid,
      to_regclass('private.person_private_identity')::oid,
      to_regclass('private.person_contact_points')::oid,
      to_regclass('public.organizations')::oid,
      to_regclass('public.schools')::oid,
      to_regclass('public.platform_memberships')::oid,
      to_regclass('public.organization_memberships')::oid,
      to_regclass('public.school_memberships')::oid
    ])
  ),
  'RLS is enabled and forced on every foundation table'
);
select ok(
  not exists (
    select 1 from pg_policy
    where polrelid = any (array[
      to_regclass('public.persons')::oid,
      to_regclass('private.person_private_identity')::oid,
      to_regclass('private.person_contact_points')::oid,
      to_regclass('public.organizations')::oid,
      to_regclass('public.schools')::oid,
      to_regclass('public.platform_memberships')::oid,
      to_regclass('public.organization_memberships')::oid,
      to_regclass('public.school_memberships')::oid
    ])
      and polcmd in ('*', 'a', 'w', 'd')
  ),
  'foundation tables have no direct insert, update, or delete RLS policies'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'persons_auth_user_id_fkey'),
  'persons Auth identity references auth.users'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'persons_merged_into_person_id_fkey'),
  'person merge pointer references another person'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'person_private_identity_person_id_fkey'),
  'private identity is linked to a person'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'person_contact_points_person_id_fkey'),
  'private contacts are linked to a person'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'schools_organization_id_fkey'),
  'school organization relationship is constrained'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'platform_memberships_person_id_fkey'),
  'platform membership is linked to a person'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'organization_memberships_organization_id_fkey'),
  'organization membership is linked to an organization'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'organization_memberships_person_id_fkey'),
  'organization membership is linked to a person'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'school_memberships_school_id_fkey'),
  'school membership is linked to a school'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'school_memberships_person_id_fkey'),
  'school membership is linked to a person'
);

select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated users cannot resolve the private schema'
);
select ok(
  not has_table_privilege('authenticated', 'private.person_private_identity', 'SELECT'),
  'authenticated users have no private identity SELECT grant'
);
select ok(
  not has_table_privilege('authenticated', 'private.person_contact_points', 'SELECT'),
  'authenticated users have no contact point SELECT grant'
);
select ok(
  not has_table_privilege('anon', 'public.persons', 'SELECT'),
  'anonymous users have no person SELECT grant'
);
select ok(
  not has_table_privilege('authenticated', 'public.persons', 'INSERT'),
  'authenticated users cannot directly insert persons'
);
select ok(
  not has_table_privilege('authenticated', 'public.school_memberships', 'UPDATE'),
  'authenticated users cannot directly update memberships'
);
select ok(
  not has_table_privilege('service_role', 'public.school_memberships', 'INSERT'),
  'service role has no direct membership insert grant'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data
) values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'identity-test-a@example.invalid', '{}'::jsonb, '{}'::jsonb),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'identity-test-b@example.invalid', '{}'::jsonb, '{}'::jsonb);

insert into public.persons (id, auth_user_id, status)
values
  ('20000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001', 'active'),
  ('20000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000002', 'active'),
  ('20000000-0000-4000-8000-000000000003', null, 'active');

insert into private.person_private_identity (person_id, legal_name, nationality)
values ('20000000-0000-4000-8000-000000000001', 'Test Person A', 'RW');

insert into private.person_contact_points (
  person_id, contact_type, contact_value, normalized_value, is_primary, verified_at
) values (
  '20000000-0000-4000-8000-000000000001', 'email',
  'identity-test-a@example.invalid', 'identity-test-a@example.invalid', true, now()
);

insert into public.organizations (id, name, slug)
values ('30000000-0000-4000-8000-000000000001', 'Test Organization', 'test-organization');

insert into public.schools (id, organization_id, name, code, email)
values
  ('40000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000001', 'Test School A', 'TEST-A', 'test-a@example.invalid'),
  ('40000000-0000-4000-8000-000000000002',
   '30000000-0000-4000-8000-000000000001', 'Test School B', 'TEST-B', 'test-b@example.invalid');

insert into public.organization_memberships (
  organization_id, person_id, status, started_at
) values (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', 'active', now()
);

insert into public.school_memberships (
  school_id, person_id, status, started_at, ended_at
) values
  ('40000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', 'revoked', now() - interval '2 years', now() - interval '1 year'),
  ('40000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', 'active', now(), null),
  ('40000000-0000-4000-8000-000000000002',
   '20000000-0000-4000-8000-000000000002', 'active', now(), null);

select is(
  (select count(*)::integer from public.persons
   where auth_user_id = '10000000-0000-4000-8000-000000000001'),
  1,
  'person can be linked to an Auth user'
);
select is(
  (select auth_user_id from public.persons
   where id = '20000000-0000-4000-8000-000000000003'),
  null::uuid,
  'person may exist without an Auth user'
);
select is(
  (select count(*)::integer from public.school_memberships
   where school_id = '40000000-0000-4000-8000-000000000001'
     and person_id = '20000000-0000-4000-8000-000000000001'),
  2,
  'revoked membership history is retained when the person returns to that school'
);

select throws_ok(
  $$insert into public.school_memberships (school_id, person_id, status, started_at)
    values ('40000000-0000-4000-8000-000000000001',
            '20000000-0000-4000-8000-000000000001', 'active', now())$$,
  '23505', null,
  'a person cannot hold a second active membership at the same school'
);
select throws_ok(
  $$insert into public.school_memberships (school_id, person_id, status, started_at)
    values ('40000000-0000-4000-8000-000000000002',
            '20000000-0000-4000-8000-000000000001', 'active', now())$$,
  '23505', null,
  'a person cannot hold active memberships at two schools'
);
select throws_ok(
  $$insert into public.persons (auth_user_id, status)
    values ('10000000-0000-4000-8000-000000000001', 'active')$$,
  '23505', null,
  'an Auth user cannot be linked to a second person'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::integer from public.persons),
  1,
  'a user can read only their linked person row'
);
select is(
  (select count(*)::integer from public.persons
   where id = '20000000-0000-4000-8000-000000000002'),
  0,
  'a user cannot read another person by knowing its ID'
);
select is(
  (select count(*)::integer from public.persons
   where id = '20000000-0000-4000-8000-000000000003'),
  0,
  'a person without an Auth link is not visible to unrelated users'
);
select is(
  (select count(*)::integer from public.schools),
  1,
  'a school member can read only their active school metadata'
);
select is(
  (select count(*)::integer from public.schools
   where id = '40000000-0000-4000-8000-000000000002'),
  0,
  'organization membership does not grant access to another school'
);
select is(
  (select count(*)::integer from public.school_memberships),
  2,
  'a user can read their own current and historical membership rows'
);
select is(
  (select count(*)::integer from public.organizations),
  1,
  'an active organization member can read that organization metadata'
);
select is(
  (select count(*)::integer from public.organization_memberships),
  1,
  'an organization member can read only their own membership row'
);

select throws_ok(
  $$select * from private.person_private_identity$$,
  '42501', null,
  'authenticated users cannot read private identity fields'
);
select throws_ok(
  $$select * from private.person_contact_points$$,
  '42501', null,
  'authenticated users cannot read private contact fields'
);
select throws_ok(
  $$insert into public.persons (status) values ('active')$$,
  '42501', null,
  'authenticated users cannot directly create persons'
);
select throws_ok(
  $$update public.school_memberships set status = 'revoked'$$,
  '42501', null,
  'authenticated users cannot directly change membership status'
);
select throws_ok(
  $$insert into public.organization_memberships (organization_id, person_id)
    values ('30000000-0000-4000-8000-000000000001',
            '20000000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'authenticated users cannot directly create organization memberships'
);
select throws_ok(
  $$insert into private.person_private_identity (person_id, legal_name)
    values ('20000000-0000-4000-8000-000000000001', 'Unauthorized')$$,
  '42501', null,
  'authenticated users cannot write private identity fields'
);
select throws_ok(
  $$insert into private.person_contact_points
      (person_id, contact_type, contact_value, normalized_value)
    values ('20000000-0000-4000-8000-000000000001', 'email', 'x@example.invalid', 'x@example.invalid')$$,
  '42501', null,
  'authenticated users cannot write private contact fields'
);
select throws_ok(
  $$insert into public.platform_memberships (person_id, status, started_at)
    values ('20000000-0000-4000-8000-000000000001', 'active', now())$$,
  '42501', null,
  'authenticated users cannot grant platform membership'
);

reset role;
select * from finish();
rollback;
