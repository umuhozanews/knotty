-- Fix: add ::text cast to 'sha256' literal in all digest() calls

CREATE OR REPLACE FUNCTION public.admin_set_portal_pin(
  p_school_id  uuid,
  p_student_id uuid,
  p_pin        text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_hash text;
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
  v_hash := encode(digest(convert_to(p_pin || p_student_id::text, 'UTF8'), 'sha256'::text), 'hex');
  INSERT INTO public.portal_pins (student_id, school_id, pin_hash, must_change)
  VALUES (p_student_id, p_school_id, v_hash, true)
  ON CONFLICT (student_id)
  DO UPDATE SET pin_hash = EXCLUDED.pin_hash, must_change = true, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_portal_pin(uuid,uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_portal_pin(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_login(
  p_school_code      text,
  p_admission_number text,
  p_pin              text
) RETURNS TABLE (
  session_token       uuid,
  student_id          uuid,
  school_id           uuid,
  legal_name          text,
  must_change_pin     boolean,
  profile_photo_path  text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_school_id    uuid;
  v_student_id   uuid;
  v_hash         text;
  v_stored_hash  text;
  v_must_change  boolean;
  v_session      uuid;
  v_name         text;
  v_photo        text;
BEGIN
  SELECT s.id INTO v_school_id
  FROM public.schools s
  WHERE lower(s.code) = lower(btrim(p_school_code))
  LIMIT 1;
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'school not found' USING errcode = 'P0002';
  END IF;

  SELECT sr.id,
         COALESCE(ppi.legal_name, sr.admission_number),
         sr.profile_photo_path
  INTO v_student_id, v_name, v_photo
  FROM public.student_records sr
  LEFT JOIN private.person_private_identity ppi ON ppi.person_id = sr.person_id
  WHERE sr.school_id = v_school_id
    AND lower(sr.admission_number) = lower(btrim(p_admission_number))
    AND sr.status = 'active'
  LIMIT 1;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'invalid credentials' USING errcode = '42501';
  END IF;

  SELECT pp.pin_hash, pp.must_change INTO v_stored_hash, v_must_change
  FROM public.portal_pins pp
  WHERE pp.student_id = v_student_id;
  IF v_stored_hash IS NULL THEN
    RAISE EXCEPTION 'portal access not set up — contact your school admin' USING errcode = '42501';
  END IF;

  v_hash := encode(digest(convert_to(p_pin || v_student_id::text, 'UTF8'), 'sha256'::text), 'hex');
  IF v_hash <> v_stored_hash THEN
    RAISE EXCEPTION 'invalid credentials' USING errcode = '42501';
  END IF;

  DELETE FROM public.portal_sessions
  WHERE student_id = v_student_id AND expires_at < now();

  INSERT INTO public.portal_sessions (student_id, school_id)
  VALUES (v_student_id, v_school_id)
  RETURNING id INTO v_session;

  RETURN QUERY SELECT v_session, v_student_id, v_school_id, v_name, v_must_change, v_photo;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_login(text,text,text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_login(text,text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_change_pin(
  p_token   uuid,
  p_new_pin text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_student_id uuid;
BEGIN
  SELECT s.student_id INTO v_student_id
  FROM public.portal_sessions s
  WHERE s.id = p_token AND s.expires_at > now();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'session expired or invalid' USING errcode = '42501';
  END IF;
  IF length(btrim(p_new_pin)) < 4 THEN
    RAISE EXCEPTION 'PIN must be at least 4 characters' USING errcode = '22023';
  END IF;
  UPDATE public.portal_pins
  SET pin_hash    = encode(digest(convert_to(p_new_pin || v_student_id::text, 'UTF8'), 'sha256'::text), 'hex'),
      must_change = false,
      updated_at  = now()
  WHERE student_id = v_student_id;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_change_pin(uuid,text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_change_pin(uuid,text) TO anon, authenticated;
