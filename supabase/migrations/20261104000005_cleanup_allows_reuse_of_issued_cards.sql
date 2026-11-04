-- Allow re-use of an NFC card whose previous assignment was never activated.
-- A card in 'issued' state was never handed out or scanned — it is just a
-- reservation. Only 'active' and 'suspended' cards are genuinely in use.
-- All other states (issued, lost, damaged, revoked, replaced, retired) are
-- safe to supersede when an admin reassigns the physical card.

create or replace function public.cleanup_stale_card_identifier(
  p_school_id      uuid,
  p_identifier_kind text,
  p_keyed_digest   bytea
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.card_identifiers ci
  using public.card_assignments ca
  where ci.card_assignment_id = ca.id
    and ci.school_id           = p_school_id
    and ci.identifier_kind     = p_identifier_kind
    and ci.keyed_digest        = p_keyed_digest
    -- only keep the entry when the card is actively in use
    and not (ci.status = 'active' and ca.status in ('active', 'suspended'));
end;
$$;

revoke all on function public.cleanup_stale_card_identifier(uuid, text, bytea)
  from public, anon, authenticated;
grant execute on function public.cleanup_stale_card_identifier(uuid, text, bytea)
  to service_role;
