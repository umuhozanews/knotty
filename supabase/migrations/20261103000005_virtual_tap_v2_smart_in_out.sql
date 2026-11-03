-- record_virtual_student_tap_v2
-- Replaces the original single-direction virtual tap.
-- direction: 'auto' (smart), 'in' (force tap-in), 'out' (force tap-out)
-- Returns JSONB: { action, direction, check_in_time, check_out_time,
--                 tap_in_points, tap_out_points, attendance_record_id, scan_event_id }
-- tap_in_points = 2 if first_arrived_at is set, else 0
-- tap_out_points = 2 if departed_at is set, else 0

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

  -- Serialise concurrent taps for the same idempotency key
  PERFORM pg_advisory_xact_lock(hashtextextended(p_school_id::text || ':' || p_idempotency_key::text, 0));

  -- Idempotency: return early if this key was already processed
  IF EXISTS(
    SELECT 1 FROM public.attendance_scan_events
    WHERE school_id = p_school_id AND idempotency_key = p_idempotency_key
  ) THEN
    SELECT ss.timezone, ss.school_day_start INTO v_tz, v_start
      FROM public.school_settings ss WHERE ss.school_id = p_school_id;
    v_date := (p_occurred_at AT TIME ZONE coalesce(v_tz, 'Africa/Kigali'))::date;
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

  -- Resolve school timezone + start time once
  SELECT ss.timezone, ss.school_day_start INTO v_tz, v_start
    FROM public.school_settings ss WHERE ss.school_id = p_school_id;
  v_tz    := coalesce(v_tz, 'Africa/Kigali');
  v_start := coalesce(v_start, '08:30'::time);
  v_date  := (p_occurred_at AT TIME ZONE v_tz)::date;
  v_status := CASE
    WHEN (p_occurred_at AT TIME ZONE v_tz)::time > v_start THEN 'late'
    ELSE 'present'
  END;

  -- Lock existing record if any
  SELECT * INTO v_rec FROM public.attendance_records
    WHERE school_id = p_school_id AND student_id = p_student_id AND attendance_date = v_date
    FOR UPDATE;

  -- ── Decision tree ───────────────────────────────────────────────────
  IF NOT FOUND THEN
    -- No record at all: only tap-in makes sense
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
    -- Forced tap-in: overwrite arrival time
    v_action := 'TAP_IN';
    v_dir    := 'in';
    UPDATE public.attendance_records
      SET first_arrived_at = p_occurred_at, status = v_status, updated_at = now()
      WHERE id = v_rec.id
      RETURNING * INTO v_rec;

  ELSIF v_rec.departed_at IS NULL THEN
    -- Has tap-in, no departure yet: TAP_OUT (for 'auto' or 'out')
    v_action := 'TAP_OUT';
    v_dir    := 'out';
    UPDATE public.attendance_records
      SET departed_at = p_occurred_at, updated_at = now()
      WHERE id = v_rec.id
      RETURNING * INTO v_rec;

  ELSE
    -- Both tap-in and tap-out already recorded
    v_action := 'ALREADY_OUT';
    v_dir    := 'out';
  END IF;

  -- Record scan event
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


-- get_class_attendance_report: returns all attendance rows for a date,
-- enriched with student name, admission number, and class/level name.
-- Sorted by class then first_arrived_at (arrival order within each class).
CREATE OR REPLACE FUNCTION public.get_class_attendance_report(
  p_school_id uuid,
  p_date      date
)
RETURNS TABLE (
  attendance_record_id  uuid,
  student_id            uuid,
  admission_number      text,
  legal_name            text,
  class_section_id      uuid,
  class_name            text,
  level_name            text,
  status                text,
  first_arrived_at      timestamptz,
  departed_at           timestamptz,
  tap_in_points         int,
  tap_out_points        int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Verify caller is an active school member
  IF NOT EXISTS(
    SELECT 1 FROM public.school_memberships sm
    JOIN public.persons p ON p.id = sm.person_id AND p.status = 'active'
    WHERE p.auth_user_id = (SELECT auth.uid())
      AND sm.school_id = p_school_id
      AND sm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ar.id,
    ar.student_id,
    sr.admission_number,
    ppi.legal_name,
    cs.id,
    cs.name,
    el.name,
    ar.status,
    ar.first_arrived_at,
    ar.departed_at,
    CASE WHEN ar.first_arrived_at IS NOT NULL THEN 2 ELSE 0 END,
    CASE WHEN ar.departed_at IS NOT NULL THEN 2 ELSE 0 END
  FROM public.attendance_records ar
  JOIN public.student_records sr
    ON sr.id = ar.student_id AND sr.school_id = ar.school_id
  JOIN private.person_private_identity ppi
    ON ppi.person_id = sr.person_id
  LEFT JOIN public.student_enrollments se
    ON se.school_id = ar.school_id AND se.student_id = ar.student_id AND se.status = 'enrolled'
  LEFT JOIN public.student_class_placements scp
    ON scp.school_id = se.school_id AND scp.enrollment_id = se.id AND scp.status = 'active'
  LEFT JOIN public.class_sections cs
    ON cs.id = scp.class_section_id AND cs.school_id = ar.school_id
  LEFT JOIN public.education_levels el
    ON el.id = cs.education_level_id AND el.school_id = ar.school_id
  WHERE ar.school_id = p_school_id
    AND ar.attendance_date = p_date
  ORDER BY cs.name NULLS LAST, ar.first_arrived_at ASC NULLS LAST, ppi.legal_name ASC;
END;
$$;

ALTER FUNCTION public.get_class_attendance_report(uuid, date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_class_attendance_report(uuid, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_class_attendance_report(uuid, date) TO authenticated;
