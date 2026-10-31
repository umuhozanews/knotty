-- The selected v_actor record contains fields id and person_id. Use id as the
-- actor membership reference throughout replacement writes and audit events.
create or replace function public.replace_card_from_edge(
  p_actor_auth_user_id uuid,
  p_school_id uuid,
  p_old_card_id uuid,
  p_identifier_kind text,
  p_identifier_digest bytea,
  p_digest_key_version smallint,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_old public.card_assignments%rowtype;
  v_new_id uuid;
begin
  select sm.id, sm.person_id into v_actor
  from public.school_memberships sm
  join public.persons p on p.id = sm.person_id
  where sm.school_id = p_school_id
    and sm.status = 'active'
    and p.status = 'active'
    and p.auth_user_id = p_actor_auth_user_id;

  if v_actor.id is null
     or not private.has_school_permission_for_user(p_actor_auth_user_id, p_school_id, 'cards.manage') then
    raise exception 'active school actor with card management permission required' using errcode = '42501';
  end if;
  if p_identifier_kind is null
     or p_identifier_kind not in ('nfc_uid', 'qr_token')
     or octet_length(p_identifier_digest) <> 32
     or p_digest_key_version <= 0
     or length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'new card identifier and reason required' using errcode = '22023';
  end if;

  select * into v_old
  from public.card_assignments
  where id = p_old_card_id and school_id = p_school_id
  for update;
  if not found or v_old.status not in ('issued', 'active', 'suspended', 'lost', 'damaged') then
    raise exception 'replaceable card not found in school' using errcode = 'P0002';
  end if;
  if (v_old.holder_kind = 'student' and not exists (
        select 1 from public.student_records
        where id = v_old.student_id and school_id = p_school_id and status = 'active'
      ))
     or (v_old.holder_kind = 'staff' and not exists (
        select 1 from public.staff_records
        where id = v_old.staff_record_id and school_id = p_school_id and employment_status = 'active'
      )) then
    raise exception 'card holder is no longer active' using errcode = '23514';
  end if;

  v_new_id := gen_random_uuid();
  update public.card_assignments
  set status = 'replaced',
      activated_at = coalesce(activated_at, now()),
      suspended_at = null,
      replacement_card_id = v_new_id,
      updated_at = now()
  where id = p_old_card_id;
  update public.card_identifiers
  set status = 'retired', ended_at = now()
  where card_assignment_id = p_old_card_id and school_id = p_school_id and status = 'active';

  insert into public.card_assignments(
    id, school_id, card_number, holder_kind, student_id, staff_record_id,
    status, issued_by_membership_id, issued_by_person_id
  ) values (
    v_new_id, p_school_id, 'CARD-' || replace(gen_random_uuid()::text, '-', ''),
    v_old.holder_kind, v_old.student_id, v_old.staff_record_id, 'issued',
    v_actor.id, v_actor.person_id
  );
  insert into public.card_identifiers(
    school_id, card_assignment_id, identifier_kind, keyed_digest, digest_key_version
  ) values (
    p_school_id, v_new_id, p_identifier_kind, p_identifier_digest, p_digest_key_version
  );
  insert into public.card_lifecycle_events(
    school_id, card_assignment_id, event_type, prior_status, new_status,
    actor_membership_id, actor_person_id, reason, event_data
  ) values (
    p_school_id, p_old_card_id, 'replaced', v_old.status, 'replaced',
    v_actor.id, v_actor.person_id, btrim(p_reason),
    jsonb_build_object('replacement_card_id', v_new_id)
  );
  insert into public.card_lifecycle_events(
    school_id, card_assignment_id, event_type, new_status,
    actor_membership_id, actor_person_id, event_data
  ) values (
    p_school_id, v_new_id, 'issued', 'issued', v_actor.id, v_actor.person_id,
    jsonb_build_object('replaces_card_id', p_old_card_id)
  );
  perform private.write_school_audit(
    p_school_id, 'card', p_old_card_id, 'card_replaced', 'school', v_actor.person_id,
    null, null, null, v_actor.id,
    jsonb_build_object('replacement_card_id', v_new_id, 'reason', btrim(p_reason))
  );
  return v_new_id;
end;
$$;

alter function public.replace_card_from_edge(uuid, uuid, uuid, text, bytea, smallint, text) owner to postgres;
revoke all on function public.replace_card_from_edge(uuid, uuid, uuid, text, bytea, smallint, text) from public, anon, authenticated;
grant execute on function public.replace_card_from_edge(uuid, uuid, uuid, text, bytea, smallint, text) to service_role;
