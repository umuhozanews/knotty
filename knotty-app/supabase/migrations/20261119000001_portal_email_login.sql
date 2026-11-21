-- Add portal_email to portal_pins so students log in with email+password
ALTER TABLE portal_pins
  ADD COLUMN IF NOT EXISTS portal_email text;

CREATE UNIQUE INDEX IF NOT EXISTS portal_pins_portal_email_idx
  ON portal_pins (portal_email)
  WHERE portal_email IS NOT NULL;

-- portal_login_email: sign in with email + password (replaces school-code/admission/PIN flow)
CREATE OR REPLACE FUNCTION portal_login_email(
  p_email    text,
  p_password text
)
RETURNS TABLE(
  session_token        uuid,
  student_id           uuid,
  school_id            uuid,
  legal_name           text,
  must_change_pin      boolean,
  profile_photo_path   text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id  uuid;
  v_school_id   uuid;
  v_pin_hash    text;
  v_must_change boolean;
  v_legal_name  text;
  v_photo_path  text;
  v_session_id  uuid;
BEGIN
  SELECT pp.student_id, pp.school_id, pp.pin_hash, pp.must_change
  INTO   v_student_id, v_school_id, v_pin_hash, v_must_change
  FROM   portal_pins pp
  WHERE  pp.portal_email = lower(trim(p_email));

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Invalid email or password';
  END IF;

  IF v_pin_hash != crypt(p_password, v_pin_hash) THEN
    RAISE EXCEPTION 'Invalid email or password';
  END IF;

  -- Try student_records → auth.users for name
  SELECT
    COALESCE(
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      au.email
    ),
    sr.profile_photo_path
  INTO v_legal_name, v_photo_path
  FROM student_records sr
  LEFT JOIN auth.users au ON au.id = sr.auth_user_id
  WHERE sr.id = v_student_id;

  -- Fallback: Student → User table
  IF v_legal_name IS NULL THEN
    SELECT u.first_name || ' ' || u.last_name, u.profile_photo
    INTO   v_legal_name, v_photo_path
    FROM   "Student" s
    JOIN   "User"    u ON u.id = s.user_id
    WHERE  s.id = v_student_id;
  END IF;

  DELETE FROM portal_sessions
  WHERE student_id = v_student_id AND expires_at < now();

  INSERT INTO portal_sessions (student_id, school_id)
  VALUES (v_student_id, v_school_id)
  RETURNING id INTO v_session_id;

  RETURN QUERY SELECT
    v_session_id,
    v_student_id,
    v_school_id,
    COALESCE(v_legal_name, 'Student'),
    COALESCE(v_must_change, false),
    v_photo_path;
END;
$$;

-- admin_set_portal_email: called during enrollment to give student their portal credentials
CREATE OR REPLACE FUNCTION admin_set_portal_email(
  p_school_id    uuid,
  p_student_id   uuid,
  p_portal_email text,
  p_password     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO portal_pins (student_id, school_id, portal_email, pin_hash, must_change)
  VALUES (
    p_student_id,
    p_school_id,
    lower(trim(p_portal_email)),
    crypt(p_password, gen_salt('bf')),
    false
  )
  ON CONFLICT (student_id) DO UPDATE SET
    portal_email = lower(trim(p_portal_email)),
    pin_hash     = crypt(p_password, gen_salt('bf')),
    must_change  = false,
    updated_at   = now();
END;
$$;
