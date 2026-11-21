-- 1. Make card identifiers globally unique across all schools.
--    A physical NFC/QR token can only ever belong to one school.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'card_identifiers_school_id_identifier_kind_keyed_digest_key'
      AND conrelid = 'public.card_identifiers'::regclass
  ) THEN
    ALTER TABLE public.card_identifiers
      DROP CONSTRAINT card_identifiers_school_id_identifier_kind_keyed_digest_key;
  END IF;
END $$;

ALTER TABLE public.card_identifiers
  ADD CONSTRAINT card_identifiers_identifier_global_unique
  UNIQUE (identifier_kind, keyed_digest);

-- 2. RPC for looking up auth_user_ids by real contact email.
--    Needed for the synthetic-email login fallback: students/staff have
--    school-scoped synthetic auth emails so a real email can appear in
--    multiple schools without colliding in auth.users.
--    private schema is revoked from service_role, so this must be SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.get_auth_user_ids_for_contact(
  p_contact_email text
) RETURNS TABLE(auth_user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.auth_user_id
  FROM private.person_contact_points pcp
  JOIN public.persons p ON p.id = pcp.person_id
  WHERE pcp.normalized_value = lower(btrim(p_contact_email))
    AND pcp.contact_type = 'email'
    AND p.status = 'active'
    AND p.auth_user_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_ids_for_contact(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_ids_for_contact(text) TO service_role;
