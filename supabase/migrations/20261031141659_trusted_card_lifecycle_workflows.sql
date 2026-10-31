-- Card lifecycle RPCs and trusted identifier hashing boundary. Raw NFC/QR
-- values are HMACed in the Edge Function and are never stored or returned.

create function public.can_issue_card(p_school_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select (select auth.uid()) is not null and private.has_school_permission(p_school_id,'cards.issue');
$$;
revoke all on function public.can_issue_card(uuid) from public,anon,service_role;
grant execute on function public.can_issue_card(uuid) to authenticated;

create function public.can_manage_cards(p_school_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select (select auth.uid()) is not null and private.has_school_permission(p_school_id,'cards.manage');
$$;
revoke all on function public.can_manage_cards(uuid) from public,anon,service_role;
grant execute on function public.can_manage_cards(uuid) to authenticated;

create function public.issue_card_from_edge(
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
    if not found or v_status<>'active' then raise exception 'active student in this school required' using errcode='23503'; end if;
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
alter function public.issue_card_from_edge(uuid,uuid,text,uuid,uuid,text,bytea,smallint) owner to postgres;
revoke all on function public.issue_card_from_edge(uuid,uuid,text,uuid,uuid,text,bytea,smallint) from public,anon,authenticated;
grant execute on function public.issue_card_from_edge(uuid,uuid,text,uuid,uuid,text,bytea,smallint) to service_role;

create function public.activate_card(p_school_id uuid,p_card_assignment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_card public.card_assignments%rowtype;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'cards.issue');
  select * into v_card from public.card_assignments where id=p_card_assignment_id and school_id=p_school_id for update;
  if not found or v_card.status<>'issued' then raise exception 'issued card not found in school' using errcode='P0002'; end if;
  if (v_card.holder_kind='student' and not exists(select 1 from public.student_records where id=v_card.student_id and school_id=p_school_id and status='active'))
     or (v_card.holder_kind='staff' and not exists(select 1 from public.staff_records where id=v_card.staff_record_id and school_id=p_school_id and employment_status='active')) then raise exception 'card holder is no longer active' using errcode='23514'; end if;
  update public.card_assignments set status='active',activated_at=now(),updated_at=now() where id=p_card_assignment_id;
  insert into public.card_lifecycle_events(school_id,card_assignment_id,event_type,prior_status,new_status,actor_membership_id,actor_person_id)
    values(p_school_id,p_card_assignment_id,'activated','issued','active',v_actor.membership_id,v_actor.person_id);
  perform private.write_school_audit(p_school_id,'card',p_card_assignment_id,'card_activated','school',v_actor.person_id,null,null,null,v_actor.membership_id,'{}'::jsonb);
end;
$$;
alter function public.activate_card(uuid,uuid) owner to postgres;
revoke all on function public.activate_card(uuid,uuid) from public,anon,service_role;
grant execute on function public.activate_card(uuid,uuid) to authenticated;

create function public.change_card_status(p_school_id uuid,p_card_assignment_id uuid,p_new_status text,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_card public.card_assignments%rowtype; v_event text;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'cards.manage');
  if p_new_status not in ('suspended','lost','damaged','revoked','active') or length(btrim(coalesce(p_reason,'')))<3 then raise exception 'valid card state and reason required' using errcode='22023'; end if;
  select * into v_card from public.card_assignments where id=p_card_assignment_id and school_id=p_school_id for update;
  if not found or v_card.status in ('issued','replaced','revoked') then raise exception 'managed active card not found in school' using errcode='P0002'; end if;
  if p_new_status='active' and v_card.status<>'suspended' then raise exception 'only a suspended card can be resumed' using errcode='23514'; end if;
  if p_new_status='suspended' and v_card.status<>'active' then raise exception 'only an active card can be suspended' using errcode='23514'; end if;
  if p_new_status in ('lost','damaged') and v_card.status not in ('active','suspended') then raise exception 'only an active or suspended card can be marked lost or damaged' using errcode='23514'; end if;
  if p_new_status='revoked' and v_card.status not in ('active','suspended','lost','damaged') then raise exception 'card cannot be revoked from its current state' using errcode='23514'; end if;
  update public.card_assignments set status=p_new_status,
    suspended_at=case when p_new_status='suspended' then now() else null end,
    revoked_at=case when p_new_status='revoked' then now() else null end,
    revoked_by_membership_id=case when p_new_status='revoked' then v_actor.membership_id else null end,
    revoked_by_person_id=case when p_new_status='revoked' then v_actor.person_id else null end,
    updated_at=now() where id=p_card_assignment_id;
  if p_new_status='revoked' then update public.card_identifiers set status='revoked',ended_at=now() where card_assignment_id=p_card_assignment_id and school_id=p_school_id and status='active'; end if;
  v_event:=case p_new_status when 'suspended' then 'suspended' when 'active' then 'resumed' when 'lost' then 'reported_lost' when 'damaged' then 'reported_damaged' else 'revoked' end;
  insert into public.card_lifecycle_events(school_id,card_assignment_id,event_type,prior_status,new_status,actor_membership_id,actor_person_id,reason)
    values(p_school_id,p_card_assignment_id,v_event,v_card.status,p_new_status,v_actor.membership_id,v_actor.person_id,btrim(p_reason));
  perform private.write_school_audit(p_school_id,'card',p_card_assignment_id,'card_status_changed','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('from',v_card.status,'to',p_new_status,'reason',btrim(p_reason)));
end;
$$;
alter function public.change_card_status(uuid,uuid,text,text) owner to postgres;
revoke all on function public.change_card_status(uuid,uuid,text,text) from public,anon,service_role;
grant execute on function public.change_card_status(uuid,uuid,text,text) to authenticated;

create function public.replace_card_from_edge(p_actor_auth_user_id uuid,p_school_id uuid,p_old_card_id uuid,p_identifier_kind text,p_identifier_digest bytea,p_digest_key_version smallint,p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_old public.card_assignments%rowtype; v_new_id uuid;
begin
  select sm.id,sm.person_id into v_actor from public.school_memberships sm join public.persons p on p.id=sm.person_id
    where sm.school_id=p_school_id and sm.status='active' and p.status='active' and p.auth_user_id=p_actor_auth_user_id;
  if v_actor.id is null or not private.has_school_permission_for_user(p_actor_auth_user_id,p_school_id,'cards.manage') then raise exception 'active school actor with card management permission required' using errcode='42501'; end if;
  if p_identifier_kind is null or p_identifier_kind not in ('nfc_uid','qr_token') or octet_length(p_identifier_digest)<>32 or p_digest_key_version<=0 or length(btrim(coalesce(p_reason,'')))<3 then raise exception 'new card identifier and reason required' using errcode='22023'; end if;
  select * into v_old from public.card_assignments where id=p_old_card_id and school_id=p_school_id for update;
  if not found or v_old.status not in ('issued','active','suspended','lost','damaged') then raise exception 'replaceable card not found in school' using errcode='P0002'; end if;
  if (v_old.holder_kind='student' and not exists(select 1 from public.student_records where id=v_old.student_id and school_id=p_school_id and status='active'))
     or (v_old.holder_kind='staff' and not exists(select 1 from public.staff_records where id=v_old.staff_record_id and school_id=p_school_id and employment_status='active')) then raise exception 'card holder is no longer active' using errcode='23514'; end if;
  v_new_id:=gen_random_uuid();
  update public.card_assignments set status='replaced',activated_at=coalesce(activated_at,now()),suspended_at=null,replacement_card_id=v_new_id,updated_at=now() where id=p_old_card_id;
  update public.card_identifiers set status='retired',ended_at=now() where card_assignment_id=p_old_card_id and school_id=p_school_id and status='active';
  insert into public.card_assignments(id,school_id,card_number,holder_kind,student_id,staff_record_id,status,issued_by_membership_id,issued_by_person_id)
    values(v_new_id,p_school_id,'CARD-'||replace(gen_random_uuid()::text,'-',''),v_old.holder_kind,v_old.student_id,v_old.staff_record_id,'issued',v_actor.membership_id,v_actor.person_id);
  insert into public.card_identifiers(school_id,card_assignment_id,identifier_kind,keyed_digest,digest_key_version)
    values(p_school_id,v_new_id,p_identifier_kind,p_identifier_digest,p_digest_key_version);
  insert into public.card_lifecycle_events(school_id,card_assignment_id,event_type,prior_status,new_status,actor_membership_id,actor_person_id,reason,event_data)
    values(p_school_id,p_old_card_id,'replaced',v_old.status,'replaced',v_actor.membership_id,v_actor.person_id,btrim(p_reason),jsonb_build_object('replacement_card_id',v_new_id));
  insert into public.card_lifecycle_events(school_id,card_assignment_id,event_type,new_status,actor_membership_id,actor_person_id,event_data)
    values(p_school_id,v_new_id,'issued','issued',v_actor.membership_id,v_actor.person_id,jsonb_build_object('replaces_card_id',p_old_card_id));
  perform private.write_school_audit(p_school_id,'card',p_old_card_id,'card_replaced','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('replacement_card_id',v_new_id,'reason',btrim(p_reason)));
  return v_new_id;
end;
$$;
alter function public.replace_card_from_edge(uuid,uuid,uuid,text,bytea,smallint,text) owner to postgres;
revoke all on function public.replace_card_from_edge(uuid,uuid,uuid,text,bytea,smallint,text) from public,anon,authenticated;
grant execute on function public.replace_card_from_edge(uuid,uuid,uuid,text,bytea,smallint,text) to service_role;

create function public.list_school_cards(p_school_id uuid)
returns table(card_assignment_id uuid,holder_kind text,student_id uuid,staff_record_id uuid,status text,issued_at timestamptz,activated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select ca.id,ca.holder_kind,ca.student_id,ca.staff_record_id,ca.status,ca.issued_at,ca.activated_at
  from public.card_assignments ca where ca.school_id=p_school_id and private.has_school_permission(p_school_id,'cards.read');
$$;
alter function public.list_school_cards(uuid) owner to postgres;
revoke all on function public.list_school_cards(uuid) from public,anon,service_role;
grant execute on function public.list_school_cards(uuid) to authenticated;

drop policy if exists card_assignments_select_holder on public.card_assignments;
create policy card_assignments_select_holder on public.card_assignments for select to authenticated using (
  (holder_kind='student' and exists(select 1 from public.student_records sr where sr.id=card_assignments.student_id and sr.school_id=card_assignments.school_id and sr.auth_user_id=(select auth.uid())))
  or (holder_kind='staff' and exists(select 1 from public.staff_records sr join public.persons p on p.id=sr.person_id where sr.id=card_assignments.staff_record_id and sr.school_id=card_assignments.school_id and p.auth_user_id=(select auth.uid()) and p.status='active'))
);
create policy card_lifecycle_events_select_authorized on public.card_lifecycle_events for select to authenticated
  using (private.has_school_permission(school_id,'cards.read'));

revoke select on table public.card_assignments from authenticated;
grant select(id,school_id,holder_kind,student_id,staff_record_id,status,issued_at,activated_at,suspended_at,revoked_at,replacement_card_id,created_at,updated_at)
  on public.card_assignments to authenticated;
grant select on public.card_lifecycle_events to authenticated;
