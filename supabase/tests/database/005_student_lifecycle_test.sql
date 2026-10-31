begin;

select plan(40);

select has_table('public', 'student_records', 'student record table exists');
select has_table('public', 'student_documents', 'student document metadata exists');
select has_table('public', 'guardian_relationships', 'guardian relationship table exists');
select has_table('public', 'guardian_relationship_permissions', 'guardian permission history exists');
select has_table('public', 'guardian_link_requests', 'guardian invitation request lifecycle exists');
select has_table('public', 'guardian_link_audit', 'guardian link audit history exists');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.student_records'::regclass), 'student records use forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.student_documents'::regclass), 'student documents use forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.guardian_relationships'::regclass), 'guardian relationships use forced RLS');
select ok(exists (select 1 from pg_indexes where indexname = 'student_one_active_record_per_person'), 'one active student record per person is enforced');
select ok(exists (select 1 from pg_indexes where indexname = 'guardian_relationship_one_active_per_pair'), 'same guardian cannot hold duplicate active links to a student');
select ok(not exists (select 1 from pg_indexes where indexname ilike '%guardian%one_active_per_student'), 'multiple guardians per student are supported');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.student_records'::regclass and conname = 'student_records_person_auth_fkey'), 'student Auth ID must match the linked person');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.guardian_relationships'::regclass and conname = 'guardian_relationships_person_auth_fkey'), 'guardian Auth identity must match the guardian person');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.guardian_link_requests'::regclass and conname = 'guardian_link_requests_relationship_fkey'), 'guardian request links are bound to their exact relationship, student and identity');

insert into auth.users (id, aud, role, email, phone, raw_app_meta_data, raw_user_meta_data) values
 ('14000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', null, '+250780000001', '{}'::jsonb, '{}'::jsonb),
 ('14000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'guardian-a@example.invalid', null, '{}'::jsonb, '{}'::jsonb),
 ('14000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'guardian-b@example.invalid', null, '{}'::jsonb, '{}'::jsonb),
 ('14000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'student-b@example.invalid', null, '{}'::jsonb, '{}'::jsonb);
insert into public.persons (id, auth_user_id) values
 ('24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001'),
 ('24000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000002'),
 ('24000000-0000-4000-8000-000000000003', '14000000-0000-4000-8000-000000000003'),
 ('24000000-0000-4000-8000-000000000004', null),
 ('24000000-0000-4000-8000-000000000005', '14000000-0000-4000-8000-000000000004');
insert into public.organizations (id, name, slug)
values ('34000000-0000-4000-8000-000000000001', 'Student Org', 'student-org');
insert into public.schools (id, organization_id, name, code, email) values
 ('44000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', 'Student School A', 'STUDENT-SCHOOL-A', 'student-school-a@example.invalid'),
 ('44000000-0000-4000-8000-000000000002', '34000000-0000-4000-8000-000000000001', 'Student School B', 'STUDENT-SCHOOL-B', 'student-school-b@example.invalid');
insert into public.school_memberships (id, school_id, person_id, status, started_at)
values
 ('74000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', 'active', now()),
 ('74000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000004', 'active', now()),
  ('74000000-0000-4000-8000-000000000004', '44000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000002', 'active', now()),
  ('74000000-0000-4000-8000-000000000005', '44000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000003', 'active', now()),
 ('74000000-0000-4000-8000-000000000003', '44000000-0000-4000-8000-000000000002', '24000000-0000-4000-8000-000000000005', 'active', now());
insert into public.student_records (id, school_id, person_id, auth_user_id, school_membership_id, admission_number, status, created_by_membership_id, created_by_person_id)
values ('84000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001', 'STU-001', 'active', '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001');
insert into public.student_records (id, school_id, person_id, auth_user_id, school_membership_id, admission_number, status, created_by_membership_id, created_by_person_id)
values ('84000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000002', '24000000-0000-4000-8000-000000000005', '14000000-0000-4000-8000-000000000004', '74000000-0000-4000-8000-000000000003', 'STU-002', 'active', '74000000-0000-4000-8000-000000000003', '24000000-0000-4000-8000-000000000005');
insert into public.student_documents (school_id, student_id, document_kind, storage_object_path, original_filename, content_type, byte_size, uploaded_by_membership_id, uploaded_by_person_id)
values ('44000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'admission', 'school/student/admission.pdf', 'admission.pdf', 'application/pdf', 1024, '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001');
insert into public.guardian_relationships (id, school_id, student_id, guardian_person_id, guardian_auth_user_id, guardian_school_membership_id, relationship_type, status, identity_verified_at, relationship_verified_at, relationship_verified_by_membership_id, relationship_verified_by_person_id, approved_at, approved_by_membership_id, approved_by_person_id, activated_at, created_by_membership_id, created_by_person_id) values
 ('54000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000004', 'parent', 'active', now(), now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001'),
 ('54000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000003', '14000000-0000-4000-8000-000000000003', '74000000-0000-4000-8000-000000000005', 'legal_guardian', 'active', now(), now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001');
insert into public.guardian_link_requests (school_id, student_id, relationship_type, invited_contact_hash, token_hash, status, expires_at, invited_by_membership_id, invited_by_person_id)
values ('44000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'parent', decode(repeat('ab', 32), 'hex'), decode(repeat('cd', 32), 'hex'), 'invited', now() + interval '2 days', '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001');
insert into public.guardian_link_requests (id, school_id, student_id, guardian_person_id, guardian_auth_user_id, guardian_school_membership_id, relationship_id, relationship_type, invited_contact_hash, token_hash, status, identity_verified_at, relationship_verified_at, relationship_verified_by_membership_id, relationship_verified_by_person_id, approved_at, approved_by_membership_id, approved_by_person_id, activated_at, expires_at, invited_by_membership_id, invited_by_person_id)
values ('64000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000004', '54000000-0000-4000-8000-000000000001', 'parent', decode(repeat('ef', 32), 'hex'), decode(repeat('01', 32), 'hex'), 'activated', now(), now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', now(), now() + interval '2 days', '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001');
insert into public.guardian_link_audit (school_id, student_id, actor_membership_id, actor_person_id, event_type)
values ('44000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', 'invitation_created');

select is((select count(*)::integer from public.student_records where id in ('84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000002') and status = 'active'), 2, 'student records are linked to Auth identities');
select is((select email::text from auth.users where id = '14000000-0000-4000-8000-000000000001'), null::text, 'student account does not require an email address');
select is((select count(*)::integer from public.guardian_relationships where student_id = '84000000-0000-4000-8000-000000000001' and status = 'active'), 2, 'a student may have multiple active guardians');
select is((select count(*)::integer from public.guardian_link_requests where status = 'invited'), 1, 'invitation request stores only hashed invite material');
select is((select count(*)::integer from public.guardian_link_audit), 1, 'guardian lifecycle event is auditable');
select throws_ok($$insert into public.student_records (school_id, person_id, auth_user_id, school_membership_id, admission_number, status, created_by_membership_id, created_by_person_id) values ('44000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000004', '14000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000002', 'STU-002', 'pending', '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001')$$, '23503', null, 'student record cannot link another person’s Auth account');
select throws_ok($$insert into public.guardian_relationships (school_id, student_id, guardian_person_id, guardian_auth_user_id, guardian_school_membership_id, relationship_type, status, identity_verified_at, relationship_verified_at, relationship_verified_by_membership_id, relationship_verified_by_person_id, approved_at, approved_by_membership_id, approved_by_person_id, activated_at, created_by_membership_id, created_by_person_id) values ('44000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000004', '14000000-0000-4000-8000-000000000003', '74000000-0000-4000-8000-000000000002', 'parent', 'active', now(), now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001')$$, '23503', null, 'guardian person cannot be linked to a different Auth identity');
select throws_ok($$insert into public.guardian_relationships (school_id, student_id, guardian_person_id, relationship_type, status, created_by_membership_id, created_by_person_id) values ('44000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000004', 'parent', 'active', '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001')$$, '23514', null, 'active guardian link requires verified identity and school approval');
select throws_ok($$insert into public.guardian_relationships (school_id, student_id, guardian_person_id, guardian_auth_user_id, guardian_school_membership_id, relationship_type, status, identity_verified_at, relationship_verified_at, relationship_verified_by_membership_id, relationship_verified_by_person_id, approved_at, approved_by_membership_id, approved_by_person_id, activated_at, created_by_membership_id, created_by_person_id) values ('44000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000004', 'parent', 'active', now(), now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001')$$, '23505', null, 'same guardian cannot hold duplicate active relationship history');
select throws_ok($$insert into public.guardian_link_requests (school_id, student_id, guardian_person_id, guardian_auth_user_id, guardian_school_membership_id, relationship_id, relationship_type, invited_contact_hash, token_hash, status, identity_verified_at, relationship_verified_at, relationship_verified_by_membership_id, relationship_verified_by_person_id, approved_at, approved_by_membership_id, approved_by_person_id, activated_at, expires_at, invited_by_membership_id, invited_by_person_id) values ('44000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000004', '54000000-0000-4000-8000-000000000002', 'parent', decode(repeat('22', 32), 'hex'), decode(repeat('23', 32), 'hex'), 'activated', now(), now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', now(), '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', now(), now() + interval '2 days', '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001')$$, '23503', null, 'guardian request cannot reference a relationship owned by another guardian');
select throws_ok($$update public.guardian_link_audit set event_type = 'changed'$$, '55000', null, 'guardian audit history rejects updates');

set local role authenticated;
set local request.jwt.claims = '{"sub":"14000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.student_records), 1, 'student reads their own profile');
select is((select count(*)::integer from public.student_records where id = '84000000-0000-4000-8000-000000000002'), 0, 'student cannot read another school student by ID');
select is((select count(*)::integer from public.student_documents), 1, 'student reads their own document metadata');
select is((select count(*)::integer from public.guardian_relationships), 0, 'student cannot enumerate linked guardian identity records');
select ok(not has_table_privilege('authenticated', 'public.student_records', 'INSERT'), 'authenticated users cannot directly create student records');
select ok(not has_table_privilege('service_role', 'public.student_records', 'INSERT'), 'service role cannot bypass student provisioning authorization');
select ok(not has_column_privilege('authenticated', 'public.guardian_link_requests', 'token_hash', 'SELECT'), 'guardian invitation token hashes are not readable through the Data API');
select ok(not has_column_privilege('authenticated', 'public.guardian_link_requests', 'invited_contact_hash', 'SELECT'), 'guardian contact hashes are not readable through the Data API');
select throws_ok($$insert into public.student_records (school_id, person_id, auth_user_id, school_membership_id, admission_number, created_by_membership_id, created_by_person_id) values ('44000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001', 'STU-003', '74000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001')$$, '42501', null, 'student cannot directly provision or edit their school record');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"14000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*)::integer from public.guardian_relationships), 1, 'guardian reads only their own verified relationship');
select is((select count(*)::integer from public.guardian_link_requests where status = 'activated'), 1, 'guardian reads only their verified and exactly linked activated request');
select is((select count(*)::integer from public.student_records), 0, 'guardian cannot read student profile without an approved individual permission');
select is((select count(*)::integer from public.guardian_relationship_permissions), 0, 'no guardian data permissions are granted by default');
select throws_ok($$update public.guardian_relationships set status = 'revoked'$$, '42501', null, 'guardian cannot self-revoke or alter school relationship records');
reset role;

select * from finish();
rollback;
