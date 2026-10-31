begin;
select plan(51);
select ok(not has_table_privilege('authenticated','public.card_assignments','INSERT'),'cards cannot be issued by direct table writes');
select ok(not has_table_privilege('authenticated','public.card_assignments','UPDATE'),'card lifecycle changes require audited functions');
select ok(not has_table_privilege('authenticated','public.card_identifiers','SELECT'),'raw/card identifier digests are not exposed through Data API');
select ok(not has_column_privilege('authenticated','public.card_assignments','card_number','SELECT'),'untrusted card serial/identifier field is not exposed by direct selects');
select ok(not has_function_privilege('authenticated','public.issue_card_from_edge(uuid,uuid,text,uuid,uuid,text,bytea,smallint)','EXECUTE'),'browser cannot supply arbitrary card digests to issue operation');
select ok(has_function_privilege('service_role','public.issue_card_from_edge(uuid,uuid,text,uuid,uuid,text,bytea,smallint)','EXECUTE'),'trusted card Edge Function can store keyed digest');
select ok(has_function_privilege('authenticated','public.activate_card(uuid,uuid)','EXECUTE'),'card activation is role-scoped');
select ok(has_function_privilege('authenticated','public.change_card_status(uuid,uuid,text,text)','EXECUTE'),'card suspension and revocation are role-scoped');
select ok(not has_function_privilege('authenticated','public.replace_card_from_edge(uuid,uuid,uuid,text,bytea,smallint,text)','EXECUTE'),'replacement identifier digest is accepted only from Edge Function');
select ok(has_function_privilege('service_role','public.replace_card_from_edge(uuid,uuid,uuid,text,bytea,smallint,text)','EXECUTE'),'trusted card Edge Function can replace and hash identifiers');
select ok(has_function_privilege('authenticated','public.list_school_cards(uuid)','EXECUTE'),'card inventory uses scoped safe projection RPC');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='card_assignments_active_student_key'),'student cannot have duplicate active issued cards');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='card_assignments_active_staff_key'),'staff cannot have duplicate active issued cards');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='card_identifiers_school_id_identifier_kind_keyed_digest_key'),'same school cannot bind a digest twice per identifier kind');
select has_trigger('public','card_lifecycle_events','card_lifecycle_events_no_update_delete','card lifecycle events are append-only');
select has_trigger('public','card_lifecycle_events','card_lifecycle_events_no_truncate','card lifecycle history cannot be truncated');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='card_lifecycle_events' and policyname='card_lifecycle_events_select_authorized'),'card history reads require school card permission');
select throws_ok($$select public.activate_card('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')$$,'42501',null,'unauthorized activation is rejected');

-- Behavior fixtures exercise card lifecycle side effects and device scans.
insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('1e000000-0000-4000-8000-000000000001','authenticated','authenticated','card-manager@example.invalid','{}','{}'),
 ('1e000000-0000-4000-8000-000000000002','authenticated','authenticated','card-student@example.invalid','{}','{}');
insert into public.persons (id,auth_user_id) values
 ('2e000000-0000-4000-8000-000000000001','1e000000-0000-4000-8000-000000000001'),
 ('2e000000-0000-4000-8000-000000000002','1e000000-0000-4000-8000-000000000002');
insert into public.organizations (id,name,slug) values
 ('3e000000-0000-4000-8000-000000000001','Card Workflow Test Org','card-workflow-test-org');
insert into public.schools (id,organization_id,name,code,email) values
 ('4e000000-0000-4000-8000-000000000001','3e000000-0000-4000-8000-000000000001','Card Workflow Test School A','CARD-WORKFLOW-A','card-workflow-a@example.invalid'),
 ('4e000000-0000-4000-8000-000000000002','3e000000-0000-4000-8000-000000000001','Card Workflow Test School B','CARD-WORKFLOW-B','card-workflow-b@example.invalid');
insert into public.school_settings (school_id) values ('4e000000-0000-4000-8000-000000000001');
insert into public.school_memberships (id,school_id,person_id,status,started_at) values
 ('7e000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000001','2e000000-0000-4000-8000-000000000001','active',now()),
 ('7e000000-0000-4000-8000-000000000002','4e000000-0000-4000-8000-000000000001','2e000000-0000-4000-8000-000000000002','active',now());
insert into public.school_membership_roles (school_id,membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason)
values ('4e000000-0000-4000-8000-000000000001','7e000000-0000-4000-8000-000000000001','2e000000-0000-4000-8000-000000000001','SCHOOL_MANAGER','7e000000-0000-4000-8000-000000000001','2e000000-0000-4000-8000-000000000001','card and attendance workflow test authority');
insert into public.student_records (id,school_id,person_id,auth_user_id,school_membership_id,admission_number,status,created_by_membership_id,created_by_person_id)
values ('8e000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000001','2e000000-0000-4000-8000-000000000002','1e000000-0000-4000-8000-000000000002','7e000000-0000-4000-8000-000000000002','CARD-WF-001','active','7e000000-0000-4000-8000-000000000001','2e000000-0000-4000-8000-000000000001');

set local role service_role;
select ok(set_config('test.lifecycle_card_id',public.issue_card_from_edge(
 '1e000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000001','student','8e000000-0000-4000-8000-000000000001',null::uuid,'nfc_uid',decode(repeat('ab',32),'hex'),1::smallint
)::text,true) is not null,'trusted card issue creates a card assignment and protected identifier');
reset role;

set local role authenticated;
set local request.jwt.claims='{"sub":"1e000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.activate_card('4e000000-0000-4000-8000-000000000001',current_setting('test.lifecycle_card_id')::uuid);
reset role;
select is((select status from public.card_assignments where id=current_setting('test.lifecycle_card_id')::uuid),'active','authorized card activation changes the card state');
select is((select count(*)::integer from public.card_lifecycle_events where card_assignment_id=current_setting('test.lifecycle_card_id')::uuid),2,'issue and activation append lifecycle history');
select ok((select count(*)=2 from public.school_operation_audit where entity_type='card' and entity_id=current_setting('test.lifecycle_card_id')::uuid and event_type in ('card_issued','card_activated')),'issue and activation append school audit events');
set local role authenticated;
set local request.jwt.claims='{"sub":"1e000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(set_config('test.attendance_device_id',public.register_attendance_device('4e000000-0000-4000-8000-000000000001','CARD-WF-DEVICE','mobile',decode(repeat('cd',32),'hex'))::text,true) is not null,'authorized manager registers a school-scoped attendance device');
reset role;

set local role service_role;
select ok(set_config('test.accepted_scan_id',public.process_attendance_scan(
 '4e000000-0000-4000-8000-000000000001',current_setting('test.attendance_device_id')::uuid,decode(repeat('cd',32),'hex'),decode(repeat('ab',32),'hex'),'9e000000-0000-4000-8000-000000000001','in'
)::text,true) is not null,'authorized active device accepts an active student card scan');
reset role;
select is((select outcome from public.get_attendance_scan_outcome(current_setting('test.accepted_scan_id')::uuid)),'accepted','accepted scan outcome is returned by the bounded contract');
select ok(exists(select 1 from public.attendance_scan_events where id=current_setting('test.accepted_scan_id')::uuid and attendance_record_id is not null),'accepted scan creates and links an attendance record');
set local role service_role;
select is(public.process_attendance_scan(
 '4e000000-0000-4000-8000-000000000001',current_setting('test.attendance_device_id')::uuid,decode(repeat('cd',32),'hex'),decode(repeat('ab',32),'hex'),'9e000000-0000-4000-8000-000000000001','in'
)::text,current_setting('test.accepted_scan_id'),'retrying an idempotency key returns the original event');
reset role;
select is((select count(*)::integer from public.attendance_scan_events where school_id='4e000000-0000-4000-8000-000000000001' and idempotency_key='9e000000-0000-4000-8000-000000000001'),1,'idempotent retry does not append a second scan event');
set local role service_role;
select ok(set_config('test.duplicate_scan_id',public.process_attendance_scan(
 '4e000000-0000-4000-8000-000000000001',current_setting('test.attendance_device_id')::uuid,decode(repeat('cd',32),'hex'),decode(repeat('ab',32),'hex'),'9e000000-0000-4000-8000-000000000002','in'
)::text,true) is not null,'new scan key is processed for an already-attended student');
reset role;
select is((select outcome from public.get_attendance_scan_outcome(current_setting('test.duplicate_scan_id')::uuid)),'duplicate','repeat arrival is classified as duplicate');
select is((select count(*)::integer from public.attendance_records where school_id='4e000000-0000-4000-8000-000000000001' and student_id='8e000000-0000-4000-8000-000000000001'),1,'duplicate scan does not duplicate attendance rows');
set local role service_role;
select ok(set_config('test.rejected_scan_id',public.process_attendance_scan(
 '4e000000-0000-4000-8000-000000000001',current_setting('test.attendance_device_id')::uuid,decode(repeat('cd',32),'hex'),decode(repeat('ef',32),'hex'),'9e000000-0000-4000-8000-000000000003','in'
)::text,true) is not null,'valid device with unknown identifier is recorded as rejected');
reset role;
select is((select outcome from public.get_attendance_scan_outcome(current_setting('test.rejected_scan_id')::uuid)),'rejected','unknown card has rejected outcome');
select is((select rejection_code from public.get_attendance_scan_outcome(current_setting('test.rejected_scan_id')::uuid)),'unknown_card','rejection response has a bounded code');
set local role service_role;
select throws_ok($$select public.process_attendance_scan('4e000000-0000-4000-8000-000000000001',current_setting('test.attendance_device_id')::uuid,decode(repeat('00',32),'hex'),decode(repeat('ab',32),'hex'),'9e000000-0000-4000-8000-000000000004','in')$$,'42501',null,'incorrect device credential digest is rejected');
select ok(has_function_privilege('service_role','public.get_attendance_scan_outcome(uuid)','EXECUTE') and not has_function_privilege('authenticated','public.get_attendance_scan_outcome(uuid)','EXECUTE'),'scan outcome lookup remains server-only');
reset role;

set local role authenticated;
set local request.jwt.claims='{"sub":"1e000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.change_card_status('4e000000-0000-4000-8000-000000000001',current_setting('test.lifecycle_card_id')::uuid,'suspended','device test suspension');
reset role;
select is((select status from public.card_assignments where id=current_setting('test.lifecycle_card_id')::uuid),'suspended','authorized manager suspends an active card');
select ok(exists(select 1 from public.card_lifecycle_events where card_assignment_id=current_setting('test.lifecycle_card_id')::uuid and event_type='suspended' and prior_status='active' and new_status='suspended'),'suspension appends card lifecycle history');
select ok(exists(select 1 from public.school_operation_audit where entity_type='card' and entity_id=current_setting('test.lifecycle_card_id')::uuid and event_type='card_status_changed'),'suspension appends school audit event');
reset role;

set local role service_role;
select ok(set_config('test.inactive_card_scan_id',public.process_attendance_scan(
 '4e000000-0000-4000-8000-000000000001',current_setting('test.attendance_device_id')::uuid,decode(repeat('cd',32),'hex'),decode(repeat('ab',32),'hex'),'9e000000-0000-4000-8000-000000000005','in'
)::text,true) is not null,'scan of suspended card is processed as a rejection');
select is((select outcome from public.get_attendance_scan_outcome(current_setting('test.inactive_card_scan_id')::uuid)),'rejected','suspended card is rejected');
select is((select rejection_code from public.get_attendance_scan_outcome(current_setting('test.inactive_card_scan_id')::uuid)),'inactive_card_or_identifier','suspended-card rejection has bounded code');
select ok(set_config('test.wrong_school_scan_id',public.process_attendance_scan(
 '4e000000-0000-4000-8000-000000000002',current_setting('test.attendance_device_id')::uuid,decode(repeat('cd',32),'hex'),decode(repeat('ab',32),'hex'),'9e000000-0000-4000-8000-000000000006','in'
)::text,true) is not null,'device request with a different school is recorded under the device school');
select is((select rejection_code from public.get_attendance_scan_outcome(current_setting('test.wrong_school_scan_id')::uuid)),'school_scope_mismatch','scan cannot cross the registered device school scope');
reset role;

set local role service_role;
select ok(set_config('test.replacement_card_id',public.replace_card_from_edge(
 '1e000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000001',current_setting('test.lifecycle_card_id')::uuid,
 'nfc_uid',decode(repeat('ff',32),'hex'),1::smallint,'replace suspended card after device test'
)::text,true) is not null,'trusted card replacement creates a replacement assignment');
reset role;
select is((select status from public.card_assignments where id=current_setting('test.lifecycle_card_id')::uuid),'replaced','replacement retires the prior card assignment');
select is((select replacement_card_id from public.card_assignments where id=current_setting('test.lifecycle_card_id')::uuid),current_setting('test.replacement_card_id')::uuid,'prior card points to its replacement');
select is((select status from public.card_assignments where id=current_setting('test.replacement_card_id')::uuid),'issued','replacement card starts issued');
select ok(exists(select 1 from public.card_lifecycle_events where card_assignment_id=current_setting('test.lifecycle_card_id')::uuid and event_type='replaced') and exists(select 1 from public.card_lifecycle_events where card_assignment_id=current_setting('test.replacement_card_id')::uuid and event_type='issued'),'replacement appends lifecycle history for both cards');
select ok(exists(select 1 from public.card_identifiers where card_assignment_id=current_setting('test.replacement_card_id')::uuid and identifier_kind='nfc_uid' and keyed_digest=decode(repeat('ff',32),'hex') and status='active'),'replacement stores the new keyed identifier digest');
select ok(exists(select 1 from public.school_operation_audit where entity_type='card' and entity_id=current_setting('test.lifecycle_card_id')::uuid and event_type='card_replaced'),'replacement appends a school audit event');
select * from finish();
rollback;
