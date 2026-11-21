-- Redeploy list_school_health_records with p_search parameter
-- Migration 20261105000002 was not applied to prod — live DB has old 2-param version

DROP FUNCTION IF EXISTS public.list_school_health_records(uuid, integer);

CREATE OR REPLACE FUNCTION public.list_school_health_records(
  p_school_id uuid,
  p_search    text DEFAULT NULL,
  p_limit     int  DEFAULT 50
)
RETURNS TABLE(
  record_id          uuid,
  type               text,
  title              text,
  description        text,
  treatment_given    text,
  severity           text,
  follow_up_required boolean,
  resolved_at        timestamptz,
  recorded_at        timestamptz,
  student_id         uuid,
  student_name       text,
  student_code       text,
  recorder_name      text,
  student_visit_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    h.id                                         AS record_id,
    h.type,
    h.title,
    h.description,
    h.treatment_given,
    h.severity,
    h.follow_up_required,
    h.resolved_at,
    h.recorded_at,
    sr.id                                        AS student_id,
    coalesce(pi.legal_name, sr.admission_number) AS student_name,
    sr.admission_number                          AS student_code,
    coalesce(rpi.legal_name, '')                 AS recorder_name,
    (
      SELECT COUNT(*) FROM public.health_records hc
       WHERE hc.school_id = p_school_id AND hc.student_id = sr.id
    )                                            AS student_visit_count
  FROM public.health_records h
  JOIN public.student_records              sr  ON sr.id = h.student_id AND sr.school_id = h.school_id
  JOIN public.persons                      p   ON p.id  = sr.person_id
  LEFT JOIN private.person_private_identity pi  ON pi.person_id = p.id
  LEFT JOIN public.persons                 rp  ON rp.auth_user_id = h.recorded_by
  LEFT JOIN private.person_private_identity rpi ON rpi.person_id  = rp.id
  WHERE h.school_id = p_school_id
    AND private.has_school_permission(p_school_id, 'health.read_sensitive')
    AND (
      p_search IS NULL OR length(trim(p_search)) = 0
      OR h.title ILIKE '%' || trim(p_search) || '%'
      OR coalesce(pi.legal_name, '') ILIKE '%' || trim(p_search) || '%'
      OR sr.admission_number ILIKE '%' || trim(p_search) || '%'
    )
  ORDER BY h.recorded_at DESC
  LIMIT least(p_limit, 500);
$$;

GRANT EXECUTE ON FUNCTION public.list_school_health_records(uuid, text, int) TO authenticated;
