-- ============================================================
-- Appointments & Challenges Portal
-- Students/parents log in with admission_number + PIN,
-- submit appointment requests or issues, and track responses.
-- Admin manages from the dashboard.
-- ============================================================

-- ── TABLES ──────────────────────────────────────────────────

-- Student PINs for portal login
CREATE TABLE public.portal_pins (
  student_id   uuid    NOT NULL PRIMARY KEY
                         REFERENCES public.student_records(id) ON DELETE CASCADE,
  school_id    uuid    NOT NULL,
  pin_hash     text    NOT NULL, -- SHA-256(pin || student_id::text)
  must_change  boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Active portal sessions (token-based, no Supabase auth)
CREATE TABLE public.portal_sessions (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(), -- the session token
  student_id   uuid    NOT NULL REFERENCES public.student_records(id) ON DELETE CASCADE,
  school_id    uuid    NOT NULL,
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portal_sessions_student_idx ON public.portal_sessions(student_id);

-- Requests (appointments + challenges)
CREATE TABLE public.portal_requests (
  id                        uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                 uuid    NOT NULL,
  request_number            text    NOT NULL,
  type                      text    NOT NULL CHECK (type IN ('appointment','challenge')),
  category                  text    NOT NULL CHECK (category IN (
                              'billing','discipline','academic','health',
                              'card_nfc','gate_access','library','general')),
  submitted_by_student_id   uuid    NOT NULL REFERENCES public.student_records(id),
  subject                   text    NOT NULL CHECK (length(btrim(subject)) > 0),
  body                      text    NOT NULL CHECK (length(btrim(body)) > 0),
  priority                  text    NOT NULL DEFAULT 'medium'
                              CHECK (priority IN ('low','medium','high','urgent')),
  status                    text    NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','reviewing','in_progress','resolved','rejected')),
  assigned_to_staff_id      uuid    REFERENCES public.staff_records(id),
  -- appointment fields
  appointment_requested_at  timestamptz,
  appointment_confirmed_at  timestamptz,
  appointment_location      text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  resolved_at               timestamptz,
  UNIQUE (school_id, request_number)
);
CREATE INDEX portal_requests_school_status_idx ON public.portal_requests(school_id, status);
CREATE INDEX portal_requests_student_idx ON public.portal_requests(submitted_by_student_id);

-- Thread messages per request
CREATE TABLE public.portal_request_messages (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid    NOT NULL REFERENCES public.portal_requests(id) ON DELETE CASCADE,
  sender_kind  text    NOT NULL CHECK (sender_kind IN ('student','admin')),
  sender_name  text,
  body         text    NOT NULL CHECK (length(btrim(body)) > 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portal_messages_request_idx ON public.portal_request_messages(request_id, created_at);

-- In-system notifications for portal users
CREATE TABLE public.portal_notifications (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid    NOT NULL,
  student_id  uuid    NOT NULL REFERENCES public.student_records(id) ON DELETE CASCADE,
  request_id  uuid    REFERENCES public.portal_requests(id) ON DELETE CASCADE,
  type        text    NOT NULL,
  title       text    NOT NULL,
  body        text    NOT NULL,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portal_notifs_student_idx ON public.portal_notifications(student_id, is_read);

-- Enable RLS (all access goes through SECURITY DEFINER functions)
ALTER TABLE public.portal_pins           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_pins           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portal_sessions       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portal_requests       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portal_request_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portal_notifications  FORCE ROW LEVEL SECURITY;

-- No direct access from anon/authenticated — only via SECURITY DEFINER RPCs
CREATE POLICY portal_pins_deny           ON public.portal_pins           AS RESTRICTIVE USING (false);
CREATE POLICY portal_sessions_deny       ON public.portal_sessions       AS RESTRICTIVE USING (false);
CREATE POLICY portal_requests_deny       ON public.portal_requests       AS RESTRICTIVE USING (false);
CREATE POLICY portal_messages_deny       ON public.portal_request_messages AS RESTRICTIVE USING (false);
CREATE POLICY portal_notifs_deny         ON public.portal_notifications  AS RESTRICTIVE USING (false);

-- ── HELPER: internal session validation ─────────────────────

CREATE OR REPLACE FUNCTION private.portal_resolve_session(p_token uuid)
RETURNS TABLE (student_id uuid, school_id uuid, legal_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT ps.student_id, ps.school_id,
         COALESCE(ppi.legal_name, sr.admission_number)
  FROM   public.portal_sessions ps
  JOIN   public.student_records  sr  ON sr.id = ps.student_id
  LEFT JOIN private.person_private_identity ppi ON ppi.person_id = sr.person_id
  WHERE  ps.id = p_token
    AND  ps.expires_at > now()
  LIMIT 1
$$;

-- ── RPC: admin sets / resets a student PIN ───────────────────

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
  IF NOT EXISTS (
    SELECT 1 FROM public.school_members
    WHERE school_id = p_school_id
      AND auth_user_id = auth.uid()
      AND role IN ('admin','owner','staff')
  ) THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.student_records
    WHERE id = p_student_id AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'student not found' USING errcode = 'P0002';
  END IF;

  v_hash := encode(
    digest(p_pin || p_student_id::text, 'sha256'),
    'hex'
  );

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

-- ── RPC: portal login ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.portal_login(
  p_school_code      text,
  p_admission_number text,
  p_pin              text
) RETURNS TABLE (
  session_token  uuid,
  student_id     uuid,
  school_id      uuid,
  legal_name     text,
  must_change_pin boolean,
  profile_photo_path text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_school_id uuid;
  v_student_id uuid;
  v_hash text;
  v_stored_hash text;
  v_must_change boolean;
  v_session uuid;
  v_name text;
  v_photo text;
BEGIN
  SELECT s.id INTO v_school_id
  FROM public.schools s
  WHERE lower(s.code) = lower(btrim(p_school_code))
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'school not found' USING errcode = 'P0002';
  END IF;

  SELECT sr.id, COALESCE(ppi.legal_name, sr.admission_number), sr.profile_photo_path
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

  SELECT pp.pin_hash, pp.must_change
  INTO v_stored_hash, v_must_change
  FROM public.portal_pins pp
  WHERE pp.student_id = v_student_id;

  IF v_stored_hash IS NULL THEN
    RAISE EXCEPTION 'portal access not set up — contact your school admin' USING errcode = '42501';
  END IF;

  v_hash := encode(digest(p_pin || v_student_id::text, 'sha256'), 'hex');

  IF v_hash <> v_stored_hash THEN
    RAISE EXCEPTION 'invalid credentials' USING errcode = '42501';
  END IF;

  -- Delete any old expired sessions for this student
  DELETE FROM public.portal_sessions
  WHERE student_id = v_student_id AND expires_at < now();

  INSERT INTO public.portal_sessions (student_id, school_id)
  VALUES (v_student_id, v_school_id)
  RETURNING id INTO v_session;

  RETURN QUERY SELECT v_session, v_student_id, v_school_id, v_name, v_must_change, v_photo;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_login(text, text, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_login(text, text, text) TO anon, authenticated;

-- ── RPC: validate session ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.portal_validate_session(p_token uuid)
RETURNS TABLE (
  student_id uuid, school_id uuid, legal_name text,
  must_change_pin boolean, profile_photo_path text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT ps.student_id, ps.school_id,
         COALESCE(ppi.legal_name, sr.admission_number),
         pp.must_change,
         sr.profile_photo_path
  FROM   public.portal_sessions ps
  JOIN   public.student_records sr ON sr.id = ps.student_id
  LEFT JOIN private.person_private_identity ppi ON ppi.person_id = sr.person_id
  LEFT JOIN public.portal_pins pp ON pp.student_id = ps.student_id
  WHERE  ps.id = p_token AND ps.expires_at > now()
  LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_validate_session(uuid) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_validate_session(uuid) TO anon, authenticated;

-- ── RPC: change PIN ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.portal_change_pin(
  p_token   uuid,
  p_new_pin text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_student_id uuid;
  v_school_id  uuid;
BEGIN
  SELECT s.student_id, s.school_id INTO v_student_id, v_school_id
  FROM public.portal_sessions s
  WHERE s.id = p_token AND s.expires_at > now();

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'session expired or invalid' USING errcode = '42501';
  END IF;
  IF length(btrim(p_new_pin)) < 4 THEN
    RAISE EXCEPTION 'PIN must be at least 4 characters' USING errcode = '22023';
  END IF;

  UPDATE public.portal_pins
  SET pin_hash = encode(digest(p_new_pin || v_student_id::text, 'sha256'), 'hex'),
      must_change = false,
      updated_at  = now()
  WHERE student_id = v_student_id;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_change_pin(uuid, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_change_pin(uuid, text) TO anon, authenticated;

-- ── RPC: create request ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.portal_create_request(
  p_token                     uuid,
  p_type                      text,
  p_category                  text,
  p_subject                   text,
  p_body                      text,
  p_priority                  text DEFAULT 'medium',
  p_appointment_requested_at  timestamptz DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_student_id uuid;
  v_school_id  uuid;
  v_name       text;
  v_seq        bigint;
  v_req_number text;
  v_req_id     uuid;
BEGIN
  SELECT s.student_id, s.school_id,
         COALESCE(ppi.legal_name, sr.admission_number)
  INTO v_student_id, v_school_id, v_name
  FROM public.portal_sessions s
  JOIN public.student_records sr ON sr.id = s.student_id
  LEFT JOIN private.person_private_identity ppi ON ppi.person_id = sr.person_id
  WHERE s.id = p_token AND s.expires_at > now();

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'session expired or invalid' USING errcode = '42501';
  END IF;

  -- Generate request number REQ-YYYYMMDD-NNN
  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.portal_requests
  WHERE school_id = v_school_id;

  v_req_number := 'REQ-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');

  INSERT INTO public.portal_requests (
    school_id, request_number, type, category,
    submitted_by_student_id, subject, body,
    priority, appointment_requested_at
  ) VALUES (
    v_school_id, v_req_number, p_type, p_category,
    v_student_id, btrim(p_subject), btrim(p_body),
    p_priority, p_appointment_requested_at
  ) RETURNING id INTO v_req_id;

  -- Insert initial message from student
  INSERT INTO public.portal_request_messages (request_id, sender_kind, sender_name, body)
  VALUES (v_req_id, 'student', v_name, btrim(p_body));

  -- Notify admin (via portal_notifications for admin — skipped for now, admin sees inbox)
  -- Notify student: request received
  INSERT INTO public.portal_notifications (school_id, student_id, request_id, type, title, body)
  VALUES (v_school_id, v_student_id, v_req_id, 'request_received',
          'Request Submitted', 'Your request ' || v_req_number || ' has been received. We will respond soon.');

  RETURN v_req_id;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_create_request(uuid,text,text,text,text,text,timestamptz) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_create_request(uuid,text,text,text,text,text,timestamptz) TO anon, authenticated;

-- ── RPC: list my requests ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.portal_list_my_requests(p_token uuid)
RETURNS TABLE (
  request_id              uuid,
  request_number          text,
  type                    text,
  category                text,
  subject                 text,
  priority                text,
  status                  text,
  created_at              timestamptz,
  updated_at              timestamptz,
  appointment_requested_at timestamptz,
  appointment_confirmed_at timestamptz,
  unread_admin_messages   bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_student_id uuid;
  v_school_id  uuid;
BEGIN
  SELECT s.student_id, s.school_id INTO v_student_id, v_school_id
  FROM public.portal_sessions s
  WHERE s.id = p_token AND s.expires_at > now();

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'session expired or invalid' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT r.id, r.request_number, r.type, r.category,
         r.subject, r.priority, r.status,
         r.created_at, r.updated_at,
         r.appointment_requested_at, r.appointment_confirmed_at,
         (SELECT COUNT(*) FROM public.portal_request_messages m
          WHERE m.request_id = r.id AND m.sender_kind = 'admin'
            AND m.created_at > r.updated_at - interval '1 second') AS unread_admin_messages
  FROM public.portal_requests r
  WHERE r.submitted_by_student_id = v_student_id
    AND r.school_id = v_school_id
  ORDER BY r.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_list_my_requests(uuid) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_list_my_requests(uuid) TO anon, authenticated;

-- ── RPC: get request detail ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.portal_get_request_detail(
  p_token      uuid,
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
  created_at              timestamptz,
  updated_at              timestamptz,
  resolved_at             timestamptz,
  appointment_requested_at timestamptz,
  appointment_confirmed_at timestamptz,
  appointment_location     text,
  assigned_staff_name      text,
  messages                 jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_student_id uuid;
  v_school_id  uuid;
BEGIN
  SELECT s.student_id, s.school_id INTO v_student_id, v_school_id
  FROM public.portal_sessions s
  WHERE s.id = p_token AND s.expires_at > now();

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'session expired or invalid' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT r.id, r.request_number, r.type, r.category,
         r.subject, r.body, r.priority, r.status,
         r.created_at, r.updated_at, r.resolved_at,
         r.appointment_requested_at, r.appointment_confirmed_at,
         r.appointment_location,
         COALESCE(ppi.legal_name, '') AS assigned_staff_name,
         (
           SELECT jsonb_agg(
             jsonb_build_object(
               'id', m.id,
               'sender_kind', m.sender_kind,
               'sender_name', m.sender_name,
               'body', m.body,
               'created_at', m.created_at
             ) ORDER BY m.created_at
           )
           FROM public.portal_request_messages m
           WHERE m.request_id = r.id
         ) AS messages
  FROM public.portal_requests r
  LEFT JOIN public.staff_records srf ON srf.id = r.assigned_to_staff_id
  LEFT JOIN private.person_private_identity ppi ON ppi.person_id = srf.person_id
  WHERE r.id = p_request_id
    AND r.submitted_by_student_id = v_student_id
    AND r.school_id = v_school_id
  LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_get_request_detail(uuid,uuid) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_request_detail(uuid,uuid) TO anon, authenticated;

-- ── RPC: student adds a follow-up message ───────────────────

CREATE OR REPLACE FUNCTION public.portal_add_message(
  p_token      uuid,
  p_request_id uuid,
  p_body       text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_student_id uuid;
  v_school_id  uuid;
  v_name       text;
BEGIN
  SELECT s.student_id, s.school_id,
         COALESCE(ppi.legal_name, sr.admission_number)
  INTO v_student_id, v_school_id, v_name
  FROM public.portal_sessions s
  JOIN public.student_records sr ON sr.id = s.student_id
  LEFT JOIN private.person_private_identity ppi ON ppi.person_id = sr.person_id
  WHERE s.id = p_token AND s.expires_at > now();

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'session expired or invalid' USING errcode = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.portal_requests r
    WHERE r.id = p_request_id
      AND r.submitted_by_student_id = v_student_id
      AND r.status NOT IN ('resolved','rejected')
  ) THEN
    RAISE EXCEPTION 'request not found or already closed' USING errcode = 'P0002';
  END IF;

  INSERT INTO public.portal_request_messages (request_id, sender_kind, sender_name, body)
  VALUES (p_request_id, 'student', v_name, btrim(p_body));

  UPDATE public.portal_requests
  SET status = CASE WHEN status = 'resolved' THEN 'in_progress' ELSE status END,
      updated_at = now()
  WHERE id = p_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_add_message(uuid,uuid,text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_add_message(uuid,uuid,text) TO anon, authenticated;

-- ── RPC: get notifications ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.portal_get_notifications(p_token uuid)
RETURNS TABLE (
  id uuid, type text, title text, body text,
  request_id uuid, is_read boolean, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_student_id uuid;
BEGIN
  SELECT s.student_id INTO v_student_id
  FROM public.portal_sessions s
  WHERE s.id = p_token AND s.expires_at > now();

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'session expired or invalid' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT n.id, n.type, n.title, n.body, n.request_id, n.is_read, n.created_at
  FROM public.portal_notifications n
  WHERE n.student_id = v_student_id
  ORDER BY n.created_at DESC
  LIMIT 50;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_get_notifications(uuid) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_notifications(uuid) TO anon, authenticated;

-- ── RPC: mark notifications read ────────────────────────────

CREATE OR REPLACE FUNCTION public.portal_mark_notifications_read(p_token uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_student_id uuid;
BEGIN
  SELECT s.student_id INTO v_student_id
  FROM public.portal_sessions s
  WHERE s.id = p_token AND s.expires_at > now();

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'session expired or invalid' USING errcode = '42501';
  END IF;

  UPDATE public.portal_notifications
  SET is_read = true
  WHERE student_id = v_student_id AND is_read = false;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_mark_notifications_read(uuid) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_mark_notifications_read(uuid) TO anon, authenticated;

-- ── ADMIN RPCs ───────────────────────────────────────────────

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
  IF NOT EXISTS (
    SELECT 1 FROM public.school_members
    WHERE school_id = p_school_id
      AND auth_user_id = auth.uid()
      AND role IN ('admin','owner','staff')
  ) THEN
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

-- ── RPC: admin opens a request ───────────────────────────────

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
  IF NOT EXISTS (
    SELECT 1 FROM public.school_members
    WHERE school_id = p_school_id
      AND auth_user_id = auth.uid()
      AND role IN ('admin','owner','staff')
  ) THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;

  -- Mark as reviewing if still pending
  UPDATE public.portal_requests
  SET status = 'reviewing', updated_at = now()
  WHERE id = p_request_id AND school_id = p_school_id AND status = 'pending';

  RETURN QUERY
  SELECT r.id, r.request_number, r.type, r.category,
         r.subject, r.body, r.priority, r.status,
         COALESCE(ppi_s.legal_name, sr.admission_number) AS student_name,
         sr.admission_number,
         COALESCE(cs.name, '') AS student_class,
         r.created_at, r.updated_at, r.resolved_at,
         r.appointment_requested_at, r.appointment_confirmed_at,
         r.appointment_location,
         COALESCE(ppi_st.legal_name, '') AS assigned_staff_name,
         r.assigned_to_staff_id,
         (
           SELECT jsonb_agg(
             jsonb_build_object(
               'id', m.id,
               'sender_kind', m.sender_kind,
               'sender_name', m.sender_name,
               'body', m.body,
               'created_at', m.created_at
             ) ORDER BY m.created_at
           )
           FROM public.portal_request_messages m
           WHERE m.request_id = r.id
         ) AS messages
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

-- ── RPC: admin responds / updates a request ──────────────────

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
  IF NOT EXISTS (
    SELECT 1 FROM public.school_members
    WHERE school_id = p_school_id
      AND auth_user_id = auth.uid()
      AND role IN ('admin','owner','staff')
  ) THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;

  SELECT COALESCE(ppi.legal_name, sm.auth_user_id::text),
         r.submitted_by_student_id, r.request_number
  INTO v_admin_name, v_student_id, v_req_number
  FROM public.school_members sm
  JOIN public.portal_requests r ON r.id = p_request_id AND r.school_id = p_school_id
  LEFT JOIN public.staff_records stf ON stf.school_id = p_school_id AND stf.person_id = (
    SELECT person_id FROM auth.users au
    LEFT JOIN private.person_contact_points cp ON cp.normalized_value = au.email
    WHERE au.id = auth.uid()
    LIMIT 1
  )
  LEFT JOIN private.person_private_identity ppi ON ppi.person_id = stf.person_id
  WHERE sm.school_id = p_school_id AND sm.auth_user_id = auth.uid()
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
    VALUES (p_request_id, 'admin', COALESCE(v_admin_name, 'Admin'), btrim(p_message));

    -- Notify student
    INSERT INTO public.portal_notifications (school_id, student_id, request_id, type, title, body)
    VALUES (
      p_school_id, v_student_id, p_request_id,
      'admin_responded',
      'Response on ' || v_req_number,
      COALESCE(v_admin_name, 'Admin') || ' replied to your request.'
    );
  END IF;

  IF p_appointment_confirmed_at IS NOT NULL THEN
    INSERT INTO public.portal_notifications (school_id, student_id, request_id, type, title, body)
    VALUES (
      p_school_id, v_student_id, p_request_id,
      'appointment_confirmed',
      'Appointment Confirmed — ' || v_req_number,
      'Your appointment has been confirmed for ' ||
        to_char(p_appointment_confirmed_at AT TIME ZONE 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC.'
        || CASE WHEN p_appointment_location IS NOT NULL
                THEN ' Location: ' || p_appointment_location
                ELSE '' END
    );
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_respond_portal_request(uuid,uuid,text,text,uuid,timestamptz,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_respond_portal_request(uuid,uuid,text,text,uuid,timestamptz,text) TO authenticated;

-- ── RPC: get portal stats for admin dashboard ────────────────

CREATE OR REPLACE FUNCTION public.admin_get_portal_stats(p_school_id uuid)
RETURNS TABLE (
  total bigint, pending bigint, reviewing bigint,
  in_progress bigint, resolved bigint, rejected bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.school_members
    WHERE school_id = p_school_id
      AND auth_user_id = auth.uid()
      AND role IN ('admin','owner','staff')
  ) THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)                                                       AS total,
    COUNT(*) FILTER (WHERE status = 'pending')                     AS pending,
    COUNT(*) FILTER (WHERE status = 'reviewing')                   AS reviewing,
    COUNT(*) FILTER (WHERE status = 'in_progress')                 AS in_progress,
    COUNT(*) FILTER (WHERE status = 'resolved')                    AS resolved,
    COUNT(*) FILTER (WHERE status = 'rejected')                    AS rejected
  FROM public.portal_requests
  WHERE school_id = p_school_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_portal_stats(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_portal_stats(uuid) TO authenticated;
