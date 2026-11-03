-- Mirror of lookup_card_holder keyed by NFC HMAC digest instead of card_number.
-- Called exclusively by the lookup-card edge function (service_role).
create or replace function public.lookup_card_holder_by_digest(
  p_school_id       uuid,
  p_keyed_digest    bytea,
  p_identifier_kind text default 'nfc_uid'
)
returns table(
  card_assignment_id   uuid,
  card_number          text,
  student_id           uuid,
  legal_name           text,
  class_name           text,
  education_level_name text,
  admission_number     text,
  profile_photo_path   text,
  wallet_balance       numeric,
  card_status          text,
  is_frozen            boolean
)
language sql stable security definer set search_path = ''
as $$
  select
    ca.id                                           as card_assignment_id,
    ca.card_number,
    ca.student_id,
    coalesce(pi.legal_name, '')                     as legal_name,
    coalesce(cs.name, '')                           as class_name,
    coalesce(el.name, '')                           as education_level_name,
    coalesce(sr.admission_number, '')               as admission_number,
    sr.profile_photo_path,
    ca.wallet_balance,
    ca.status                                       as card_status,
    (ca.status = 'suspended')                       as is_frozen
  from public.card_identifiers ci
  join public.card_assignments ca
    on ca.id = ci.card_assignment_id
   and ca.school_id = p_school_id
  join public.student_records sr
    on sr.id = ca.student_id
   and sr.school_id = p_school_id
  left join private.person_private_identity pi
    on pi.person_id = sr.person_id
  left join lateral (
    select scp.class_section_id
    from public.student_class_placements scp
    join public.student_enrollments se on se.id = scp.enrollment_id
    where se.school_id = p_school_id
      and scp.school_id = p_school_id
      and se.student_id = ca.student_id
      and scp.status = 'active'
    order by scp.created_at desc
    limit 1
  ) scp on true
  left join public.class_sections cs  on cs.id = scp.class_section_id
  left join public.education_levels el on el.id = cs.education_level_id
  where ci.school_id = p_school_id
    and ci.keyed_digest = p_keyed_digest
    and ci.identifier_kind = p_identifier_kind
    and ci.status = 'active'
    and ca.holder_kind = 'student'
    and ca.status not in ('revoked', 'replaced')
  limit 1
$$;

revoke all on function public.lookup_card_holder_by_digest(uuid, bytea, text) from public, anon, authenticated;
grant execute on function public.lookup_card_holder_by_digest(uuid, bytea, text) to service_role;
