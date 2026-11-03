-- Allow card issuance and activation for pending students.
-- Students registered by admin start as 'pending' and only become 'active'
-- when they log in for the first time. Admins must be able to issue NFC cards
-- before a student ever logs in, so we relax the status check to accept
-- 'pending' in addition to 'active'.
-- Also adds admin_activate_student so admins can activate students manually.

create or replace function public.issue_card_from_edge(
  p_actor_auth_user_id uuid,p_school_id uuid,p_holder_kind text,p_student_id uuid,
  p_staff_record_id uuid,p_identifier_kind text,
  p_identifier_digest bytea,p_digest_key_version smallint
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_card_id uuid; v_status text;
begin
  if p_actor_auth_user_id is null or p_identifier_kind is null or p_identifier_kind not in ('nfc_uid','qr_token')
     or octet_length(p_identifier_digest)<>32 or p_digest_key_version<=0 then raise exception 'valid actor, serial, identifier kind and digest required' using errcode='22023'; end if;
  select sm.id,sm.person_id into v_actor from public.school_memberships sm join public.persons p on p.id=sm.person_id
    where sm.school_id=p_school_id and sm.status='active' and p.status='active' and p.auth_user_id=p_actor_auth_user_id;
  if v_actor.id is null or not private.has_school_permission_for_user(p_actor_auth_user_id,p_school_id,'cards.issue') then raise exception 'active school actor with card issuance permission required' using errcode='42501'; end if;
  if p_holder_kind='student' and p_student_id is not null and p_staff_record_id is null then
    select status into v_status from public.student_records where id=p_student_id and school_id=p_school_id for share;
    if not found or v_status not in ('active','pending') then raise exception 'enrolled student in this school required' using errcode='23503'; end if;
  elsif p_holder_kind='staff' and p_staff_record_id is not null and p_student_id is null then
    select employment_status into v_status from public.staff_records where id=p_staff_record_id and school_id=p_school_id for share;
    if not found or v_status<>'active' then raise exception 'active staff member in this school required' using errcode='23503'; end if;
  else
    raise exception 'exactly one valid school-scoped holder is required' using errcode='22023';
  end if;
  insert into public.card_assignments(school_id,card_number,holder_kind,student_id,staff_record_id,status,issued_by_membership_id,issued_by_person_id)
    values(p_school_id,'CARD-'||replace(gen_random_uuid()::text,'-',''),p_holder_kind,p_student_id,p_staff_record_id,'issued',v_actor.id,v_actor.person_id) returning id into v_card_id;
  insert into public.card_identifiers(school_id,card_assignment_id,identifier_kind,keyed_digest,digest_key_version)
    values(p_school_id,v_card_id,p_identifier_kind,p_identifier_digest,p_digest_key_version);
  insert into public.card_lifecycle_events(school_id,card_assignment_id,event_type,new_status,actor_membership_id,actor_person_id,event_data)
    values(p_school_id,v_card_id,'issued','issued',v_actor.id,v_actor.person_id,jsonb_build_object('identifier_kind',p_identifier_kind));
  perform private.write_school_audit(p_school_id,'card',v_card_id,'card_issued','school',v_actor.person_id,null,null,null,v_actor.id,jsonb_build_object('holder_kind',p_holder_kind,'identifier_kind',p_identifier_kind));
  return v_card_id;
end;
$$;

create or replace function public.activate_card(p_school_id uuid,p_card_assignment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_card public.card_assignments%rowtype;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'cards.issue');
  select * into v_card from public.card_assignments where id=p_card_assignment_id and school_id=p_school_id for update;
  if not found or v_card.status<>'issued' then raise exception 'issued card not found in school' using errcode='P0002'; end if;
  if (v_card.holder_kind='student' and not exists(select 1 from public.student_records where id=v_card.student_id and school_id=p_school_id and status in ('active','pending')))
     or (v_card.holder_kind='staff' and not exists(select 1 from public.staff_records where id=v_card.staff_record_id and school_id=p_school_id and employment_status='active')) then raise exception 'card holder is no longer active' using errcode='23514'; end if;
  update public.card_assignments set status='active',activated_at=now(),updated_at=now() where id=p_card_assignment_id;
  insert into public.card_lifecycle_events(school_id,card_assignment_id,event_type,prior_status,new_status,actor_membership_id,actor_person_id)
    values(p_school_id,p_card_assignment_id,'activated','issued','active',v_actor.membership_id,v_actor.person_id);
  perform private.write_school_audit(p_school_id,'card',p_card_assignment_id,'card_activated','school',v_actor.person_id,null,null,null,v_actor.membership_id,'{}'::jsonb);
end;
$$;

create or replace function public.admin_activate_student(p_school_id uuid, p_student_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_status text;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'students.manage');
  select status into v_status from public.student_records where id=p_student_id and school_id=p_school_id for update;
  if not found then raise exception 'student not found in this school' using errcode='P0002'; end if;
  if v_status='active' then raise exception 'student is already active' using errcode='23514'; end if;
  if v_status not in ('pending','enrolled') then raise exception 'only pending or enrolled students can be activated' using errcode='23514'; end if;
  update public.student_records set status='active',updated_at=now() where id=p_student_id and school_id=p_school_id;
  perform private.write_school_audit(p_school_id,'student',p_student_id,'student_activated','school',v_actor.person_id,null,null,null,v_actor.membership_id,'{}'::jsonb);
end;
$$;
alter function public.admin_activate_student(uuid,uuid) owner to postgres;
revoke all on function public.admin_activate_student(uuid,uuid) from public,anon,service_role;
grant execute on function public.admin_activate_student(uuid,uuid) to authenticated;
