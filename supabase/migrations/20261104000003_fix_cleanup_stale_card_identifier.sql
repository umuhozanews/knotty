-- Fix cleanup_stale_card_identifier to check card_identifiers.status directly.
-- card_identifiers.status is set to 'revoked' when a card is revoked, and
-- 'retired' when a card is replaced. The unique constraint
-- card_identifiers_school_id_identifier_kind_keyed_digest_key fires on ALL
-- rows, so we must delete retired/revoked identifier rows before re-using
-- the same NFC card.

create or replace function public.cleanup_stale_card_identifier(
  p_school_id      uuid,
  p_identifier_kind text,
  p_keyed_digest   bytea
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.card_identifiers
  where school_id       = p_school_id
    and identifier_kind = p_identifier_kind
    and keyed_digest    = p_keyed_digest
    and status in ('revoked', 'retired');
end;
$$;

revoke all on function public.cleanup_stale_card_identifier(uuid, text, bytea)
  from public, anon, authenticated;
grant execute on function public.cleanup_stale_card_identifier(uuid, text, bytea)
  to service_role;
