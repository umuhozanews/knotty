-- Fix portal admin RPCs: replace wrong school_members table with correct permission check

CREATE OR REPLACE FUNCTION public.admin_set_portal_pin(
  p_school_id  uuid,
  p_student_id uuid,
  p_pin        text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_hash text;
BEGIN
  IF length(btrim(p_pin)) < 4 THEN
    RAISE EXCEPTION 'PIN must be at least 4 characters' USING errcode = '22023';
  END IF;
  IF NOT private.has_school_permission(p_school_id, 'students.read') THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.student_records
    WHERE id = p_student_id AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'student not found' USING errcode = 'P0002';
  END IF;

  v_hash := encode(digest(p_pin || p_student_id::text, 'sha256'), 'hex');

  INSERT INTO public.portal_pins (student_id, school_id, pin_hash, must_change)
  VALUES (p_student_id, p_school_id, v_hash, true)
  ON CONFLICT (student_id)
  DO UPDATE SET pin_hash = EXCLUDED.pin_hash,
                must_change = true,
                updated_at  = now();
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_portal_pin(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_portal_pin(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_portal_requests(
  p_school_id uuid,
  p_status    text DEFAULT NULL,
  p_type      text DEFAULT NULL
) RETURNS TABLE (
  request_id              uuid,
  request_number          text,
  type                    text,
  category                text,
  subject                 text,
  priority                text,
  status                  text,
  student_name            text,
  student_admission       text,
  created_at              timestamptz,
  updated_at              timestamptz,
  appointment_requested_at timestamptz,
  appointment_confirmed_at timestamptz,
  unread_student_messages bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_school_permission(p_school_id, 'students.read') THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT r.id, r.request_number, r.type, r.category,
         r.subject, r.priority, r.status,
         COALESCE(ppi.legal_name, sr.admission_number) AS student_name,
         sr.admission_number,
         r.created_at, r.updated_at,
         r.appointment_requested_at, r.appointment_confirmed_at,
         (SELECT COUNT(*) FROM public.portal_request_messages m
          WHERE m.request_id = r.id AND m.sender_kind = 'student'
            AND m.created_at > r.updated_at - interval '1 second') AS unread_student_messages
  FROM public.portal_requests r
  JOIN public.student_records sr ON sr.id = r.submitted_by_student_id
  LEFT JOIN private.person_private_identity ppi ON ppi.person_id = sr.person_id
  WHERE r.school_id = p_school_id
    AND (p_status IS NULL OR r.status = p_status)
    AND (p_type IS NULL OR r.type = p_type)
  ORDER BY
    CASE r.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
    r.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_portal_requests(uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_portal_requests(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_portal_request(
  p_school_id  uuid,
  p_request_id uuid
) RETURNS TABLE (
  request_id              uuid,
  request_number          text,
  type                    text,
  category                text,
  subject                 text,
  body                    text,
  priority                text,
  status                  text,
  student_name            text,
  student_admission       text,
  student_class           text,
  created_at              timestamptz,
  updated_at              timestamptz,
  resolved_at             timestamptz,
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
  IF NOT private.has_school_permission(p_school_id, 'students.read') THEN
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
            jsonb_build_object('id',m.id,'sender_kind',m.sender_kind,'sender_name',m.sender_name,'body',m.body,'created_at',m.created_at)
            ORDER BY m.created_at)
          FROM public.portal_request_messages m WHERE m.request_id = r.id)
  FROM public.portal_requests r
  JOIN public.student_records sr ON sr.id = r.submitted_by_student_id
  LEFT JOIN private.person_private_identity ppi_s ON ppi_s.person_id = sr.person_id
  LEFT JOIN public.class_enrollments ce ON ce.student_id = sr.id AND ce.status = 'active'
  LEFT JOIN public.class_sections cs ON cs.id = ce.class_section_id
  LEFT JOIN public.staff_records stf ON stf.id = r.assigned_to_staff_id
  LEFT JOIN private.person_private_identity ppi_st ON ppi_st.person_id = stf.person_id
  WHERE r.id = p_request_id AND r.school_id = p_school_id
  LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_portal_request(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_portal_request(uuid,uuid) TO authenticated;

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
  IF NOT private.has_school_permission(p_school_id, 'students.read') THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;

  SELECT COALESCE(ppi.legal_name, 'Admin'),
         r.submitted_by_student_id, r.request_number
  INTO v_admin_name, v_student_id, v_req_number
  FROM public.portal_requests r
  JOIN public.school_memberships sm ON sm.school_id = p_school_id AND sm.status = 'active'
  JOIN public.persons p2 ON p2.id = sm.person_id AND p2.auth_user_id = auth.uid() AND p2.status = 'active'
  LEFT JOIN public.staff_records stf2 ON stf2.school_id = p_school_id AND stf2.person_id = sm.person_id
  LEFT JOIN private.person_private_identity ppi ON ppi.person_id = sm.person_id
  WHERE r.id = p_request_id AND r.school_id = p_school_id
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'request not found' USING errcode = 'P0002';
  END IF;

  UPDATE public.portal_requests
  SET status                  = p_status,
      assigned_to_staff_id    = COALESCE(p_assigned_to_staff_id, assigned_to_staff_id),
      appointment_confirmed_at = COALESCE(p_appointment_confirmed_at, appointment_confirmed_at),
      appointment_location    = COALESCE(p_appointment_location, appointment_location),
      resolved_at             = CASE WHEN p_status IN ('resolved','rejected') THEN now() ELSE resolved_at END,
      updated_at              = now()
  WHERE id = p_request_id AND school_id = p_school_id;

  IF p_message IS NOT NULL AND length(btrim(p_message)) > 0 THEN
    INSERT INTO public.portal_request_messages (request_id, sender_kind, sender_name, body)
    VALUES (p_request_id, 'admin', v_admin_name, btrim(p_message));

    INSERT INTO public.portal_notifications (school_id, student_id, request_id, type, title, body)
    VALUES (p_school_id, v_student_id, p_request_id, 'admin_responded',
            'Response on ' || v_req_number,
            v_admin_name || ' replied to your request.');
  END IF;

  IF p_appointment_confirmed_at IS NOT NULL THEN
    INSERT INTO public.portal_notifications (school_id, student_id, request_id, type, title, body)
    VALUES (p_school_id, v_student_id, p_request_id, 'appointment_confirmed',
            'Appointment Confirmed — ' || v_req_number,
            'Confirmed: ' || to_char(p_appointment_confirmed_at AT TIME ZONE 'UTC', 'DD Mon YYYY HH24:MI')
              || CASE WHEN p_appointment_location IS NOT NULL THEN '. Location: ' || p_appointment_location ELSE '' END);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_respond_portal_request(uuid,uuid,text,text,uuid,timestamptz,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_respond_portal_request(uuid,uuid,text,text,uuid,timestamptz,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_portal_stats(p_school_id uuid)
RETURNS TABLE (total bigint, pending bigint, reviewing bigint, in_progress bigint, resolved bigint, rejected bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_school_permission(p_school_id, 'students.read') THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;
  RETURN QUERY
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status='pending'), COUNT(*) FILTER (WHERE status='reviewing'),
         COUNT(*) FILTER (WHERE status='in_progress'), COUNT(*) FILTER (WHERE status='resolved'),
         COUNT(*) FILTER (WHERE status='rejected')
  FROM public.portal_requests WHERE school_id = p_school_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_portal_stats(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_portal_stats(uuid) TO authenticated;
