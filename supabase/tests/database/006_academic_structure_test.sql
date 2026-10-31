begin;
select plan(22);

select has_table('public','education_levels','education levels exist');
select has_table('public','class_sections','school-year class sections exist');
select has_table('public','subjects','school-specific subjects exist');
select has_table('public','class_subjects','class subject offerings exist');
select has_table('public','teacher_assignments','teacher assignments exist');
select has_table('public','student_enrollments','student academic-year enrollments exist');
select has_table('public','student_class_placements','student placement history exists');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.class_sections'::regclass),'class sections enforce RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.student_enrollments'::regclass),'enrollments enforce RLS');
select ok(exists(select 1 from pg_indexes where indexname='student_enrollments_one_per_year'),'student cannot enroll twice in the same school year');
select ok(exists(select 1 from pg_indexes where indexname='student_class_placements_one_active'),'one active class placement is enforced');
select ok(exists(select 1 from pg_indexes where indexname='teacher_assignments_one_active_class_teacher'),'only one active class teacher is allowed');
select ok(exists(select 1 from pg_constraint where conrelid='public.class_sections'::regclass and contype='f'),'class section school/year/level foreign keys exist');
select ok(exists(select 1 from pg_constraint where conrelid='public.student_class_placements'::regclass and conname='student_class_placements_enrollment_id_school_id_academic__fkey' and contype='f'),'placement must match its enrollment school and academic year');

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('16000000-0000-4000-8000-000000000001','authenticated','authenticated','academic-a@example.invalid','{}','{}'),
 ('16000000-0000-4000-8000-000000000002','authenticated','authenticated','academic-b@example.invalid','{}','{}');
insert into public.persons (id,auth_user_id) values
 ('26000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000001'),
 ('26000000-0000-4000-8000-000000000002','16000000-0000-4000-8000-000000000002');
insert into public.organizations (id,name,slug) values ('36000000-0000-4000-8000-000000000001','Academic Org','academic-org');
insert into public.schools (id,organization_id,name,code,email) values
 ('46000000-0000-4000-8000-000000000001','36000000-0000-4000-8000-000000000001','Academic A','ACAD-A','acad-a@example.invalid'),
 ('46000000-0000-4000-8000-000000000002','36000000-0000-4000-8000-000000000001','Academic B','ACAD-B','acad-b@example.invalid');
insert into public.school_memberships (id,school_id,person_id,status,started_at) values
 ('76000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','active',now()),
 ('76000000-0000-4000-8000-000000000002','46000000-0000-4000-8000-000000000002','26000000-0000-4000-8000-000000000002','active',now());
insert into public.academic_years (id,school_id,name,start_date,end_date,status,activated_at,activated_by_membership_id,activated_by_person_id,created_by_membership_id,created_by_person_id)
values ('86000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','2026','2026-01-01','2026-12-31','active',now(),'76000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001'),
 ('86000000-0000-4000-8000-000000000002','46000000-0000-4000-8000-000000000002','2026','2026-01-01','2026-12-31','active',now(),'76000000-0000-4000-8000-000000000002','26000000-0000-4000-8000-000000000002','76000000-0000-4000-8000-000000000002','26000000-0000-4000-8000-000000000002');
insert into public.education_levels (id,school_id,level_code,name) values
 ('96000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','P1','Primary 1'),
 ('96000000-0000-4000-8000-000000000002','46000000-0000-4000-8000-000000000002','P1','Primary 1');
insert into public.class_sections (id,school_id,academic_year_id,education_level_id,section_code,name,created_by_membership_id,created_by_person_id) values
 ('a6000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','P1-A','P1 A','76000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001');
insert into public.student_records (id,school_id,person_id,auth_user_id,school_membership_id,admission_number,status,created_by_membership_id,created_by_person_id)
values ('b6000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000002','26000000-0000-4000-8000-000000000002','16000000-0000-4000-8000-000000000002','76000000-0000-4000-8000-000000000002','ACAD-STU-B','active','76000000-0000-4000-8000-000000000002','26000000-0000-4000-8000-000000000002');
insert into public.student_enrollments (id,school_id,student_id,academic_year_id,status,created_by_membership_id,created_by_person_id)
values ('c6000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000002','b6000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000002','enrolled','76000000-0000-4000-8000-000000000002','26000000-0000-4000-8000-000000000002');
select throws_ok($$insert into public.student_class_placements (school_id,academic_year_id,enrollment_id,class_section_id,assigned_by_membership_id,assigned_by_person_id) values ('46000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001')$$,'23503',null,'placement cannot use an enrollment from another school or academic year');
select throws_ok($$insert into public.class_sections (school_id,academic_year_id,education_level_id,section_code,name,created_by_membership_id,created_by_person_id) values ('46000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002','BAD','Bad','76000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001')$$,'23503',null,'a class cannot reference another school education level');

set local role authenticated;
set local request.jwt.claims='{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.education_levels),1,'active member sees school curriculum only');
select is((select count(*)::integer from public.class_sections),1,'active member sees own school sections');
select ok(not has_table_privilege('authenticated','public.student_enrollments','INSERT'),'browser cannot directly create enrollments');
select ok(not has_table_privilege('authenticated','public.teacher_assignments','UPDATE'),'browser cannot directly change assignments');
select ok(not has_table_privilege('service_role','public.student_class_placements','INSERT'),'service role does not bypass guarded provisioning');
select throws_ok($$insert into public.subjects (school_id,subject_code,name) values ('46000000-0000-4000-8000-000000000001','MATH','Math')$$,'42501',null,'authenticated direct writes are denied');
reset role;
select * from finish();
rollback;
