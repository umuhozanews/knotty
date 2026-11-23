-- The card_identifiers unique constraint is now global (across all schools).
-- Remove the school_id filter from cleanup so stale entries in ANY school
-- are cleared before a new assignment, not just the current school.
CREATE OR REPLACE FUNCTION public.cleanup_stale_card_identifier(
  p_school_id       uuid,
  p_identifier_kind text,
  p_keyed_digest    bytea
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.card_identifiers ci
  USING public.card_assignments ca
  WHERE ci.card_assignment_id = ca.id
    AND ci.identifier_kind    = p_identifier_kind
    AND ci.keyed_digest       = p_keyed_digest
    -- keep only entries where the physical card is genuinely in-use
    AND NOT (ci.status = 'active' AND ca.status IN ('active', 'suspended'));
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_card_identifier(uuid, text, bytea)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_card_identifier(uuid, text, bytea)
  TO service_role;
