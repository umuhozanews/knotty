-- =============================================================================
-- Fix: replace v_actor.auth_user_id with auth.uid() in health & discipline RPCs
-- (require_school_actor returns person/membership record, not auth_user_id)
-- Also: add search param to list_school_health_records + visit_count
-- =============================================================================

-- ── 1. Fix create_health_record ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_health_record(
  p_school_id          uuid,
  p_student_id         uuid,
  p_type               text,
  p_title              text,
  p_description        text    DEFAULT NULL,
  p_treatment_given    text    DEFAULT NULL,
  p_severity           text    DEFAULT 'LOW',
  p_follow_up_required boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Permission check (re-use existing helper)
  IF NOT private.has_school_permission(p_school_id, 'health.manage') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  IF length(btrim(coalesce(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'title is required' USING ERRCODE = '22023';
  END IF;
  IF p_type NOT IN ('ILLNESS','INJURY','MEDICATION','CHECKUP','ALLERGY') THEN
    RAISE EXCEPTION 'invalid type' USING ERRCODE = '22023';
  END IF;
  IF p_severity NOT IN ('LOW','MEDIUM','HIGH') THEN
    RAISE EXCEPTION 'invalid severity' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.student_records
     WHERE id = p_student_id AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'student not found in school' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.health_records (
    school_id, student_id, recorded_by,
    type, title, description, treatment_given, severity, follow_up_required
  ) VALUES (
    p_school_id, p_student_id, auth.uid(),   -- ← fixed: was v_actor.auth_user_id
    p_type, btrim(p_title), p_description, p_treatment_given,
    p_severity, coalesce(p_follow_up_required, false)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_health_record(uuid,uuid,text,text,text,text,text,boolean) TO authenticated;

-- ── 2. Fix create_clinic_visit ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_clinic_visit(
  p_school_id            uuid,
  p_student_id           uuid,
  p_presenting_complaint text,
  p_treatment_notes      text    DEFAULT NULL,
  p_follow_up_required   boolean DEFAULT false,
  p_medications          jsonb   DEFAULT '[]'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_visit_id uuid;
  v_med      jsonb;
BEGIN
  IF NOT private.has_school_permission(p_school_id, 'health.manage') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  IF length(btrim(coalesce(p_presenting_complaint, ''))) = 0 THEN
    RAISE EXCEPTION 'presenting_complaint is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.student_records
     WHERE id = p_student_id AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'student not found in school' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.clinic_visits (
    school_id, student_id, recorded_by,
    presenting_complaint, treatment_notes, follow_up_required
  ) VALUES (
    p_school_id, p_student_id, auth.uid(),   -- ← fixed
    btrim(p_presenting_complaint), p_treatment_notes,
    coalesce(p_follow_up_required, false)
  )
  RETURNING id INTO v_visit_id;

  FOR v_med IN SELECT * FROM jsonb_array_elements(coalesce(p_medications, '[]'::jsonb))
  LOOP
    IF length(btrim(coalesce(v_med->>'medication_name', ''))) > 0 THEN
      INSERT INTO public.medication_administrations (
        school_id, clinic_visit_id, student_id, medication_name, dosage
      ) VALUES (
        p_school_id, v_visit_id, p_student_id,
        btrim(v_med->>'medication_name'),
        coalesce(btrim(v_med->>'dosage'), '')
      );
    END IF;
  END LOOP;

  RETURN v_visit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_clinic_visit(uuid,uuid,text,text,boolean,jsonb) TO authenticated;

-- ── 3. Fix create_discipline_record ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_discipline_record(
  p_school_id      uuid,
  p_student_id     uuid,
  p_type           text,
  p_title          text,
  p_description    text DEFAULT NULL,
  p_action_taken   text DEFAULT NULL,
  p_severity       text DEFAULT 'MINOR',
  p_marks_deducted int  DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT private.has_school_permission(p_school_id, 'discipline.manage') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  IF length(btrim(coalesce(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'title is required' USING ERRCODE = '22023';
  END IF;
  IF p_type NOT IN ('WARNING','SUSPENSION','MISCONDUCT','RULE_VIOLATION','OTHER') THEN
    RAISE EXCEPTION 'invalid type' USING ERRCODE = '22023';
  END IF;
  IF p_severity NOT IN ('MINOR','MODERATE','SERIOUS') THEN
    RAISE EXCEPTION 'invalid severity' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.student_records
     WHERE id = p_student_id AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'student not found in school' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.discipline_records (
    school_id, student_id, recorded_by,
    type, title, description, action_taken, severity, marks_deducted
  ) VALUES (
    p_school_id, p_student_id, auth.uid(),   -- ← fixed
    p_type, btrim(p_title), p_description, p_action_taken, p_severity,
    coalesce(p_marks_deducted, 0)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_discipline_record(uuid,uuid,text,text,text,text,text,int) TO authenticated;

-- ── 4. Update list_school_health_records with search + visit_count ────────────
CREATE OR REPLACE FUNCTION public.list_school_health_records(
  p_school_id uuid,
  p_search    text DEFAULT NULL,
  p_limit     int  DEFAULT 50
)
RETURNS TABLE(
  record_id          uuid,
  type               text,
  title              text,
  description        text,
  treatment_given    text,
  severity           text,
  follow_up_required boolean,
  resolved_at        timestamptz,
  recorded_at        timestamptz,
  student_id         uuid,
  student_name       text,
  student_code       text,
  recorder_name      text,
  student_visit_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    h.id                                         AS record_id,
    h.type,
    h.title,
    h.description,
    h.treatment_given,
    h.severity,
    h.follow_up_required,
    h.resolved_at,
    h.recorded_at,
    sr.id                                        AS student_id,
    coalesce(pi.legal_name, sr.admission_number) AS student_name,
    sr.admission_number                          AS student_code,
    coalesce(rpi.legal_name, '')                 AS recorder_name,
    (
      SELECT COUNT(*) FROM public.health_records hc
       WHERE hc.school_id = p_school_id AND hc.student_id = sr.id
    )                                            AS student_visit_count
  FROM public.health_records h
  JOIN public.student_records              sr  ON sr.id = h.student_id AND sr.school_id = h.school_id
  JOIN public.persons                      p   ON p.id  = sr.person_id
  LEFT JOIN private.person_private_identity pi  ON pi.person_id = p.id
  LEFT JOIN public.persons                 rp  ON rp.auth_user_id = h.recorded_by
  LEFT JOIN private.person_private_identity rpi ON rpi.person_id  = rp.id
  WHERE h.school_id = p_school_id
    AND private.has_school_permission(p_school_id, 'health.read_sensitive')
    AND (
      p_search IS NULL OR length(trim(p_search)) = 0
      OR h.title ILIKE '%' || trim(p_search) || '%'
      OR coalesce(pi.legal_name, '') ILIKE '%' || trim(p_search) || '%'
      OR sr.admission_number ILIKE '%' || trim(p_search) || '%'
    )
  ORDER BY h.recorded_at DESC
  LIMIT least(p_limit, 500);
$$;

GRANT EXECUTE ON FUNCTION public.list_school_health_records(uuid, text, int) TO authenticated;

-- ── 5. Update list_school_discipline with student_visit_count ─────────────────
CREATE OR REPLACE FUNCTION public.list_school_discipline(
  p_school_id uuid,
  p_search    text DEFAULT NULL,
  p_limit     int  DEFAULT 50
)
RETURNS TABLE(
  record_id       uuid,
  type            text,
  title           text,
  description     text,
  action_taken    text,
  severity        text,
  status          text,
  marks_deducted  int,
  parent_notified boolean,
  recorded_at     timestamptz,
  student_id      uuid,
  student_name    text,
  student_code    text,
  recorder_name   text,
  student_visit_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    d.id                                         AS record_id,
    d.type,
    d.title,
    d.description,
    d.action_taken,
    d.severity,
    d.status,
    d.marks_deducted,
    d.parent_notified,
    d.recorded_at,
    sr.id                                        AS student_id,
    coalesce(pi.legal_name, sr.admission_number) AS student_name,
    sr.admission_number                          AS student_code,
    coalesce(rpi.legal_name, '')                 AS recorder_name,
    (
      SELECT COUNT(*) FROM public.discipline_records dc
       WHERE dc.school_id = p_school_id AND dc.student_id = sr.id
    )                                            AS student_visit_count
  FROM public.discipline_records d
  JOIN public.student_records              sr  ON sr.id = d.student_id AND sr.school_id = d.school_id
  JOIN public.persons                      p   ON p.id  = sr.person_id
  LEFT JOIN private.person_private_identity pi  ON pi.person_id = p.id
  LEFT JOIN public.persons                 rp  ON rp.auth_user_id = d.recorded_by
  LEFT JOIN private.person_private_identity rpi ON rpi.person_id  = rp.id
  WHERE d.school_id = p_school_id
    AND private.has_school_permission(p_school_id, 'discipline.read')
    AND (
      p_search IS NULL OR length(trim(p_search)) = 0
      OR d.title ILIKE '%' || trim(p_search) || '%'
      OR coalesce(pi.legal_name, '') ILIKE '%' || trim(p_search) || '%'
      OR sr.admission_number ILIKE '%' || trim(p_search) || '%'
    )
  ORDER BY d.recorded_at DESC
  LIMIT least(p_limit, 500);
$$;

GRANT EXECUTE ON FUNCTION public.list_school_discipline(uuid, text, int) TO authenticated;
