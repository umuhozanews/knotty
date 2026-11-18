-- Allow unlimited entries/exits per person per day at the gate.
-- Previously the ELSE branch blocked re-entry once both first_arrived_at
-- and departed_at were set (ALREADY_OUT).  Now 'auto' or 'in' direction
-- clears departed_at so the person is marked inside again.
-- ALREADY_OUT is only returned when direction='out' and they are already out.

-- ── record_virtual_student_tap_v2 ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_virtual_student_tap_v2(
  p_school_id       uuid,
  p_student_id      uuid,
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
    SELECT 1 FROM public.student_records
    WHERE id = p_student_id AND school_id = p_school_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'active student not found in school' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_school_id::text || ':' || p_idempotency_key::text, 0));

  IF EXISTS(
    SELECT 1 FROM public.attendance_scan_events
    WHERE school_id = p_school_id AND idempotency_key = p_idempotency_key
  ) THEN
    SELECT ss.timezone, ss.school_day_start INTO v_tz, v_start
      FROM public.school_settings ss WHERE ss.school_id = p_school_id;
    v_date := (p_occurred_at AT TIME ZONE COALESCE(v_tz, 'Africa/Kigali'))::date;
    SELECT * INTO v_rec FROM public.attendance_records
      WHERE school_id = p_school_id AND student_id = p_student_id AND attendance_date = v_date;
    RETURN jsonb_build_object(
      'action',               'DUPLICATE',
      'direction',            p_direction,
      'check_in_time',        v_rec.first_arrived_at,
      'check_out_time',       v_rec.departed_at,
      'attendance_record_id', v_rec.id,
      'scan_event_id',        NULL,
      'tap_in_points',        CASE WHEN v_rec.first_arrived_at IS NOT NULL THEN 2 ELSE 0 END,
      'tap_out_points',       CASE WHEN v_rec.departed_at      IS NOT NULL THEN 2 ELSE 0 END
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

  SELECT * INTO v_rec FROM public.attendance_records
    WHERE school_id = p_school_id AND student_id = p_student_id AND attendance_date = v_date
    FOR UPDATE;

  IF NOT FOUND THEN
    IF p_direction = 'out' THEN
      RAISE EXCEPTION 'cannot tap out: no tap-in record for today' USING ERRCODE = '23503';
    END IF;
    v_action := 'TAP_IN';
    v_dir    := 'in';
    INSERT INTO public.attendance_records(
      school_id, student_id, attendance_date, status,
      first_arrived_at, source, created_by_membership_id, created_by_person_id
    ) VALUES(
      p_school_id, p_student_id, v_date, v_status,
      p_occurred_at, 'virtual_tap', v_actor.membership_id, v_actor.person_id
    ) RETURNING * INTO v_rec;

  ELSIF p_direction = 'in' THEN
    -- Forced tap-in: overwrite arrival time and clear any departure
    v_action := 'TAP_IN';
    v_dir    := 'in';
    UPDATE public.attendance_records
      SET first_arrived_at = p_occurred_at, departed_at = NULL, status = v_status, updated_at = now()
      WHERE id = v_rec.id
      RETURNING * INTO v_rec;

  ELSIF v_rec.departed_at IS NULL THEN
    -- Inside → tap out
    v_action := 'TAP_OUT';
    v_dir    := 'out';
    UPDATE public.attendance_records
      SET departed_at = p_occurred_at, updated_at = now()
      WHERE id = v_rec.id
      RETURNING * INTO v_rec;

  ELSIF p_direction = 'out' THEN
    -- Already outside and explicitly tapping out again: duplicate
    v_action := 'ALREADY_OUT';
    v_dir    := 'out';

  ELSE
    -- 'auto' or 'in': re-entry after a previous exit — clear departed_at
    v_action := 'TAP_IN';
    v_dir    := 'in';
    UPDATE public.attendance_records
      SET departed_at = NULL, updated_at = now()
      WHERE id = v_rec.id
      RETURNING * INTO v_rec;
  END IF;

  INSERT INTO public.attendance_scan_events(
    school_id, idempotency_key,
    actor_membership_id, actor_person_id,
    student_id, attendance_record_id,
    scan_type, scan_direction, outcome, occurred_at, rejection_code
  ) VALUES(
    p_school_id, p_idempotency_key,
    v_actor.membership_id, v_actor.person_id,
    p_student_id, v_rec.id,
    'virtual_tap', v_dir,
    CASE WHEN v_action = 'ALREADY_OUT' THEN 'duplicate' ELSE 'accepted' END,
    p_occurred_at, NULL
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'action',               v_action,
    'direction',            v_dir,
    'check_in_time',        v_rec.first_arrived_at,
    'check_out_time',       v_rec.departed_at,
    'attendance_record_id', v_rec.id,
    'scan_event_id',        v_event_id,
    'tap_in_points',        CASE WHEN v_rec.first_arrived_at IS NOT NULL THEN 2 ELSE 0 END,
    'tap_out_points',       CASE WHEN v_rec.departed_at      IS NOT NULL THEN 2 ELSE 0 END
  );
END;
$$;

ALTER FUNCTION public.record_virtual_student_tap_v2(uuid, uuid, uuid, text, timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_virtual_student_tap_v2(uuid, uuid, uuid, text, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_virtual_student_tap_v2(uuid, uuid, uuid, text, timestamptz) TO authenticated;


-- ── record_virtual_staff_tap ──────────────────────────────────────────────────
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
      'action',                     'DUPLICATE',
      'direction',                  p_direction,
      'check_in_time',              v_rec.first_arrived_at,
      'check_out_time',             v_rec.departed_at,
      'staff_attendance_record_id', v_rec.id,
      'scan_event_id',              NULL,
      'tap_in_points',              CASE WHEN v_rec.first_arrived_at IS NOT NULL THEN 2 ELSE 0 END,
      'tap_out_points',             CASE WHEN v_rec.departed_at      IS NOT NULL THEN 2 ELSE 0 END
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
    -- Forced tap-in: overwrite arrival time and clear any departure
    v_action := 'TAP_IN';
    v_dir    := 'in';
    UPDATE public.staff_attendance_records
      SET first_arrived_at = p_occurred_at, departed_at = NULL, status = v_status, updated_at = now()
      WHERE id = v_rec.id
      RETURNING * INTO v_rec;

  ELSIF v_rec.departed_at IS NULL THEN
    -- Inside → tap out
    v_action := 'TAP_OUT';
    v_dir    := 'out';
    UPDATE public.staff_attendance_records
      SET departed_at = p_occurred_at, updated_at = now()
      WHERE id = v_rec.id
      RETURNING * INTO v_rec;

  ELSIF p_direction = 'out' THEN
    -- Already outside and explicitly tapping out again: duplicate
    v_action := 'ALREADY_OUT';
    v_dir    := 'out';

  ELSE
    -- 'auto' or 'in': re-entry after a previous exit — clear departed_at
    v_action := 'TAP_IN';
    v_dir    := 'in';
    UPDATE public.staff_attendance_records
      SET departed_at = NULL, updated_at = now()
      WHERE id = v_rec.id
      RETURNING * INTO v_rec;
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
    'action',                     v_action,
    'direction',                  v_dir,
    'check_in_time',              v_rec.first_arrived_at,
    'check_out_time',             v_rec.departed_at,
    'staff_attendance_record_id', v_rec.id,
    'scan_event_id',              v_event_id,
    'tap_in_points',              CASE WHEN v_rec.first_arrived_at IS NOT NULL THEN 2 ELSE 0 END,
    'tap_out_points',             CASE WHEN v_rec.departed_at      IS NOT NULL THEN 2 ELSE 0 END
  );
END;
$$;

ALTER FUNCTION public.record_virtual_staff_tap(uuid, uuid, uuid, text, timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_virtual_staff_tap(uuid, uuid, uuid, text, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_virtual_staff_tap(uuid, uuid, uuid, text, timestamptz) TO authenticated;
