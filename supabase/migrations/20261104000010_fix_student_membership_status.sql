-- Students are provisioned directly by an admin (not via email invite),
-- so their school_membership should be 'active' immediately, not 'invited'.
-- The 'invited' status caused login to fail because auth checks status = 'active'.

-- 1. Fix existing students whose membership is still 'invited'
update public.school_memberships sm
set status = 'active', started_at = coalesce(started_at, now())
where status = 'invited'
  and exists (
    select 1 from public.student_records sr
    where sr.school_membership_id = sm.id
  );

-- 2. Replace register_student_from_edge with status = 'active'
create or replace function public.register_student_from_edge(
  p_actor_auth_user_id uuid, p_student_auth_user_id uuid, p_school_id uuid,
  p_admission_number text, p_legal_name text, p_date_of_birth date, p_gender text,
  p_nationality text, p_contact_type text, p_contact_value text, p_contact_normalized text,
  p_academic_year_id uuid, p_class_section_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor record; v_person_id uuid; v_membership_id uuid; v_student_id uuid;
  v_enrollment_id uuid; v_placement_id uuid;
begin
  if p_actor_auth_user_id is null or p_student_auth_user_id is null or p_actor_auth_user_id = p_student_auth_user_id
     or length(btrim(coalesce(p_admission_number, ''))) = 0 or length(btrim(coalesce(p_legal_name, ''))) = 0
     or p_contact_type is null or p_contact_type not in ('email', 'phone') or length(btrim(coalesce(p_contact_value, ''))) = 0
     or length(btrim(coalesce(p_contact_normalized, ''))) = 0 then
    raise exception 'valid caller, student account, admission number, legal name and contact required' using errcode = '22023';
  end if;
  if not exists(select 1 from auth.users u where u.id = p_student_auth_user_id) then raise exception 'student Auth user was not provisioned' using errcode = '23503'; end if;
  if not exists(select 1 from auth.users u where u.id = p_actor_auth_user_id) then raise exception 'actor Auth user not found' using errcode = '42501'; end if;
  select sm.id, sm.person_id into v_actor from public.school_memberships sm join public.persons p on p.id = sm.person_id
    where sm.school_id = p_school_id and sm.status = 'active' and p.status = 'active' and p.auth_user_id = p_actor_auth_user_id;
  if v_actor.id is null or not private.has_school_permission_for_user(p_actor_auth_user_id, p_school_id, 'students.create') then
    raise exception 'active school actor with students.create required' using errcode = '42501';
  end if;
  if exists(select 1 from public.persons where auth_user_id = p_student_auth_user_id) then raise exception 'Auth identity already linked to a person' using errcode = '23505'; end if;
  insert into public.persons(auth_user_id, status) values(p_student_auth_user_id, 'active') returning id into v_person_id;
  insert into private.person_private_identity(person_id, legal_name, date_of_birth, nationality)
    values(v_person_id, btrim(p_legal_name), p_date_of_birth, nullif(btrim(p_nationality), ''));
  insert into private.person_contact_points(person_id, contact_type, contact_value, normalized_value, is_primary)
    values(v_person_id, p_contact_type, btrim(p_contact_value), btrim(p_contact_normalized), true);
  -- Use 'active' so students can log in immediately after provisioning
  insert into public.school_memberships(school_id, person_id, status, started_at)
    values(p_school_id, v_person_id, 'active', now()) returning id into v_membership_id;
  insert into public.school_membership_roles(school_id, membership_id, person_id, role_key, assigned_by_membership_id, assigned_by_person_id, assigned_reason)
    values(p_school_id, v_membership_id, v_person_id, 'STUDENT', v_actor.id, v_actor.person_id, 'student account provisioned through authorized student registration');
  insert into public.student_records(school_id, person_id, auth_user_id, school_membership_id, admission_number, date_of_birth, gender, nationality, status, created_by_membership_id, created_by_person_id)
    values(p_school_id, v_person_id, p_student_auth_user_id, v_membership_id, btrim(p_admission_number), p_date_of_birth, nullif(btrim(p_gender), ''), nullif(btrim(p_nationality), ''), 'pending', v_actor.id, v_actor.person_id)
    returning id into v_student_id;
  if (p_academic_year_id is null) <> (p_class_section_id is null) then raise exception 'academic year and class must be supplied together' using errcode = '22023'; end if;
  if p_academic_year_id is not null then
    if not exists(select 1 from public.academic_years where id = p_academic_year_id and school_id = p_school_id and status = 'active')
       or not exists(select 1 from public.class_sections where id = p_class_section_id and school_id = p_school_id and academic_year_id = p_academic_year_id and status = 'active') then
      raise exception 'active year and matching class required' using errcode = '23503';
    end if;
    insert into public.student_enrollments(school_id, student_id, academic_year_id, status, created_by_membership_id, created_by_person_id)
      values(p_school_id, v_student_id, p_academic_year_id, 'enrolled', v_actor.id, v_actor.person_id) returning id into v_enrollment_id;
    insert into public.student_class_placements(school_id, academic_year_id, enrollment_id, class_section_id, assigned_by_membership_id, assigned_by_person_id)
      values(p_school_id, p_academic_year_id, v_enrollment_id, p_class_section_id, v_actor.id, v_actor.person_id) returning id into v_placement_id;
    perform private.write_school_audit(p_school_id, 'student_enrollment', v_enrollment_id, 'student_enrolled', 'school', v_actor.person_id, null, null, null, v_actor.id, jsonb_build_object('student_id', v_student_id, 'placement_id', v_placement_id));
  end if;
  perform private.write_school_audit(p_school_id, 'student', v_student_id, 'student_registered', 'school', v_actor.person_id, null, null, null, v_actor.id, jsonb_build_object('admission_number', btrim(p_admission_number)));
  return v_student_id;
end;
$$;
