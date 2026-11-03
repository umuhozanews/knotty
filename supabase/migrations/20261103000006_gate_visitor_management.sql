-- GATE MANAGEMENT: visitor tables, staff card lookup, staff virtual tap, visitor RPCs

-- ── 1. visitor_profiles ────────────────────────────────────────────────────────
CREATE TABLE public.visitor_profiles (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id               uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  full_name               text        NOT NULL,
  phone                   text,
  id_type                 text,
  id_reference            text,
  organization            text,
  photo_path              text,
  is_blocked              boolean     NOT NULL DEFAULT false,
  blocked_reason          text,
  blocked_by_membership_id uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, school_id),
  CONSTRAINT visitor_profiles_name_nonblank CHECK (length(btrim(full_name)) > 0)
);

CREATE INDEX visitor_profiles_school_name_idx ON public.visitor_profiles (school_id, lower(full_name));
CREATE INDEX visitor_profiles_school_phone_idx ON public.visitor_profiles (school_id, phone) WHERE phone IS NOT NULL;

-- ── 2. visitor_visits ─────────────────────────────────────────────────────────
CREATE TABLE public.visitor_visits (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                   uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  visitor_profile_id          uuid        NOT NULL,
  visit_date                  date        NOT NULL DEFAULT CURRENT_DATE,
  pass_reference              text        NOT NULL,
  host_person_id              uuid        REFERENCES public.persons(id) ON DELETE SET NULL,
  host_name                   text,
  host_department             text,
  purpose                     text        NOT NULL,
  notes                       text,
  status                      text        NOT NULL DEFAULT 'pending',
  arrived_at                  timestamptz,
  departed_at                 timestamptz,
  approved_by_membership_id   uuid,
  registered_by_membership_id uuid,
  checked_out_by_membership_id uuid,
  denial_reason               text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, school_id),
  UNIQUE (school_id, pass_reference),
  CONSTRAINT visitor_visits_status_check CHECK (status IN ('pending','approved','inside','completed','cancelled','denied')),
  CONSTRAINT visitor_visits_purpose_nonblank CHECK (length(btrim(purpose)) > 0),
  FOREIGN KEY (visitor_profile_id, school_id) REFERENCES public.visitor_profiles(id, school_id) ON DELETE RESTRICT
);

CREATE INDEX visitor_visits_school_date_status_idx ON public.visitor_visits (school_id, visit_date DESC, status);
CREATE INDEX visitor_visits_profile_idx ON public.visitor_visits (school_id, visitor_profile_id, visit_date DESC);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.visitor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_visits FORCE ROW LEVEL SECURITY;

CREATE POLICY visitor_profiles_school_member ON public.visitor_profiles
  FOR ALL TO authenticated
  USING (EXISTS(
    SELECT 1 FROM public.school_memberships sm
    JOIN public.persons p ON p.id = sm.person_id
    WHERE p.auth_user_id = (SELECT auth.uid())
      AND sm.school_id = visitor_profiles.school_id
      AND sm.status = 'active'
  ));

CREATE POLICY visitor_visits_school_member ON public.visitor_visits
  FOR ALL TO authenticated
  USING (EXISTS(
    SELECT 1 FROM public.school_memberships sm
    JOIN public.persons p ON p.id = sm.person_id
    WHERE p.auth_user_id = (SELECT auth.uid())
      AND sm.school_id = visitor_visits.school_id
      AND sm.status = 'active'
  ));

REVOKE ALL ON TABLE public.visitor_profiles, public.visitor_visits FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.visitor_profiles, public.visitor_visits TO authenticated;
GRANT ALL ON TABLE public.visitor_profiles, public.visitor_visits TO service_role;


-- ── 4. lookup_staff_card_holder ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lookup_staff_card_holder(
  p_school_id   uuid,
  p_card_number text
)
RETURNS TABLE (
  card_assignment_id  uuid,
  card_number         text,
  staff_record_id     uuid,
  employee_number     text,
  job_title           text,
  department          text,
  employment_status   text,
  legal_name          text,
  profile_photo_path  text,
  card_status         text,
  is_frozen           boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    ca.id                         AS card_assignment_id,
    ca.card_number,
    ca.staff_record_id,
    sr.employee_number,
    sr.job_title,
    sr.department,
    sr.employment_status,
    COALESCE(ppi.legal_name, '')  AS legal_name,
    sr.profile_photo_path,
    ca.status                     AS card_status,
    (ca.status = 'suspended')     AS is_frozen
  FROM public.card_assignments ca
  JOIN public.staff_records sr
    ON sr.id = ca.staff_record_id
   AND sr.school_id = ca.school_id
  LEFT JOIN private.person_private_identity ppi
    ON ppi.person_id = sr.person_id
  WHERE ca.school_id = p_school_id
    AND ca.card_number = p_card_number
    AND ca.holder_kind = 'staff'
    AND ca.status NOT IN ('revoked', 'replaced')
  LIMIT 1
$$;

ALTER FUNCTION public.lookup_staff_card_holder(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.lookup_staff_card_holder(uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.lookup_staff_card_holder(uuid, text) TO authenticated;


-- ── 5. record_virtual_staff_tap ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_virtual_staff_tap(
  p_school_id       uuid,
  p_staff_record_id uuid,
  p_idempotency_key uuid,
  p_direction       text        DEFAULT 'auto',
  p_occurred_at     timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor    record;
  v_tz       text;
  v_start    time;
  v_date     date;
  v_status   text;
  v_rec      record;
  v_event_id uuid;
  v_action   text;
  v_dir      text;
BEGIN
  SELECT * INTO v_actor FROM private.require_school_actor(p_school_id, 'attendance.record');

  IF p_idempotency_key IS NULL OR p_occurred_at IS NULL THEN
    RAISE EXCEPTION 'idempotency key and timestamp required' USING ERRCODE = '22023';
  END IF;
  IF p_direction NOT IN ('auto', 'in', 'out') THEN
    RAISE EXCEPTION 'direction must be auto, in, or out' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.staff_records
    WHERE id = p_staff_record_id AND school_id = p_school_id AND employment_status = 'active'
  ) THEN
    RAISE EXCEPTION 'active staff record not found in school' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_school_id::text || ':staff:' || p_idempotency_key::text, 0));

  IF EXISTS(
    SELECT 1 FROM public.attendance_scan_events
    WHERE school_id = p_school_id AND idempotency_key = p_idempotency_key
  ) THEN
    SELECT ss.timezone, ss.school_day_start INTO v_tz, v_start
      FROM public.school_settings ss WHERE ss.school_id = p_school_id;
    v_date := (p_occurred_at AT TIME ZONE COALESCE(v_tz, 'Africa/Kigali'))::date;
    SELECT * INTO v_rec FROM public.staff_attendance_records
      WHERE school_id = p_school_id AND staff_record_id = p_staff_record_id AND attendance_date = v_date;
    RETURN jsonb_build_object(
      'action',                   'DUPLICATE',
      'direction',                p_direction,
      'check_in_time',            v_rec.first_arrived_at,
      'check_out_time',           v_rec.departed_at,
      'staff_attendance_record_id', v_rec.id,
      'scan_event_id',            NULL,
      'tap_in_points',            CASE WHEN v_rec.first_arrived_at IS NOT NULL THEN 2 ELSE 0 END,
      'tap_out_points',           CASE WHEN v_rec.departed_at IS NOT NULL THEN 2 ELSE 0 END
    );
  END IF;

  SELECT ss.timezone, ss.school_day_start INTO v_tz, v_start
    FROM public.school_settings ss WHERE ss.school_id = p_school_id;
  v_tz    := COALESCE(v_tz, 'Africa/Kigali');
  v_start := COALESCE(v_start, '08:30'::time);
  v_date  := (p_occurred_at AT TIME ZONE v_tz)::date;
  v_status := CASE
    WHEN (p_occurred_at AT TIME ZONE v_tz)::time > v_start THEN 'late'
    ELSE 'present'
  END;

  SELECT * INTO v_rec FROM public.staff_attendance_records
    WHERE school_id = p_school_id AND staff_record_id = p_staff_record_id AND attendance_date = v_date
    FOR UPDATE;

  IF NOT FOUND THEN
    IF p_direction = 'out' THEN
      RAISE EXCEPTION 'cannot tap out: no tap-in record for today' USING ERRCODE = '23503';
    END IF;
    v_action := 'TAP_IN';
    v_dir    := 'in';
    INSERT INTO public.staff_attendance_records(
      school_id, staff_record_id, attendance_date, status,
      first_arrived_at, source, created_by_membership_id, created_by_person_id
    ) VALUES(
      p_school_id, p_staff_record_id, v_date, v_status,
      p_occurred_at, 'virtual_tap', v_actor.membership_id, v_actor.person_id
    ) RETURNING * INTO v_rec;

  ELSIF p_direction = 'in' THEN
    v_action := 'TAP_IN';
    v_dir    := 'in';
    UPDATE public.staff_attendance_records
      SET first_arrived_at = p_occurred_at, status = v_status, updated_at = now()
      WHERE id = v_rec.id
      RETURNING * INTO v_rec;

  ELSIF v_rec.departed_at IS NULL THEN
    v_action := 'TAP_OUT';
    v_dir    := 'out';
    UPDATE public.staff_attendance_records
      SET departed_at = p_occurred_at, updated_at = now()
      WHERE id = v_rec.id
      RETURNING * INTO v_rec;

  ELSE
    v_action := 'ALREADY_OUT';
    v_dir    := 'out';
  END IF;

  INSERT INTO public.attendance_scan_events(
    school_id, idempotency_key,
    actor_membership_id, actor_person_id,
    staff_record_id, staff_attendance_record_id,
    scan_type, scan_direction, outcome, occurred_at, rejection_code
  ) VALUES(
    p_school_id, p_idempotency_key,
    v_actor.membership_id, v_actor.person_id,
    p_staff_record_id, v_rec.id,
    'virtual_tap', v_dir,
    CASE WHEN v_action = 'ALREADY_OUT' THEN 'duplicate' ELSE 'accepted' END,
    p_occurred_at, NULL
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'action',                   v_action,
    'direction',                v_dir,
    'check_in_time',            v_rec.first_arrived_at,
    'check_out_time',           v_rec.departed_at,
    'staff_attendance_record_id', v_rec.id,
    'scan_event_id',            v_event_id,
    'tap_in_points',            CASE WHEN v_rec.first_arrived_at IS NOT NULL THEN 2 ELSE 0 END,
    'tap_out_points',           CASE WHEN v_rec.departed_at IS NOT NULL THEN 2 ELSE 0 END
  );
END;
$$;

ALTER FUNCTION public.record_virtual_staff_tap(uuid, uuid, uuid, text, timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_virtual_staff_tap(uuid, uuid, uuid, text, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_virtual_staff_tap(uuid, uuid, uuid, text, timestamptz) TO authenticated;


-- ── 6. register_visitor_visit ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_visitor_visit(
  p_school_id          uuid,
  p_full_name          text,
  p_phone              text        DEFAULT NULL,
  p_id_type            text        DEFAULT NULL,
  p_id_reference       text        DEFAULT NULL,
  p_organization       text        DEFAULT NULL,
  p_host_name          text        DEFAULT NULL,
  p_host_department    text        DEFAULT NULL,
  p_purpose            text        DEFAULT 'General Visit',
  p_notes              text        DEFAULT NULL,
  p_visitor_profile_id uuid        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor      record;
  v_profile_id uuid;
  v_visit_id   uuid;
  v_pass_ref   text;
BEGIN
  SELECT * INTO v_actor FROM private.require_school_actor(p_school_id, 'gate.manage');

  IF length(btrim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'visitor name is required' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(p_purpose)) = 0 THEN
    RAISE EXCEPTION 'visit purpose is required' USING ERRCODE = '22023';
  END IF;

  -- Reuse existing profile or create new one
  IF p_visitor_profile_id IS NOT NULL THEN
    SELECT id INTO v_profile_id FROM public.visitor_profiles
      WHERE id = p_visitor_profile_id AND school_id = p_school_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'visitor profile not found' USING ERRCODE = 'P0002';
    END IF;
    -- Update contact info if provided
    UPDATE public.visitor_profiles
      SET phone = COALESCE(p_phone, phone),
          organization = COALESCE(p_organization, organization),
          updated_at = now()
      WHERE id = v_profile_id;
  ELSE
    INSERT INTO public.visitor_profiles(
      school_id, full_name, phone, id_type, id_reference, organization
    ) VALUES(
      p_school_id,
      btrim(p_full_name),
      NULLIF(btrim(COALESCE(p_phone, '')), ''),
      NULLIF(btrim(COALESCE(p_id_type, '')), ''),
      NULLIF(btrim(COALESCE(p_id_reference, '')), ''),
      NULLIF(btrim(COALESCE(p_organization, '')), '')
    ) RETURNING id INTO v_profile_id;
  END IF;

  -- Generate pass reference: VIS-YYMMDD-XXXX
  v_pass_ref := 'VIS-' || to_char(CURRENT_DATE, 'YYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  INSERT INTO public.visitor_visits(
    school_id, visitor_profile_id, pass_reference,
    host_name, host_department, purpose, notes,
    status, registered_by_membership_id
  ) VALUES(
    p_school_id, v_profile_id, v_pass_ref,
    NULLIF(btrim(COALESCE(p_host_name, '')), ''),
    NULLIF(btrim(COALESCE(p_host_department, '')), ''),
    btrim(p_purpose),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    'pending',
    v_actor.membership_id
  ) RETURNING id INTO v_visit_id;

  RETURN jsonb_build_object(
    'visit_id',            v_visit_id,
    'visitor_profile_id',  v_profile_id,
    'pass_reference',      v_pass_ref,
    'status',              'pending'
  );
END;
$$;

ALTER FUNCTION public.register_visitor_visit(uuid, text, text, text, text, text, text, text, text, text, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.register_visitor_visit(uuid, text, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.register_visitor_visit(uuid, text, text, text, text, text, text, text, text, text, uuid) TO authenticated;


-- ── 7. admit_visitor ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admit_visitor(
  p_school_id uuid,
  p_visit_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_status text;
BEGIN
  SELECT * INTO v_actor FROM private.require_school_actor(p_school_id, 'gate.manage');

  SELECT status INTO v_status FROM public.visitor_visits
    WHERE id = p_visit_id AND school_id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'visitor visit not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'visitor cannot be admitted from status: %', v_status USING ERRCODE = '23514';
  END IF;

  UPDATE public.visitor_visits
    SET status = 'inside', arrived_at = now(), updated_at = now()
    WHERE id = p_visit_id AND school_id = p_school_id;
END;
$$;

ALTER FUNCTION public.admit_visitor(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admit_visitor(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admit_visitor(uuid, uuid) TO authenticated;


-- ── 8. checkout_visitor ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.checkout_visitor(
  p_school_id uuid,
  p_visit_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor  record;
  v_status text;
BEGIN
  SELECT * INTO v_actor FROM private.require_school_actor(p_school_id, 'gate.manage');

  SELECT status INTO v_status FROM public.visitor_visits
    WHERE id = p_visit_id AND school_id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'visitor visit not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'inside' THEN
    RAISE EXCEPTION 'visitor cannot be checked out from status: %', v_status USING ERRCODE = '23514';
  END IF;

  UPDATE public.visitor_visits
    SET status = 'completed', departed_at = now(),
        checked_out_by_membership_id = v_actor.membership_id, updated_at = now()
    WHERE id = p_visit_id AND school_id = p_school_id;
END;
$$;

ALTER FUNCTION public.checkout_visitor(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.checkout_visitor(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.checkout_visitor(uuid, uuid) TO authenticated;


-- ── 9. approve_visitor ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_visitor(
  p_school_id uuid,
  p_visit_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor  record;
  v_status text;
BEGIN
  SELECT * INTO v_actor FROM private.require_school_actor(p_school_id, 'gate.manage');

  SELECT status INTO v_status FROM public.visitor_visits
    WHERE id = p_visit_id AND school_id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'visitor visit not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'only pending visits can be approved, current status: %', v_status USING ERRCODE = '23514';
  END IF;

  UPDATE public.visitor_visits
    SET status = 'approved',
        approved_by_membership_id = v_actor.membership_id, updated_at = now()
    WHERE id = p_visit_id AND school_id = p_school_id;
END;
$$;

ALTER FUNCTION public.approve_visitor(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.approve_visitor(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.approve_visitor(uuid, uuid) TO authenticated;


-- ── 10. deny_visitor ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deny_visitor(
  p_school_id   uuid,
  p_visit_id    uuid,
  p_reason      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor  record;
  v_status text;
BEGIN
  SELECT * INTO v_actor FROM private.require_school_actor(p_school_id, 'gate.manage');

  SELECT status INTO v_status FROM public.visitor_visits
    WHERE id = p_visit_id AND school_id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'visitor visit not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'visit cannot be denied from status: %', v_status USING ERRCODE = '23514';
  END IF;

  UPDATE public.visitor_visits
    SET status = 'denied', denial_reason = p_reason, updated_at = now()
    WHERE id = p_visit_id AND school_id = p_school_id;
END;
$$;

ALTER FUNCTION public.deny_visitor(uuid, uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.deny_visitor(uuid, uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.deny_visitor(uuid, uuid, text) TO authenticated;


-- ── 11. get_gate_overview ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_gate_overview(
  p_school_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor            record;
  v_students_inside  bigint;
  v_staff_inside     bigint;
  v_visitors_inside  bigint;
  v_today_entries    bigint;
  v_today_exits      bigint;
  v_pending_visitors bigint;
  v_today            date;
  v_tz               text;
BEGIN
  SELECT * INTO v_actor FROM private.require_school_actor(p_school_id, 'gate.read');

  SELECT COALESCE(ss.timezone, 'Africa/Kigali') INTO v_tz
    FROM public.school_settings ss WHERE ss.school_id = p_school_id;
  v_today := (now() AT TIME ZONE COALESCE(v_tz, 'Africa/Kigali'))::date;

  SELECT COUNT(*) INTO v_students_inside
    FROM public.attendance_records ar
    WHERE ar.school_id = p_school_id
      AND ar.attendance_date = v_today
      AND ar.first_arrived_at IS NOT NULL
      AND ar.departed_at IS NULL;

  SELECT COUNT(*) INTO v_staff_inside
    FROM public.staff_attendance_records sar
    WHERE sar.school_id = p_school_id
      AND sar.attendance_date = v_today
      AND sar.first_arrived_at IS NOT NULL
      AND sar.departed_at IS NULL;

  SELECT COUNT(*) INTO v_visitors_inside
    FROM public.visitor_visits vv
    WHERE vv.school_id = p_school_id
      AND vv.visit_date = v_today
      AND vv.status = 'inside';

  SELECT COUNT(*) INTO v_today_entries
    FROM public.attendance_scan_events ase
    WHERE ase.school_id = p_school_id
      AND (ase.occurred_at AT TIME ZONE COALESCE(v_tz, 'Africa/Kigali'))::date = v_today
      AND ase.scan_direction = 'in'
      AND ase.outcome = 'accepted';

  SELECT COUNT(*) INTO v_today_exits
    FROM public.attendance_scan_events ase
    WHERE ase.school_id = p_school_id
      AND (ase.occurred_at AT TIME ZONE COALESCE(v_tz, 'Africa/Kigali'))::date = v_today
      AND ase.scan_direction = 'out'
      AND ase.outcome = 'accepted';

  SELECT COUNT(*) INTO v_pending_visitors
    FROM public.visitor_visits vv
    WHERE vv.school_id = p_school_id
      AND vv.visit_date = v_today
      AND vv.status = 'pending';

  RETURN jsonb_build_object(
    'students_inside',  v_students_inside,
    'staff_inside',     v_staff_inside,
    'visitors_inside',  v_visitors_inside,
    'today_entries',    v_today_entries,
    'today_exits',      v_today_exits,
    'pending_visitors', v_pending_visitors
  );
END;
$$;

ALTER FUNCTION public.get_gate_overview(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_gate_overview(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_gate_overview(uuid) TO authenticated;


-- ── 12. search_visitor_profiles ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_visitor_profiles(
  p_school_id uuid,
  p_query     text,
  p_limit     int DEFAULT 10
)
RETURNS TABLE (
  visitor_profile_id uuid,
  full_name          text,
  phone              text,
  organization       text,
  id_type            text,
  id_reference       text,
  is_blocked         boolean,
  last_visit_date    date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    vp.id                AS visitor_profile_id,
    vp.full_name,
    vp.phone,
    vp.organization,
    vp.id_type,
    vp.id_reference,
    vp.is_blocked,
    (SELECT MAX(vv.visit_date) FROM public.visitor_visits vv
      WHERE vv.visitor_profile_id = vp.id AND vv.school_id = vp.school_id) AS last_visit_date
  FROM public.visitor_profiles vp
  WHERE vp.school_id = p_school_id
    AND (
      vp.full_name ILIKE '%' || p_query || '%'
      OR vp.phone  ILIKE '%' || p_query || '%'
    )
  ORDER BY vp.full_name ASC
  LIMIT p_limit
$$;

ALTER FUNCTION public.search_visitor_profiles(uuid, text, int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.search_visitor_profiles(uuid, text, int) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.search_visitor_profiles(uuid, text, int) TO authenticated;


-- ── 13. list_visitor_visits ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_visitor_visits(
  p_school_id uuid,
  p_date      date    DEFAULT CURRENT_DATE,
  p_status    text    DEFAULT NULL,
  p_limit     int     DEFAULT 50
)
RETURNS TABLE (
  visit_id            uuid,
  visitor_profile_id  uuid,
  full_name           text,
  phone               text,
  organization        text,
  pass_reference      text,
  host_name           text,
  host_department     text,
  purpose             text,
  notes               text,
  status              text,
  arrived_at          timestamptz,
  departed_at         timestamptz,
  created_at          timestamptz,
  is_blocked          boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    vv.id             AS visit_id,
    vp.id             AS visitor_profile_id,
    vp.full_name,
    vp.phone,
    vp.organization,
    vv.pass_reference,
    vv.host_name,
    vv.host_department,
    vv.purpose,
    vv.notes,
    vv.status,
    vv.arrived_at,
    vv.departed_at,
    vv.created_at,
    vp.is_blocked
  FROM public.visitor_visits vv
  JOIN public.visitor_profiles vp
    ON vp.id = vv.visitor_profile_id AND vp.school_id = vv.school_id
  WHERE vv.school_id = p_school_id
    AND vv.visit_date = p_date
    AND (p_status IS NULL OR vv.status = p_status)
  ORDER BY
    CASE vv.status
      WHEN 'inside'   THEN 0
      WHEN 'pending'  THEN 1
      WHEN 'approved' THEN 2
      ELSE 3
    END,
    vv.created_at DESC
  LIMIT p_limit
$$;

ALTER FUNCTION public.list_visitor_visits(uuid, date, text, int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.list_visitor_visits(uuid, date, text, int) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_visitor_visits(uuid, date, text, int) TO authenticated;
