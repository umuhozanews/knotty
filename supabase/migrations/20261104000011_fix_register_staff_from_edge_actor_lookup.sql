-- Fix register_staff_from_edge so it can be called by the service-role provisioning
-- endpoint. The original function called require_school_actor() which uses auth.uid(),
-- but auth.uid() is NULL when called from service role. Replace with an explicit
-- p_actor_auth_user_id lookup, matching the pattern used by register_student_from_edge.

CREATE OR REPLACE FUNCTION public.register_staff_from_edge(
  p_actor_auth_user_id   uuid,
  p_staff_auth_user_id   uuid,
  p_school_id            uuid,
  p_legal_name           text,
  p_email                text,
  p_role_key             text,
  p_employee_number      text,
  p_job_title            text,
  p_hired_on             date    DEFAULT current_date,
  p_department           text    DEFAULT NULL,
  p_qualification        text    DEFAULT NULL,
  p_specialization       text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_actor          record;
  v_person_id      uuid;
  v_membership_id  uuid;
  v_staff_id       uuid;
  v_categories     text[];
  v_assign_reason  text := 'staff account provisioned via admin portal';
BEGIN
  -- Validate required inputs
  IF length(btrim(coalesce(p_legal_name, ''))) = 0 OR
     length(btrim(coalesce(p_employee_number, ''))) = 0 OR
     length(btrim(coalesce(p_job_title, ''))) = 0 THEN
    RAISE EXCEPTION 'legal_name, employee_number and job_title are required' USING ERRCODE = '22023';
  END IF;

  -- Verify actor explicitly using p_actor_auth_user_id (supports service-role callers
  -- where auth.uid() is NULL — same pattern as register_student_from_edge).
  SELECT sm.id, sm.person_id INTO v_actor
  FROM public.school_memberships sm
  JOIN public.persons p ON p.id = sm.person_id
  WHERE sm.school_id  = p_school_id
    AND sm.status     = 'active'
    AND p.status      = 'active'
    AND p.auth_user_id = p_actor_auth_user_id;

  IF NOT FOUND OR
     NOT private.has_school_permission_for_user(p_actor_auth_user_id, p_school_id, 'staff.manage') THEN
    RAISE EXCEPTION 'active school actor with staff.manage permission required in school %',
      p_school_id USING ERRCODE = '42501';
  END IF;

  -- Determine staff categories from role
  v_categories := CASE
    WHEN p_role_key = 'TEACHER' THEN ARRAY['teaching']
    ELSE ARRAY['non_teaching']
  END;

  -- Create person record linked to auth user
  INSERT INTO public.persons (auth_user_id, status)
  VALUES (p_staff_auth_user_id, 'active')
  RETURNING id INTO v_person_id;

  -- Store legal name
  INSERT INTO private.person_private_identity (person_id, legal_name)
  VALUES (v_person_id, btrim(p_legal_name));

  -- Store contact email
  INSERT INTO private.person_contact_points (person_id, contact_type, contact_value, normalized_value, is_primary)
  VALUES (v_person_id, 'email', btrim(p_email), lower(btrim(p_email)), true)
  ON CONFLICT DO NOTHING;

  -- Create school membership (active immediately — staff can log in right away)
  INSERT INTO public.school_memberships (school_id, person_id, status, started_at)
  VALUES (p_school_id, v_person_id, 'active', now())
  RETURNING id INTO v_membership_id;

  -- Assign role
  INSERT INTO public.school_membership_roles (
    school_id, membership_id, person_id, role_key,
    assigned_by_membership_id, assigned_by_person_id, assigned_reason
  )
  VALUES (
    p_school_id, v_membership_id, v_person_id, p_role_key,
    v_actor.id, v_actor.person_id, v_assign_reason
  );

  -- Create staff record
  INSERT INTO public.staff_records (
    school_id, person_id, school_membership_id,
    employee_number, job_title, department, employment_status,
    hired_on, created_by_membership_id, created_by_person_id
  )
  VALUES (
    p_school_id, v_person_id, v_membership_id,
    btrim(p_employee_number), btrim(p_job_title),
    nullif(btrim(coalesce(p_department, '')), ''), 'active',
    p_hired_on, v_actor.id, v_actor.person_id
  )
  RETURNING id INTO v_staff_id;

  -- Staff categories
  INSERT INTO public.staff_record_categories (
    school_id, staff_record_id, category_key,
    assigned_by_membership_id, assigned_by_person_id
  )
  SELECT p_school_id, v_staff_id, c, v_actor.id, v_actor.person_id
  FROM unnest(v_categories) AS c;

  -- Teacher details if applicable
  IF p_role_key = 'TEACHER' THEN
    INSERT INTO public.teacher_details (
      staff_record_id, school_id, qualification, specialization, hired_to_teach_on
    )
    VALUES (
      v_staff_id, p_school_id,
      nullif(btrim(coalesce(p_qualification, '')), ''),
      nullif(btrim(coalesce(p_specialization, '')), ''),
      p_hired_on
    );
  END IF;

  RETURN v_staff_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_staff_from_edge(uuid,uuid,uuid,text,text,text,text,text,date,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_staff_from_edge(uuid,uuid,uuid,text,text,text,text,text,date,text,text,text) TO service_role;
