-- Fix admin_get_portal_request: class_enrollments doesn't exist
-- Correct path: student_enrollments -> student_class_placements -> class_sections
-- Also fixes the earlier ambiguous status column issue (included again for safety)

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

  UPDATE public.portal_requests pr
  SET status = 'reviewing', updated_at = now()
  WHERE pr.id = p_request_id
    AND pr.school_id = p_school_id
    AND pr.status = 'pending';

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
  LEFT JOIN public.student_enrollments se ON se.student_id = sr.id AND se.school_id = p_school_id AND se.status = 'active'
  LEFT JOIN public.student_class_placements scp ON scp.enrollment_id = se.id AND scp.status = 'active'
  LEFT JOIN public.class_sections cs ON cs.id = scp.class_section_id
  LEFT JOIN public.staff_records stf ON stf.id = r.assigned_to_staff_id
  LEFT JOIN private.person_private_identity ppi_st ON ppi_st.person_id = stf.person_id
  WHERE r.id = p_request_id AND r.school_id = p_school_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_portal_request(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_portal_request(uuid,uuid) TO authenticated;
