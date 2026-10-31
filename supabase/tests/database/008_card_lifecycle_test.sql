begin;
select plan(22);
select has_table('public','card_assignments','card assignments and history exist');
select has_table('public','card_identifiers','keyed identifier digests are separate');
select has_table('public','card_lifecycle_events','card lifecycle audit exists');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.card_assignments'::regclass),'card assignments enforce RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.card_identifiers'::regclass),'identifier digests enforce RLS');
select ok(exists(select 1 from pg_indexes where indexname='card_assignments_active_student_key'),'one current student card assignment is enforced');
select ok(exists(select 1 from pg_indexes where indexname='card_assignments_active_staff_key'),'one current staff card assignment is enforced');
select ok(exists(select 1 from pg_indexes where indexname='card_identifiers_one_active_kind_per_card'),'only one active identifier of a kind per card');
select ok(not has_table_privilege('authenticated','public.card_assignments','INSERT'),'browser cannot issue cards directly');
select ok(not has_table_privilege('service_role','public.card_identifiers','SELECT'),'service role has no direct identifier read grant');

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('18000000-0000-4000-8000-000000000001','authenticated','authenticated','cards-a@example.invalid','{}','{}'),
 ('18000000-0000-4000-8000-000000000002','authenticated','authenticated','cards-b@example.invalid','{}','{}');
insert into public.persons (id,auth_user_id) values
 ('28000000-0000-4000-8000-000000000001','18000000-0000-4000-8000-000000000001'),
 ('28000000-0000-4000-8000-000000000002','18000000-0000-4000-8000-000000000002');
insert into public.organizations (id,name,slug) values ('38000000-0000-4000-8000-000000000001','Cards Org','cards-org');
insert into public.schools (id,organization_id,name,code,email) values
 ('48000000-0000-4000-8000-000000000001','38000000-0000-4000-8000-000000000001','Cards A','CARD-A','card-a@example.invalid'),
 ('48000000-0000-4000-8000-000000000002','38000000-0000-4000-8000-000000000001','Cards B','CARD-B','card-b@example.invalid');
insert into public.school_memberships (id,school_id,person_id,status,started_at) values
 ('78000000-0000-4000-8000-000000000001','48000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001','active',now()),
 ('78000000-0000-4000-8000-000000000002','48000000-0000-4000-8000-000000000002','28000000-0000-4000-8000-000000000002','active',now());
insert into public.student_records (id,school_id,person_id,auth_user_id,school_membership_id,admission_number,status,created_by_membership_id,created_by_person_id) values
 ('88000000-0000-4000-8000-000000000001','48000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001','18000000-0000-4000-8000-000000000001','78000000-0000-4000-8000-000000000001','CARD-STU-A','active','78000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001'),
 ('88000000-0000-4000-8000-000000000002','48000000-0000-4000-8000-000000000002','28000000-0000-4000-8000-000000000002','18000000-0000-4000-8000-000000000002','78000000-0000-4000-8000-000000000002','CARD-STU-B','active','78000000-0000-4000-8000-000000000002','28000000-0000-4000-8000-000000000002');
insert into public.card_assignments (id,school_id,card_number,holder_kind,student_id,status,activated_at,issued_by_membership_id,issued_by_person_id)
values ('98000000-0000-4000-8000-000000000001','48000000-0000-4000-8000-000000000001','K-001','student','88000000-0000-4000-8000-000000000001','active',now(),'78000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001');
insert into public.card_assignments (id,school_id,card_number,holder_kind,student_id,status,activated_at,issued_by_membership_id,issued_by_person_id)
values ('98000000-0000-4000-8000-000000000002','48000000-0000-4000-8000-000000000002','K-B','student','88000000-0000-4000-8000-000000000002','active',now(),'78000000-0000-4000-8000-000000000002','28000000-0000-4000-8000-000000000002');
insert into public.card_identifiers (school_id,card_assignment_id,identifier_kind,keyed_digest,digest_key_version)
values ('48000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','nfc_uid',decode(repeat('ab',32),'hex'),1);
select throws_ok($$insert into public.card_assignments (school_id,card_number,holder_kind,student_id,status,activated_at,issued_by_membership_id,issued_by_person_id) values ('48000000-0000-4000-8000-000000000001','K-002','student','88000000-0000-4000-8000-000000000001','active',now(),'78000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001')$$,'23505',null,'student cannot have duplicate active card assignment');
select throws_ok($$insert into public.card_assignments (school_id,card_number,holder_kind,student_id,status,activated_at,issued_by_membership_id,issued_by_person_id) values ('48000000-0000-4000-8000-000000000001','K-003','student','88000000-0000-4000-8000-000000000002','active',now(),'78000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001')$$,'23503',null,'cross-school student assignment is rejected');
select throws_ok($$insert into public.card_assignments (school_id,card_number,holder_kind,student_id,status,issued_by_membership_id,issued_by_person_id,revoked_at,revoked_by_membership_id,revoked_by_person_id) values ('48000000-0000-4000-8000-000000000001','K-004','student','88000000-0000-4000-8000-000000000001','revoked','78000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001',null,null,null)$$,'23514',null,'revoked card state requires activation and revocation metadata');
select throws_ok($$insert into public.card_identifiers (school_id,card_assignment_id,identifier_kind,keyed_digest,digest_key_version) values ('48000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','nfc_uid',decode(repeat('ab',32),'hex'),1)$$,'23505',null,'duplicate school-scoped card identifier digest is rejected');
insert into public.card_lifecycle_events (school_id,card_assignment_id,event_type,new_status,actor_membership_id,actor_person_id)
values ('48000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','issued','active','78000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claims='{"sub":"18000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.card_assignments),1,'holder can read own card assignment');
select is((select count(*)::integer from public.card_assignments where card_number='K-B'),0,'holder cannot read another school card by known number');
select is((select count(*)::integer from public.card_assignments where card_number='K-999'),0,'holder cannot enumerate unknown cards');
select ok(not has_table_privilege('authenticated','public.card_identifiers','SELECT'),'card identifiers are not readable through Data API');
select throws_ok($$update public.card_assignments set status='revoked'$$,'42501',null,'holder cannot self-change card status');
select throws_ok($$insert into public.card_lifecycle_events (school_id,card_assignment_id,event_type,new_status,actor_membership_id,actor_person_id) values ('48000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','revoked','revoked','78000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001')$$,'42501',null,'holder cannot forge card lifecycle events');
reset role;
select ok(exists(select 1 from pg_trigger where tgname='card_lifecycle_events_no_truncate'),'card lifecycle audit rejects truncation');
select ok(exists(select 1 from pg_trigger where tgname='card_lifecycle_events_no_update_delete'),'card lifecycle audit rejects edits');
select * from finish();
rollback;
