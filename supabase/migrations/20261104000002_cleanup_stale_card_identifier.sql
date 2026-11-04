-- Allows re-use of a physical NFC card (or QR token) that was previously
-- linked to a revoked or replaced card assignment.
-- The edge functions call this before issue_card_from_edge /
-- replace_card_from_edge so the unique constraint on
-- card_identifiers(school_id, identifier_kind, keyed_digest) doesn't fire.

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
    and ca.status in ('revoked', 'replaced');
end;
$$;

revoke all on function public.cleanup_stale_card_identifier(uuid, text, bytea)
  from public, anon, authenticated;
grant execute on function public.cleanup_stale_card_identifier(uuid, text, bytea)
  to service_role;
