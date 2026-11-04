-- Comprehensive cleanup: delete a card_identifiers row when the linked
-- card_assignment is no longer in an active/usable state (lost, damaged,
-- revoked, or replaced). The 'active' identifier status is only kept when
-- the card itself is still live (issued / active / suspended).
-- This prevents the unique constraint on
-- (school_id, identifier_kind, keyed_digest) from firing when re-using a
-- physical NFC card that was previously linked to a non-active card.

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
    -- keep only rows where both the identifier AND the card are still live
    and not (ci.status = 'active' and ca.status in ('active', 'issued', 'suspended'));
end;
$$;

revoke all on function public.cleanup_stale_card_identifier(uuid, text, bytea)
  from public, anon, authenticated;
grant execute on function public.cleanup_stale_card_identifier(uuid, text, bytea)
  to service_role;
