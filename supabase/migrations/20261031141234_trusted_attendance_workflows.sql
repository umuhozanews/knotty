-- Transactional manual attendance, corrections, and school/device-scoped scans.
alter table public.attendance_scan_events add column scan_direction text not null default 'in' check (scan_direction in ('in','out'));

insert into private.permission_catalog(scope,permission_key,description,is_sensitive)
values('school','attendance.devices.manage','Register and revoke attendance terminals and device credentials',true)
on conflict(scope,permission_key) do nothing;
insert into private.role_permissions(scope,role_key,permission_key)
values ('school','ADMIN','attendance.devices.manage'),('school','SCHOOL_MANAGER','attendance.devices.manage')
on conflict do nothing;
create unique index attendance_devices_school_credential_key
  on public.attendance_devices(school_id,credential_digest) where credential_digest is not null;

create or replace function private.is_school_role(p_school_id uuid,p_role_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.persons p join public.school_memberships sm on sm.person_id=p.id
    join public.school_membership_roles smr on smr.school_id=sm.school_id and smr.membership_id=sm.id and smr.person_id=sm.person_id
    where p.auth_user_id=(select auth.uid()) and p.status='active' and sm.school_id=p_school_id and sm.status='active'
      and smr.role_key=p_role_key and smr.status='active');
$$;
alter function private.is_school_role(uuid,text) owner to postgres;
revoke all on function private.is_school_role(uuid,text) from public,anon,service_role;
grant execute on function private.is_school_role(uuid,text) to authenticated;

create function public.register_attendance_device(p_school_id uuid,p_device_code text,p_device_kind text,p_credential_digest bytea)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'attendance.devices.manage');
  if length(btrim(coalesce(p_device_code,'')))=0 or p_device_kind not in ('gate_terminal','mobile','virtual_tap') or octet_length(p_credential_digest)<>32 then raise exception 'valid device code, type and 32-byte credential digest required' using errcode='22023'; end if;
  insert into public.attendance_devices(school_id,device_code,device_kind,credential_digest,created_by_membership_id,created_by_person_id)
    values(p_school_id,btrim(p_device_code),p_device_kind,p_credential_digest,v_actor.membership_id,v_actor.person_id) returning id into v_id;
  perform private.write_school_audit(p_school_id,'attendance',v_id,'attendance_device_registered','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('device_code',p_device_code,'device_kind',p_device_kind));
  return v_id;
end;
$$;
alter function public.register_attendance_device(uuid,text,text,bytea) owner to postgres;
revoke all on function public.register_attendance_device(uuid,text,text,bytea) from public,anon,service_role;
grant execute on function public.register_attendance_device(uuid,text,text,bytea) to authenticated;

create function public.set_attendance_device_status(p_school_id uuid,p_device_id uuid,p_new_status text,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_old_status text;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'attendance.devices.manage');
  if p_new_status not in ('active','suspended','revoked') or length(btrim(coalesce(p_reason,'')))<3 then raise exception 'device status and audit reason required' using errcode='22023'; end if;
  select status into v_old_status from public.attendance_devices where id=p_device_id and school_id=p_school_id for update;
  if not found then raise exception 'device not found in school' using errcode='P0002'; end if;
  if v_old_status='revoked' and p_new_status<>'revoked' then raise exception 'revoked device credentials cannot be reactivated' using errcode='23514'; end if;
  update public.attendance_devices set status=p_new_status,updated_at=now() where id=p_device_id and school_id=p_school_id;
  perform private.write_school_audit(p_school_id,'attendance',p_device_id,'attendance_device_status_changed','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('from',v_old_status,'to',p_new_status,'reason',btrim(p_reason)));
end;
$$;
alter function public.set_attendance_device_status(uuid,uuid,text,text) owner to postgres;
revoke all on function public.set_attendance_device_status(uuid,uuid,text,text) from public,anon,service_role;
grant execute on function public.set_attendance_device_status(uuid,uuid,text,text) to authenticated;

create function public.record_student_attendance(p_school_id uuid,p_student_id uuid,p_attendance_date date,p_status text,p_arrived_at timestamptz default null,p_departed_at timestamptz default null,p_reason text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'attendance.record');
  if private.is_school_role(p_school_id,'TEACHER') and not private.require_teacher_student_access(p_school_id,p_student_id) then raise exception 'teacher must be assigned to the student class' using errcode='42501'; end if;
  if p_status not in ('present','absent','late','excused','early_departure') or (p_status in ('excused','early_departure') and length(btrim(coalesce(p_reason,'')))<3) then raise exception 'valid attendance status and reason required' using errcode='22023'; end if;
  if not exists(select 1 from public.student_records where id=p_student_id and school_id=p_school_id and status='active') then raise exception 'active student not found in school' using errcode='P0002'; end if;
  insert into public.attendance_records(school_id,student_id,attendance_date,status,first_arrived_at,departed_at,source,created_by_membership_id,created_by_person_id)
    values(p_school_id,p_student_id,p_attendance_date,p_status,p_arrived_at,p_departed_at,'manual',v_actor.membership_id,v_actor.person_id) returning id into v_id;
  perform private.write_school_audit(p_school_id,'attendance',v_id,'student_attendance_recorded','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('student_id',p_student_id,'date',p_attendance_date,'status',p_status,'reason',p_reason));
  return v_id;
end;
$$;
alter function public.record_student_attendance(uuid,uuid,date,text,timestamptz,timestamptz,text) owner to postgres;
revoke all on function public.record_student_attendance(uuid,uuid,date,text,timestamptz,timestamptz,text) from public,anon,service_role;
grant execute on function public.record_student_attendance(uuid,uuid,date,text,timestamptz,timestamptz,text) to authenticated;

create function public.record_virtual_student_tap(p_school_id uuid,p_student_id uuid,p_idempotency_key uuid,p_occurred_at timestamptz default now())
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_date date; v_id uuid; v_event_id uuid; v_status text; v_existing boolean;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'attendance.record');
  if p_idempotency_key is null or p_occurred_at is null then raise exception 'idempotency key and timestamp required' using errcode='22023'; end if;
  if private.is_school_role(p_school_id,'TEACHER') and not private.require_teacher_student_access(p_school_id,p_student_id) then raise exception 'teacher must be assigned to the student class' using errcode='42501'; end if;
  if not exists(select 1 from public.student_records where id=p_student_id and school_id=p_school_id and status='active') then raise exception 'active student not found in school' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text||':'||p_idempotency_key::text,0));
  select id into v_event_id from public.attendance_scan_events where school_id=p_school_id and idempotency_key=p_idempotency_key;
  if v_event_id is not null then return v_event_id; end if;
  v_date:=(p_occurred_at at time zone (select timezone from public.school_settings where school_id=p_school_id))::date;
  v_status:=case when (p_occurred_at at time zone (select timezone from public.school_settings where school_id=p_school_id))::time>(select school_day_start from public.school_settings where school_id=p_school_id) then 'late' else 'present' end;
  select id into v_id from public.attendance_records where school_id=p_school_id and student_id=p_student_id and attendance_date=v_date for update;
  v_existing:=found;
  if v_id is null then
    insert into public.attendance_records(school_id,student_id,attendance_date,status,first_arrived_at,source,created_by_membership_id,created_by_person_id)
      values(p_school_id,p_student_id,v_date,v_status,p_occurred_at,'virtual_tap',v_actor.membership_id,v_actor.person_id) returning id into v_id;
  end if;
  insert into public.attendance_scan_events(school_id,idempotency_key,actor_membership_id,actor_person_id,student_id,attendance_record_id,scan_type,scan_direction,outcome,occurred_at,rejection_code)
    values(p_school_id,p_idempotency_key,v_actor.membership_id,v_actor.person_id,p_student_id,v_id,'virtual_tap','in',case when v_existing then 'duplicate' else 'accepted' end,p_occurred_at,null) returning id into v_event_id;
  return v_event_id;
end;
$$;
alter function public.record_virtual_student_tap(uuid,uuid,uuid,timestamptz) owner to postgres;
revoke all on function public.record_virtual_student_tap(uuid,uuid,uuid,timestamptz) from public,anon,service_role;
grant execute on function public.record_virtual_student_tap(uuid,uuid,uuid,timestamptz) to authenticated;

create function public.record_staff_attendance(p_school_id uuid,p_staff_record_id uuid,p_attendance_date date,p_status text,p_arrived_at timestamptz default null,p_departed_at timestamptz default null,p_reason text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'attendance.staff.record');
  if p_status not in ('present','absent','late','excused','early_departure') or (p_status in ('excused','early_departure') and length(btrim(coalesce(p_reason,'')))<3) then raise exception 'valid attendance status and reason required' using errcode='22023'; end if;
  if not exists(select 1 from public.staff_records where id=p_staff_record_id and school_id=p_school_id and employment_status='active') then raise exception 'active staff record not found in school' using errcode='P0002'; end if;
  insert into public.staff_attendance_records(school_id,staff_record_id,attendance_date,status,first_arrived_at,departed_at,source,created_by_membership_id,created_by_person_id)
    values(p_school_id,p_staff_record_id,p_attendance_date,p_status,p_arrived_at,p_departed_at,'manual',v_actor.membership_id,v_actor.person_id) returning id into v_id;
  perform private.write_school_audit(p_school_id,'attendance',v_id,'staff_attendance_recorded','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('staff_record_id',p_staff_record_id,'date',p_attendance_date,'status',p_status,'reason',p_reason));
  return v_id;
end;
$$;
alter function public.record_staff_attendance(uuid,uuid,date,text,timestamptz,timestamptz,text) owner to postgres;
revoke all on function public.record_staff_attendance(uuid,uuid,date,text,timestamptz,timestamptz,text) from public,anon,service_role;
grant execute on function public.record_staff_attendance(uuid,uuid,date,text,timestamptz,timestamptz,text) to authenticated;

create function public.correct_student_attendance(p_school_id uuid,p_attendance_id uuid,p_status text,p_arrived_at timestamptz,p_departed_at timestamptz,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_old public.attendance_records%rowtype; v_new jsonb;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'attendance.correct');
  if p_status not in ('present','absent','late','excused','early_departure') or length(btrim(coalesce(p_reason,'')))<3 then raise exception 'valid correction and reason required' using errcode='22023'; end if;
  select * into v_old from public.attendance_records where id=p_attendance_id and school_id=p_school_id for update;
  if not found then raise exception 'attendance row not found in school' using errcode='P0002'; end if;
  v_new:=jsonb_build_object('status',p_status,'first_arrived_at',p_arrived_at,'departed_at',p_departed_at);
  insert into public.attendance_correction_audit(school_id,attendance_record_id,actor_membership_id,actor_person_id,prior_state,corrected_state,reason)
    values(p_school_id,p_attendance_id,v_actor.membership_id,v_actor.person_id,jsonb_build_object('status',v_old.status,'first_arrived_at',v_old.first_arrived_at,'departed_at',v_old.departed_at),v_new,btrim(p_reason));
  update public.attendance_records set status=p_status,first_arrived_at=p_arrived_at,departed_at=p_departed_at,updated_at=now() where id=p_attendance_id;
  perform private.write_school_audit(p_school_id,'attendance',p_attendance_id,'student_attendance_corrected','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('reason',btrim(p_reason)));
end;
$$;
alter function public.correct_student_attendance(uuid,uuid,text,timestamptz,timestamptz,text) owner to postgres;
revoke all on function public.correct_student_attendance(uuid,uuid,text,timestamptz,timestamptz,text) from public,anon,service_role;
grant execute on function public.correct_student_attendance(uuid,uuid,text,timestamptz,timestamptz,text) to authenticated;

-- Service-only scan RPC. Edge Function authenticates the device credential,
-- HMACs the raw NFC UID, and supplies only the school-scoped digest. No global
-- card lookup or raw card identifier reaches PostgreSQL.
create function public.process_attendance_scan(p_school_id uuid,p_device_id uuid,p_device_credential_digest bytea,p_identifier_digest bytea,p_idempotency_key uuid,p_scan_direction text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_device public.attendance_devices%rowtype; v_card public.card_assignments%rowtype; v_event_id uuid; v_record_id uuid; v_student_id uuid; v_staff_id uuid; v_date date; v_status text; v_identifier_status text; v_arrived_at timestamptz; v_departed_at timestamptz; v_existing boolean;
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
    if not exists(select 1 from public.student_records where id=v_student_id and school_id=p_school_id and status='active') then
      insert into public.attendance_scan_events(school_id,idempotency_key,device_id,student_id,card_assignment_id,scan_type,scan_direction,outcome,occurred_at,rejection_code)
        values(p_school_id,p_idempotency_key,p_device_id,v_student_id,v_card.id,'nfc',p_scan_direction,'rejected',now(),'inactive_student') returning id into v_event_id;
      return v_event_id;
    end if;
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

drop policy if exists attendance_records_select_student_self on public.attendance_records;
create policy attendance_records_select_scoped on public.attendance_records for select to authenticated
  using (exists(select 1 from public.student_records sr where sr.id=attendance_records.student_id and sr.school_id=attendance_records.school_id and sr.auth_user_id=(select auth.uid()))
    or (private.has_school_permission(school_id,'attendance.read') and ((not private.is_school_role(school_id,'TEACHER')) or private.require_teacher_student_access(school_id,student_id)))
    or exists(select 1 from public.guardian_relationships gr join public.guardian_relationship_permissions gp on gp.school_id=gr.school_id and gp.guardian_relationship_id=gr.id and gp.student_id=gr.student_id and gp.permission_key='attendance.read' and gp.status='active' and (gp.expires_at is null or gp.expires_at>now()) join public.persons p on p.id=gr.guardian_person_id join public.school_memberships sm on sm.school_id=gr.school_id and sm.id=gr.guardian_school_membership_id and sm.person_id=gr.guardian_person_id where gr.school_id=attendance_records.school_id and gr.student_id=attendance_records.student_id and gr.status='active' and gr.guardian_auth_user_id=(select auth.uid()) and p.auth_user_id=(select auth.uid()) and p.status='active' and sm.status='active' and (gr.valid_until is null or gr.valid_until>now())));

create policy staff_attendance_records_select_authorized on public.staff_attendance_records for select to authenticated
  using (exists(select 1 from public.staff_records sr join public.persons p on p.id=sr.person_id where sr.id=staff_attendance_records.staff_record_id and sr.school_id=staff_attendance_records.school_id and p.auth_user_id=(select auth.uid()))
    or private.has_school_permission(school_id,'attendance.staff.read'));

grant select on public.attendance_scan_events,public.attendance_correction_audit to authenticated;
create policy attendance_scan_events_select_authorized on public.attendance_scan_events for select to authenticated
  using (private.has_school_permission(school_id,'attendance.read') and ((not private.is_school_role(school_id,'TEACHER')) or (student_id is not null and private.require_teacher_student_access(school_id,student_id))));
create policy attendance_correction_audit_select_authorized on public.attendance_correction_audit for select to authenticated
  using (private.has_school_permission(school_id,'attendance.correct'));
