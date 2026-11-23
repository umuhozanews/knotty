-- ============================================================
-- Portal Auth Security Fixes
-- 1. Rate limiting on login attempts (5 tries / 15 min)
-- 2. Consolidate PIN hashing to bcrypt; migrate sha256 on-the-fly
-- 3. admin_set_portal_email: add auth check + REVOKE/GRANT
-- 4. admin_set_portal_pin: permission students.read → students.update
-- 5. Add portal_logout RPC
-- 6. portal_login_email: fix search_path, remove dead code
-- ============================================================

-- ── 1. Rate limiting ─────────────────────────────────────────

CREATE TABLE public.portal_login_attempts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid,
  lookup_key   text        NOT NULL,
  succeeded    boolean     NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portal_login_attempts_lookup_idx
  ON public.portal_login_attempts (lookup_key, attempted_at DESC)
  WHERE NOT succeeded;

ALTER TABLE public.portal_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_login_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY portal_login_attempts_deny
  ON public.portal_login_attempts AS RESTRICTIVE USING (false);

-- Returns false when rate limit exceeded (5 failures in 15 min window)
CREATE OR REPLACE FUNCTION private.portal_check_rate_limit(p_lookup_key text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.portal_login_attempts
  WHERE lookup_key = lower(btrim(p_lookup_key))
    AND attempted_at > now() - interval '15 minutes'
    AND NOT succeeded;
  RETURN v_count < 5;
END;
$$;
REVOKE ALL ON FUNCTION private.portal_check_rate_limit(text)
  FROM public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.portal_record_attempt(
  p_lookup_key text,
  p_school_id  uuid,
  p_succeeded  boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.portal_login_attempts (school_id, lookup_key, succeeded)
  VALUES (p_school_id, lower(btrim(p_lookup_key)), p_succeeded);
  -- Probabilistic cleanup: 1% chance to purge attempts older than 24 h
  IF random() < 0.01 THEN
    DELETE FROM public.portal_login_attempts
    WHERE attempted_at < now() - interval '24 hours';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.portal_record_attempt(text, uuid, boolean)
  FROM public, anon, authenticated, service_role;

-- ── 2. portal_login: rate limiting + seamless sha256 → bcrypt migration ──

CREATE OR REPLACE FUNCTION public.portal_login(
  p_school_code      text,
  p_admission_number text,
  p_pin              text
) RETURNS TABLE (
  session_token      uuid,
  student_id         uuid,
  school_id          uuid,
  legal_name         text,
  must_change_pin    boolean,
  profile_photo_path text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
DECLARE
  v_school_id   uuid;
  v_student_id  uuid;
  v_stored_hash text;
  v_must_change boolean;
  v_session     uuid;
  v_name        text;
  v_photo       text;
  v_lookup_key  text;
BEGIN
  v_lookup_key := lower(btrim(p_school_code)) || ':' || lower(btrim(p_admission_number));

  IF NOT private.portal_check_rate_limit(v_lookup_key) THEN
    RAISE EXCEPTION 'Too many failed attempts — try again in 15 minutes'
      USING errcode = '53400';
  END IF;

  SELECT s.id INTO v_school_id
  FROM public.schools s
  WHERE lower(s.code) = lower(btrim(p_school_code))
  LIMIT 1;
  IF v_school_id IS NULL THEN
    PERFORM private.portal_record_attempt(v_lookup_key, null, false);
    RAISE EXCEPTION 'invalid credentials' USING errcode = '42501';
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
    PERFORM private.portal_record_attempt(v_lookup_key, v_school_id, false);
    RAISE EXCEPTION 'invalid credentials' USING errcode = '42501';
  END IF;

  SELECT pp.pin_hash, pp.must_change INTO v_stored_hash, v_must_change
  FROM public.portal_pins pp
  WHERE pp.student_id = v_student_id;
  IF v_stored_hash IS NULL THEN
    RAISE EXCEPTION 'portal access not set up — contact your school admin'
      USING errcode = '42501';
  END IF;

  -- Verify: support legacy sha256 (hex, 64 chars) and current bcrypt ($2...)
  IF v_stored_hash LIKE '$2%' THEN
    IF v_stored_hash <> crypt(p_pin, v_stored_hash) THEN
      PERFORM private.portal_record_attempt(v_lookup_key, v_school_id, false);
      RAISE EXCEPTION 'invalid credentials' USING errcode = '42501';
    END IF;
  ELSE
    -- Legacy sha256 path: verify then immediately re-hash to bcrypt
    IF encode(pg_catalog.sha256(convert_to(p_pin || v_student_id::text, 'UTF8')), 'hex')
       <> v_stored_hash THEN
      PERFORM private.portal_record_attempt(v_lookup_key, v_school_id, false);
      RAISE EXCEPTION 'invalid credentials' USING errcode = '42501';
    END IF;
    UPDATE public.portal_pins
    SET pin_hash = crypt(p_pin, gen_salt('bf')), updated_at = now()
    WHERE student_id = v_student_id;
  END IF;

  PERFORM private.portal_record_attempt(v_lookup_key, v_school_id, true);

  DELETE FROM public.portal_sessions
  WHERE student_id = v_student_id AND expires_at < now();

  INSERT INTO public.portal_sessions (student_id, school_id)
  VALUES (v_student_id, v_school_id)
  RETURNING portal_sessions.id INTO v_session;

  RETURN QUERY
    SELECT v_session, v_student_id, v_school_id, v_name, v_must_change, v_photo;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_login(text, text, text)
  FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_login(text, text, text)
  TO anon, authenticated;

-- ── 3. portal_login_email: fix search_path, remove dead code, add rate limit ──

CREATE OR REPLACE FUNCTION public.portal_login_email(
  p_email    text,
  p_password text
) RETURNS TABLE (
  session_token      uuid,
  student_id         uuid,
  school_id          uuid,
  legal_name         text,
  must_change_pin    boolean,
  profile_photo_path text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
DECLARE
  v_student_id  uuid;
  v_school_id   uuid;
  v_pin_hash    text;
  v_must_change boolean;
  v_legal_name  text;
  v_photo_path  text;
  v_session_id  uuid;
  v_lookup_key  text;
BEGIN
  v_lookup_key := lower(btrim(p_email));

  IF NOT private.portal_check_rate_limit(v_lookup_key) THEN
    RAISE EXCEPTION 'Too many failed attempts — try again in 15 minutes'
      USING errcode = '53400';
  END IF;

  SELECT pp.student_id, pp.school_id, pp.pin_hash, pp.must_change
  INTO   v_student_id, v_school_id, v_pin_hash, v_must_change
  FROM   public.portal_pins pp
  WHERE  pp.portal_email = lower(btrim(p_email));

  IF v_student_id IS NULL OR v_pin_hash IS NULL
     OR v_pin_hash <> crypt(p_password, v_pin_hash) THEN
    PERFORM private.portal_record_attempt(v_lookup_key, v_school_id, false);
    RAISE EXCEPTION 'Invalid email or password' USING errcode = '42501';
  END IF;

  SELECT COALESCE(ppi.legal_name, sr.admission_number), sr.profile_photo_path
  INTO   v_legal_name, v_photo_path
  FROM   public.student_records sr
  LEFT JOIN private.person_private_identity ppi ON ppi.person_id = sr.person_id
  WHERE  sr.id = v_student_id;

  PERFORM private.portal_record_attempt(v_lookup_key, v_school_id, true);

  DELETE FROM public.portal_sessions
  WHERE student_id = v_student_id AND expires_at < now();

  INSERT INTO public.portal_sessions (student_id, school_id)
  VALUES (v_student_id, v_school_id)
  RETURNING portal_sessions.id INTO v_session_id;

  RETURN QUERY
    SELECT v_session_id, v_student_id, v_school_id,
           COALESCE(v_legal_name, 'Student'),
           COALESCE(v_must_change, false),
           v_photo_path;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_login_email(text, text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_login_email(text, text)
  TO anon, authenticated;

-- ── 4. admin_set_portal_pin: permission students.read → students.update, bcrypt ──

CREATE OR REPLACE FUNCTION public.admin_set_portal_pin(
  p_school_id  uuid,
  p_student_id uuid,
  p_pin        text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
BEGIN
  IF length(btrim(p_pin)) < 4 THEN
    RAISE EXCEPTION 'PIN must be at least 4 characters' USING errcode = '22023';
  END IF;
  IF NOT private.has_school_permission(p_school_id, 'students.update') THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.student_records
    WHERE id = p_student_id AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'student not found' USING errcode = 'P0002';
  END IF;
  INSERT INTO public.portal_pins (student_id, school_id, pin_hash, must_change)
  VALUES (p_student_id, p_school_id, crypt(p_pin, gen_salt('bf')), true)
  ON CONFLICT (student_id) DO UPDATE
    SET pin_hash    = crypt(p_pin, gen_salt('bf')),
        must_change = true,
        updated_at  = now();
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_portal_pin(uuid, uuid, text)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_portal_pin(uuid, uuid, text)
  TO authenticated;

-- ── 5. admin_set_portal_email: add auth check + REVOKE/GRANT ─────────────

CREATE OR REPLACE FUNCTION public.admin_set_portal_email(
  p_school_id    uuid,
  p_student_id   uuid,
  p_portal_email text,
  p_password     text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
BEGIN
  IF NOT private.has_school_permission(p_school_id, 'students.update') THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;
  IF length(btrim(coalesce(p_portal_email, ''))) = 0 THEN
    RAISE EXCEPTION 'portal email required' USING errcode = '22023';
  END IF;
  IF length(btrim(coalesce(p_password, ''))) < 6 THEN
    RAISE EXCEPTION 'password must be at least 6 characters' USING errcode = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.student_records
    WHERE id = p_student_id AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'student not found' USING errcode = 'P0002';
  END IF;
  INSERT INTO public.portal_pins (student_id, school_id, portal_email, pin_hash, must_change)
  VALUES (
    p_student_id, p_school_id,
    lower(btrim(p_portal_email)),
    crypt(p_password, gen_salt('bf')),
    false
  )
  ON CONFLICT (student_id) DO UPDATE SET
    portal_email = lower(btrim(p_portal_email)),
    pin_hash     = crypt(p_password, gen_salt('bf')),
    must_change  = false,
    updated_at   = now();
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_portal_email(uuid, uuid, text, text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_portal_email(uuid, uuid, text, text)
  TO authenticated;

-- ── 6. portal_change_pin: use bcrypt ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.portal_change_pin(
  p_token   uuid,
  p_new_pin text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
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
  SET pin_hash    = crypt(p_new_pin, gen_salt('bf')),
      must_change = false,
      updated_at  = now()
  WHERE student_id = v_student_id;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_change_pin(uuid, text)
  FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_change_pin(uuid, text)
  TO anon, authenticated;

-- ── 7. portal_logout ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.portal_logout(p_token uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.portal_sessions WHERE id = p_token;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_logout(uuid)
  FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_logout(uuid)
  TO anon, authenticated;
