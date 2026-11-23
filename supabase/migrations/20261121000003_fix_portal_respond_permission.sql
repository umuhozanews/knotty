-- Fix portal admin write RPCs: change permission from students.read (read-only
-- semantic) to notifications.manage (write-appropriate) for RPCs that mutate
-- portal request state. Grant notifications.manage to the domain roles that
-- handle portal requests in a school setting.

INSERT INTO private.role_permissions (scope, role_key, permission_key)
VALUES
  ('school', 'TEACHER',    'notifications.manage'),
  ('school', 'BURSAR',     'notifications.manage'),
  ('school', 'NURSE',      'notifications.manage'),
  ('school', 'DISCIPLINE', 'notifications.manage'),
  ('school', 'LIBRARIAN',  'notifications.manage')
ON CONFLICT DO NOTHING;

-- admin_get_portal_request auto-transitions status to 'reviewing' on open —
-- that is a state mutation, so it requires notifications.manage.
CREATE OR REPLACE FUNCTION public.admin_get_portal_request(
  p_school_id  uuid,
  p_request_id uuid
) RETURNS TABLE (
  request_id               uuid,
  request_number           text,
  type                     text,
  category                 text,
  subject                  text,
  body                     text,
  priority                 text,
  status                   text,
  student_name             text,
  student_admission        text,
  student_class            text,
  created_at               timestamptz,
  updated_at               timestamptz,
  resolved_at              timestamptz,
  appointment_requested_at timestamptz,
  appointment_confirmed_at timestamptz,
  appointment_location     text,
  assigned_staff_name      text,
  assigned_to_staff_id     uuid,
  messages                 jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_school_permission(p_school_id, 'notifications.manage') THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;

  UPDATE public.portal_requests
  SET status = 'reviewing', updated_at = now()
  WHERE id = p_request_id AND school_id = p_school_id AND status = 'pending';

  RETURN QUERY
  SELECT r.id, r.request_number, r.type, r.category,
         r.subject, r.body, r.priority, r.status,
         COALESCE(ppi_s.legal_name, sr.admission_number),
         sr.admission_number,
         COALESCE(cs.name, ''),
         r.created_at, r.updated_at, r.resolved_at,
         r.appointment_requested_at, r.appointment_confirmed_at,
         r.appointment_location,
         COALESCE(ppi_st.legal_name, ''),
         r.assigned_to_staff_id,
         (SELECT jsonb_agg(
            jsonb_build_object(
              'id', m.id, 'sender_kind', m.sender_kind,
              'sender_name', m.sender_name, 'body', m.body,
              'created_at', m.created_at
            ) ORDER BY m.created_at)
          FROM public.portal_request_messages m WHERE m.request_id = r.id)
  FROM public.portal_requests r
  JOIN public.student_records sr ON sr.id = r.submitted_by_student_id
  LEFT JOIN private.person_private_identity ppi_s ON ppi_s.person_id = sr.person_id
  LEFT JOIN public.student_enrollments se
         ON se.school_id = sr.school_id AND se.student_id = sr.id AND se.status = 'enrolled'
  LEFT JOIN public.student_class_placements scp
         ON scp.school_id = se.school_id AND scp.enrollment_id = se.id AND scp.status = 'active'
  LEFT JOIN public.class_sections cs ON cs.id = scp.class_section_id
  LEFT JOIN public.staff_records stf ON stf.id = r.assigned_to_staff_id
  LEFT JOIN private.person_private_identity ppi_st ON ppi_st.person_id = stf.person_id
  WHERE r.id = p_request_id AND r.school_id = p_school_id
  LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_portal_request(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_portal_request(uuid, uuid) TO authenticated;

-- admin_respond_portal_request changes request status and writes messages —
-- requires notifications.manage.
CREATE OR REPLACE FUNCTION public.admin_respond_portal_request(
  p_school_id               uuid,
  p_request_id              uuid,
  p_status                  text,
  p_message                 text DEFAULT NULL,
  p_assigned_to_staff_id    uuid DEFAULT NULL,
  p_appointment_confirmed_at timestamptz DEFAULT NULL,
  p_appointment_location    text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_admin_name text;
  v_student_id uuid;
  v_req_number text;
BEGIN
  IF NOT private.has_school_permission(p_school_id, 'notifications.manage') THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;

  SELECT COALESCE(ppi.legal_name, 'Admin'),
         r.submitted_by_student_id,
         r.request_number
  INTO v_admin_name, v_student_id, v_req_number
  FROM public.portal_requests r
  JOIN public.school_memberships sm
       ON sm.school_id = p_school_id AND sm.status = 'active'
  JOIN public.persons p2
       ON p2.id = sm.person_id AND p2.auth_user_id = auth.uid() AND p2.status = 'active'
  LEFT JOIN public.staff_records stf2
       ON stf2.school_id = p_school_id AND stf2.person_id = sm.person_id
  LEFT JOIN private.person_private_identity ppi ON ppi.person_id = sm.person_id
  WHERE r.id = p_request_id AND r.school_id = p_school_id
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'request not found' USING errcode = 'P0002';
  END IF;

  UPDATE public.portal_requests
  SET status                   = p_status,
      assigned_to_staff_id     = COALESCE(p_assigned_to_staff_id, assigned_to_staff_id),
      appointment_confirmed_at = COALESCE(p_appointment_confirmed_at, appointment_confirmed_at),
      appointment_location     = COALESCE(p_appointment_location, appointment_location),
      resolved_at              = CASE WHEN p_status IN ('resolved', 'rejected') THEN now()
                                      ELSE resolved_at END,
      updated_at               = now()
  WHERE id = p_request_id AND school_id = p_school_id;

  IF p_message IS NOT NULL AND length(btrim(p_message)) > 0 THEN
    INSERT INTO public.portal_request_messages (request_id, sender_kind, sender_name, body)
    VALUES (p_request_id, 'admin', v_admin_name, btrim(p_message));

    INSERT INTO public.portal_notifications
      (school_id, student_id, request_id, type, title, body)
    VALUES (p_school_id, v_student_id, p_request_id, 'admin_responded',
            'Response on ' || v_req_number,
            v_admin_name || ' replied to your request.');
  END IF;

  IF p_appointment_confirmed_at IS NOT NULL THEN
    INSERT INTO public.portal_notifications
      (school_id, student_id, request_id, type, title, body)
    VALUES (p_school_id, v_student_id, p_request_id, 'appointment_confirmed',
            'Appointment Confirmed — ' || v_req_number,
            'Confirmed: ' || to_char(
              p_appointment_confirmed_at AT TIME ZONE 'UTC', 'DD Mon YYYY HH24:MI')
              || CASE WHEN p_appointment_location IS NOT NULL
                      THEN '. Location: ' || p_appointment_location
                      ELSE '' END);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_respond_portal_request(uuid, uuid, text, text, uuid, timestamptz, text)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_respond_portal_request(uuid, uuid, text, text, uuid, timestamptz, text)
  TO authenticated;
