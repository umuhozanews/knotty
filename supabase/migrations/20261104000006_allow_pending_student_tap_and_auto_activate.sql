-- Allow students in 'pending' or 'enrolled' status to tap attendance
-- and automatically activate them upon their first physical attendance tap.
-- Previously only 'active' students were accepted, causing taps to fail
-- for newly registered students before their manual activation.

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
    WHERE id = p_student_id AND school_id = p_school_id AND status IN ('active', 'pending', 'enrolled')
  ) THEN
    RAISE EXCEPTION 'active student not found in school' USING ERRCODE = 'P0002';
  END IF;

  -- Auto-activate pending or enrolled students on first physical attendance tap
  UPDATE public.student_records
     SET status = 'active', updated_at = now()
   WHERE id = p_student_id AND school_id = p_school_id AND status IN ('pending', 'enrolled');

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

create or replace function public.process_attendance_scan(p_school_id uuid,p_device_id uuid,p_device_credential_digest bytea,p_identifier_digest bytea,p_idempotency_key uuid,p_scan_direction text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_device public.attendance_devices%rowtype; v_card public.card_assignments%rowtype; v_event_id uuid; v_record_id uuid; v_student_id uuid; v_staff_id uuid; v_date date; v_status text; v_identifier_status text; v_arrived_at timestamptz; v_departed_at timestamptz; v_existing boolean; v_local_time time;
begin
  if p_idempotency_key is null or p_scan_direction not in ('in','out') or octet_length(p_device_credential_digest)<>32 or octet_length(p_identifier_digest)<>32 then raise exception 'invalid scan request' using errcode='22023'; end if;
  select * into v_device from public.attendance_devices where id=p_device_id and status='active' and credential_digest=p_device_credential_digest for share;
  if not found then raise exception 'authorized active attendance device required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_device.school_id::text||':'||p_idempotency_key::text,0));
  select id into v_event_id from public.attendance_scan_events where school_id=v_device.school_id and idempotency_key=p_idempotency_key;
  if v_event_id is not null then return v_event_id; end if;
  if v_device.school_id<>p_school_id then
    insert into public.attendance_scan_events(school_id,idempotency_key,device_id,scan_type,scan_direction,outcome,occurred_at,rejection_code)
      values(v_device.school_id,p_idempotency_key,p_device_id,'nfc',p_scan_direction,'rejected',now(),'school_scope_mismatch') returning id into v_event_id;
    return v_event_id;
  end if;
  select ca.* into v_card from public.card_identifiers ci join public.card_assignments ca on ca.id=ci.card_assignment_id and ca.school_id=ci.school_id
    where ci.school_id=p_school_id and ci.identifier_kind='nfc_uid' and ci.keyed_digest=p_identifier_digest for update of ca;
  if not found then
    insert into public.attendance_scan_events(school_id,idempotency_key,device_id,scan_type,scan_direction,outcome,occurred_at,rejection_code)
      values(p_school_id,p_idempotency_key,p_device_id,'nfc',p_scan_direction,'rejected',now(),'unknown_card') returning id into v_event_id;
    return v_event_id;
  end if;
  select ci.status into v_identifier_status from public.card_identifiers ci where ci.school_id=p_school_id and ci.card_assignment_id=v_card.id and ci.identifier_kind='nfc_uid' and ci.keyed_digest=p_identifier_digest;
  if v_identifier_status<>'active' or v_card.status<>'active' then
    insert into public.attendance_scan_events(school_id,idempotency_key,device_id,card_assignment_id,scan_type,scan_direction,outcome,occurred_at,rejection_code)
      values(p_school_id,p_idempotency_key,p_device_id,v_card.id,'nfc',p_scan_direction,'rejected',now(),'inactive_card_or_identifier') returning id into v_event_id;
    return v_event_id;
  end if;
  v_date:=(now() at time zone (select timezone from public.school_settings where school_id=p_school_id))::date;
  v_local_time:=(now() at time zone (select timezone from public.school_settings where school_id=p_school_id))::time;
  v_status:=case when v_local_time>(select school_day_start from public.school_settings where school_id=p_school_id) then 'late' else 'present' end;
  if v_card.holder_kind='student' then
    v_student_id:=v_card.student_id;
    if not exists(select 1 from public.student_records where id=v_student_id and school_id=p_school_id and status in ('active','pending','enrolled')) then
      insert into public.attendance_scan_events(school_id,idempotency_key,device_id,student_id,card_assignment_id,scan_type,scan_direction,outcome,occurred_at,rejection_code)
        values(p_school_id,p_idempotency_key,p_device_id,v_student_id,v_card.id,'nfc',p_scan_direction,'rejected',now(),'inactive_student') returning id into v_event_id;
      return v_event_id;
    end if;
    update public.student_records set status='active',updated_at=now() where id=v_student_id and school_id=p_school_id and status in ('pending','enrolled');
    select id,first_arrived_at,departed_at into v_record_id,v_arrived_at,v_departed_at from public.attendance_records where school_id=p_school_id and student_id=v_student_id and attendance_date=v_date for update;
    v_existing:=found;
    if p_scan_direction='out' and (not v_existing or v_arrived_at is null) then
      insert into public.attendance_scan_events(school_id,idempotency_key,device_id,student_id,card_assignment_id,scan_type,scan_direction,outcome,occurred_at,rejection_code)
        values(p_school_id,p_idempotency_key,p_device_id,v_student_id,v_card.id,'nfc',p_scan_direction,'rejected',now(),'no_arrival_record') returning id into v_event_id;
      return v_event_id;
    elsif not v_existing then
      insert into public.attendance_records(school_id,student_id,attendance_date,status,first_arrived_at,source)
        values(p_school_id,v_student_id,v_date,v_status,now(),'nfc') returning id into v_record_id;
    elsif p_scan_direction='out' and v_departed_at is null then
      update public.attendance_records set departed_at=now(),updated_at=now() where id=v_record_id;
    end if;
    insert into public.attendance_scan_events(school_id,idempotency_key,device_id,student_id,attendance_record_id,card_assignment_id,scan_type,scan_direction,outcome,occurred_at,rejection_code)
      values(p_school_id,p_idempotency_key,p_device_id,v_student_id,v_record_id,v_card.id,'nfc',p_scan_direction,
        case when (p_scan_direction='in' and v_existing) or (p_scan_direction='out' and v_departed_at is not null) then 'duplicate' else 'accepted' end,now(),null) returning id into v_event_id;
  else
    v_staff_id:=v_card.staff_record_id;
    if not exists(select 1 from public.staff_records where id=v_staff_id and school_id=p_school_id and employment_status='active') then
      insert into public.attendance_scan_events(school_id,idempotency_key,device_id,staff_record_id,card_assignment_id,scan_type,scan_direction,outcome,occurred_at,rejection_code)
        values(p_school_id,p_idempotency_key,p_device_id,v_staff_id,v_card.id,'nfc',p_scan_direction,'rejected',now(),'inactive_staff') returning id into v_event_id;
      return v_event_id;
    end if;
    select id,first_arrived_at,departed_at into v_record_id,v_arrived_at,v_departed_at from public.staff_attendance_records where school_id=p_school_id and staff_record_id=v_staff_id and attendance_date=v_date for update;
    v_existing:=found;
    if p_scan_direction='out' and (not v_existing or v_arrived_at is null) then
      insert into public.attendance_scan_events(school_id,idempotency_key,device_id,staff_record_id,card_assignment_id,scan_type,scan_direction,outcome,occurred_at,rejection_code)
        values(p_school_id,p_idempotency_key,p_device_id,v_staff_id,v_card.id,'nfc',p_scan_direction,'rejected',now(),'no_arrival_record') returning id into v_event_id;
      return v_event_id;
    elsif not v_existing then
      insert into public.staff_attendance_records(school_id,staff_record_id,attendance_date,status,first_arrived_at,source)
        values(p_school_id,v_staff_id,v_date,v_status,now(),'nfc') returning id into v_record_id;
    elsif p_scan_direction='out' and v_departed_at is null then
      update public.staff_attendance_records set departed_at=now(),updated_at=now() where id=v_record_id;
    end if;
    insert into public.attendance_scan_events(school_id,idempotency_key,device_id,staff_record_id,staff_attendance_record_id,card_assignment_id,scan_type,scan_direction,outcome,occurred_at,rejection_code)
      values(p_school_id,p_idempotency_key,p_device_id,v_staff_id,v_record_id,v_card.id,'nfc',p_scan_direction,
        case when (p_scan_direction='in' and v_existing) or (p_scan_direction='out' and v_departed_at is not null) then 'duplicate' else 'accepted' end,now(),null) returning id into v_event_id;
  end if;
  return v_event_id;
end;
$$;
alter function public.process_attendance_scan(uuid,uuid,bytea,bytea,uuid,text) owner to postgres;
revoke all on function public.process_attendance_scan(uuid,uuid,bytea,bytea,uuid,text) from public,anon,authenticated;
grant execute on function public.process_attendance_scan(uuid,uuid,bytea,bytea,uuid,text) to service_role;
