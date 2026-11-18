-- Lookup a staff card by HMAC digest (same algorithm as student lookup).
-- Called exclusively by the lookup-card edge function (service_role).
CREATE OR REPLACE FUNCTION public.lookup_staff_card_by_digest(
  p_school_id       uuid,
  p_keyed_digest    bytea,
  p_identifier_kind text DEFAULT 'nfc_uid'
)
RETURNS TABLE (
  card_assignment_id  uuid,
  card_number         text,
  staff_record_id     uuid,
  employee_number     text,
  job_title           text,
  department          text,
  employment_status   text,
  legal_name          text,
  profile_photo_path  text,
  card_status         text,
  is_frozen           boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    ca.id                           AS card_assignment_id,
    ca.card_number,
    ca.staff_record_id,
    sr.employee_number,
    sr.job_title,
    sr.department,
    sr.employment_status,
    COALESCE(ppi.legal_name, '')    AS legal_name,
    sr.profile_photo_path,
    ca.status                       AS card_status,
    (ca.status = 'suspended')       AS is_frozen
  FROM public.card_identifiers ci
  JOIN public.card_assignments ca
    ON ca.id = ci.card_assignment_id
   AND ca.school_id = p_school_id
  JOIN public.staff_records sr
    ON sr.id = ca.staff_record_id
   AND sr.school_id = p_school_id
  LEFT JOIN private.person_private_identity ppi
    ON ppi.person_id = sr.person_id
  WHERE ci.school_id    = p_school_id
    AND ci.keyed_digest = p_keyed_digest
    AND ci.identifier_kind = p_identifier_kind
    AND ci.status       = 'active'
    AND ca.holder_kind  = 'staff'
    AND ca.status NOT IN ('revoked', 'replaced')
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.lookup_staff_card_by_digest(uuid, bytea, text) FROM public, anon, authenticated;
GRANT EXECUTE  ON FUNCTION public.lookup_staff_card_by_digest(uuid, bytea, text) TO service_role;
