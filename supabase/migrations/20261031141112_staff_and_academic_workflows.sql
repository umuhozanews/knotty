-- Staff, teacher assignment, subject, and student promotion transactions.
-- Existing structural tables remain write-protected; changes use scoped RPCs.

alter table public.school_operation_audit drop constraint school_operation_audit_entity_type_check;
alter table public.school_operation_audit add constraint school_operation_audit_entity_type_check
  check (entity_type in ('school','settings','academic_year','academic_term','education_level','class_section','subject','class_subject','student','student_enrollment','student_placement','guardian_relationship','student_document','staff','teacher_assignment','attendance','card'));

create unique index student_enrollments_one_current_per_student
  on public.student_enrollments(school_id,student_id) where status='enrolled';

create policy staff_records_select_authorized_school on public.staff_records for select to authenticated
  using (private.has_school_permission(school_id,'staff.read'));
create policy staff_categories_select_authorized_school on public.staff_record_categories for select to authenticated
  using (private.has_school_permission(school_id,'staff.read'));
create policy teacher_details_select_authorized_school on public.teacher_details for select to authenticated
  using (private.has_school_permission(school_id,'staff.read'));
create policy teacher_assignments_select_authorized_school on public.teacher_assignments for select to authenticated
  using (private.has_school_permission(school_id,'academics.read') or exists(select 1 from public.staff_records sr join public.persons p on p.id=sr.person_id where sr.id=teacher_assignments.staff_record_id and sr.school_id=teacher_assignments.school_id and p.auth_user_id=(select auth.uid())));
create policy student_enrollments_select_academics on public.student_enrollments for select to authenticated
  using (private.has_school_permission(school_id,'academics.read'));
create policy student_class_placements_select_academics on public.student_class_placements for select to authenticated
  using (private.has_school_permission(school_id,'academics.read'));
create policy class_subjects_select_academics on public.class_subjects for select to authenticated
  using (private.has_school_permission(school_id,'academics.read'));
create policy subjects_select_academics on public.subjects for select to authenticated
  using (private.has_school_permission(school_id,'academics.read'));

create function public.register_staff(
  p_school_id uuid,p_employee_number text,p_legal_name text,p_job_title text,
  p_department text,p_hired_on date,p_categories text[],p_qualification text default null,
  p_specialization text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_person_id uuid; v_membership_id uuid; v_staff_id uuid; v_category text;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'staff.manage');
  if length(btrim(coalesce(p_employee_number,'')))=0 or length(btrim(coalesce(p_legal_name,'')))=0 or length(btrim(coalesce(p_job_title,'')))=0
     or p_hired_on is null or coalesce(cardinality(p_categories),0)=0 then raise exception 'employee number, legal name, job title, hire date and category required' using errcode='22023'; end if;
  if exists(select 1 from unnest(p_categories) c where c not in ('teaching','non_teaching')) then raise exception 'unsupported staff category' using errcode='22023'; end if;
  if ('teaching'=any(p_categories)) is distinct from (p_qualification is not null or p_specialization is not null) and ('teaching'=any(p_categories)) then
    raise exception 'teacher details must be supplied with teaching category' using errcode='22023';
  end if;
  insert into public.persons(status) values('active') returning id into v_person_id;
  insert into private.person_private_identity(person_id,legal_name) values(v_person_id,btrim(p_legal_name));
  insert into public.school_memberships(school_id,person_id,status,started_at) values(p_school_id,v_person_id,'active',now()) returning id into v_membership_id;
  insert into public.staff_records(school_id,person_id,school_membership_id,employee_number,job_title,department,employment_status,hired_on,created_by_membership_id,created_by_person_id)
    values(p_school_id,v_person_id,v_membership_id,btrim(p_employee_number),btrim(p_job_title),nullif(btrim(p_department),''),'active',p_hired_on,v_actor.membership_id,v_actor.person_id) returning id into v_staff_id;
  foreach v_category in array p_categories loop
    insert into public.staff_record_categories(school_id,staff_record_id,category_key,assigned_by_membership_id,assigned_by_person_id)
      values(p_school_id,v_staff_id,v_category,v_actor.membership_id,v_actor.person_id);
  end loop;
  if 'teaching'=any(p_categories) then
    insert into public.teacher_details(staff_record_id,school_id,qualification,specialization,hired_to_teach_on)
      values(v_staff_id,p_school_id,nullif(btrim(p_qualification),''),nullif(btrim(p_specialization),''),p_hired_on);
  end if;
  perform private.write_school_audit(p_school_id,'staff',v_staff_id,'staff_registered','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('categories',p_categories,'employee_number',btrim(p_employee_number)));
  return v_staff_id;
end;
$$;
alter function public.register_staff(uuid,text,text,text,text,date,text[],text,text) owner to postgres;
revoke all on function public.register_staff(uuid,text,text,text,text,date,text[],text,text) from public,anon,service_role;
grant execute on function public.register_staff(uuid,text,text,text,text,date,text[],text,text) to authenticated;

create function public.update_staff_status(p_school_id uuid,p_staff_record_id uuid,p_new_status text,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_hired_on date; v_old_status text;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'staff.manage');
  if p_new_status not in ('active','on_leave','suspended','terminated') or length(btrim(coalesce(p_reason,'')))<3 then raise exception 'valid employment status and reason required' using errcode='22023'; end if;
  select hired_on,employment_status into v_hired_on,v_old_status from public.staff_records where id=p_staff_record_id and school_id=p_school_id for update;
  if not found then raise exception 'staff record not found in school' using errcode='P0002'; end if;
  if v_old_status='terminated' then raise exception 'terminated employment is terminal; create a new staff record after rehire approval' using errcode='23514'; end if;
  if p_new_status='terminated' then
    update public.staff_records set employment_status='terminated',ended_on=current_date,updated_at=now() where id=p_staff_record_id and school_id=p_school_id;
    update public.teacher_assignments set status='ended',ends_on=current_date,updated_at=now() where staff_record_id=p_staff_record_id and school_id=p_school_id and status='active';
    update public.school_memberships set status='revoked',ended_at=now(),updated_at=now() where id=(select school_membership_id from public.staff_records where id=p_staff_record_id) and status in ('active','suspended');
  else
    update public.staff_records set employment_status=p_new_status,ended_on=null,updated_at=now() where id=p_staff_record_id and school_id=p_school_id;
  end if;
  perform private.write_school_audit(p_school_id,'staff',p_staff_record_id,'staff_status_changed','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('status',p_new_status,'reason',btrim(p_reason),'hired_on',v_hired_on));
end;
$$;
alter function public.update_staff_status(uuid,uuid,text,text) owner to postgres;
revoke all on function public.update_staff_status(uuid,uuid,text,text) from public,anon,service_role;
grant execute on function public.update_staff_status(uuid,uuid,text,text) to authenticated;

create function public.create_subject(p_school_id uuid,p_subject_code text,p_name text,p_category text default 'general')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'academics.manage');
  if length(btrim(coalesce(p_subject_code,'')))=0 or length(btrim(coalesce(p_name,'')))=0 then raise exception 'subject code and name required' using errcode='22023'; end if;
  insert into public.subjects(school_id,subject_code,name,subject_category) values(p_school_id,btrim(p_subject_code),btrim(p_name),p_category) returning id into v_id;
  perform private.write_school_audit(p_school_id,'subject',v_id,'subject_created','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('subject_code',p_subject_code));
  return v_id;
end;
$$;
alter function public.create_subject(uuid,text,text,text) owner to postgres;
revoke all on function public.create_subject(uuid,text,text,text) from public,anon,service_role;
grant execute on function public.create_subject(uuid,text,text,text) to authenticated;

create function public.assign_subject_to_class(p_school_id uuid,p_academic_year_id uuid,p_class_section_id uuid,p_subject_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'academics.manage');
  insert into public.class_subjects(school_id,academic_year_id,class_section_id,subject_id)
    values(p_school_id,p_academic_year_id,p_class_section_id,p_subject_id) returning id into v_id;
  perform private.write_school_audit(p_school_id,'class_subject',v_id,'subject_assigned_to_class','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('class_section_id',p_class_section_id,'subject_id',p_subject_id,'academic_year_id',p_academic_year_id));
  return v_id;
end;
$$;
alter function public.assign_subject_to_class(uuid,uuid,uuid,uuid) owner to postgres;
revoke all on function public.assign_subject_to_class(uuid,uuid,uuid,uuid) from public,anon,service_role;
grant execute on function public.assign_subject_to_class(uuid,uuid,uuid,uuid) to authenticated;

create function public.assign_teacher(p_school_id uuid,p_staff_record_id uuid,p_academic_year_id uuid,p_class_section_id uuid,p_assignment_kind text,p_subject_id uuid default null,p_starts_on date default current_date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'academics.manage');
  if not exists(select 1 from public.teacher_details td join public.staff_records sr on sr.id=td.staff_record_id and sr.school_id=td.school_id where td.staff_record_id=p_staff_record_id and td.school_id=p_school_id and sr.employment_status='active') then raise exception 'active teaching staff record required' using errcode='23503'; end if;
  if p_assignment_kind not in ('subject_teacher','class_teacher') or (p_assignment_kind='subject_teacher' and p_subject_id is null) or (p_assignment_kind='class_teacher' and p_subject_id is not null) then raise exception 'assignment kind and subject do not match' using errcode='22023'; end if;
  insert into public.teacher_assignments(school_id,academic_year_id,class_section_id,staff_record_id,subject_id,assignment_kind,starts_on,assigned_by_membership_id,assigned_by_person_id)
    values(p_school_id,p_academic_year_id,p_class_section_id,p_staff_record_id,p_subject_id,p_assignment_kind,p_starts_on,v_actor.membership_id,v_actor.person_id) returning id into v_id;
  perform private.write_school_audit(p_school_id,'teacher_assignment',v_id,'teacher_assigned','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('class_section_id',p_class_section_id,'subject_id',p_subject_id,'kind',p_assignment_kind));
  return v_id;
end;
$$;
alter function public.assign_teacher(uuid,uuid,uuid,uuid,text,uuid,date) owner to postgres;
revoke all on function public.assign_teacher(uuid,uuid,uuid,uuid,text,uuid,date) from public,anon,service_role;
grant execute on function public.assign_teacher(uuid,uuid,uuid,uuid,text,uuid,date) to authenticated;

create function public.end_teacher_assignment(p_school_id uuid,p_assignment_id uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'academics.manage');
  if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'assignment end reason required' using errcode='22023'; end if;
  update public.teacher_assignments set status='ended',ends_on=current_date,updated_at=now() where id=p_assignment_id and school_id=p_school_id and status='active';
  if not found then raise exception 'active assignment not found in school' using errcode='P0002'; end if;
  perform private.write_school_audit(p_school_id,'teacher_assignment',p_assignment_id,'teacher_assignment_ended','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('reason',btrim(p_reason)));
end;
$$;
alter function public.end_teacher_assignment(uuid,uuid,text) owner to postgres;
revoke all on function public.end_teacher_assignment(uuid,uuid,text) from public,anon,service_role;
grant execute on function public.end_teacher_assignment(uuid,uuid,text) to authenticated;

create function public.promote_student(p_school_id uuid,p_student_id uuid,p_from_year_id uuid,p_to_year_id uuid,p_target_class_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_current_enrollment uuid; v_placement uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'academics.manage');
  if p_from_year_id=p_to_year_id then raise exception 'promotion requires a different academic year' using errcode='22023'; end if;
  select id into v_current_enrollment from public.student_enrollments where school_id=p_school_id and student_id=p_student_id and academic_year_id=p_from_year_id and status='enrolled' for update;
  if v_current_enrollment is null then raise exception 'currently enrolled student was not found' using errcode='P0002'; end if;
  if not exists(select 1 from public.academic_years where id=p_to_year_id and school_id=p_school_id and status='active') then raise exception 'target academic year must be active in this school' using errcode='23503'; end if;
  update public.student_class_placements set status='ended',ends_on=current_date where enrollment_id=v_current_enrollment and status='active';
  update public.student_enrollments set status='completed',ended_at=now(),updated_at=now() where id=v_current_enrollment;
  v_placement:=public.place_student(p_school_id,p_student_id,p_to_year_id,p_target_class_id,current_date);
  perform private.write_school_audit(p_school_id,'student_enrollment',v_current_enrollment,'student_promoted','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('to_year_id',p_to_year_id,'new_placement_id',v_placement));
  return v_placement;
end;
$$;
alter function public.promote_student(uuid,uuid,uuid,uuid,uuid) owner to postgres;
revoke all on function public.promote_student(uuid,uuid,uuid,uuid,uuid) from public,anon,service_role;
grant execute on function public.promote_student(uuid,uuid,uuid,uuid,uuid) to authenticated;
