-- Add membership check to list_visitor_visits and search_visitor_profiles,
-- and revoke anon from pure read functions (auth is enforced inside).

CREATE OR REPLACE FUNCTION public.search_visitor_profiles(
  p_school_id uuid,
  p_query     text,
  p_limit     int DEFAULT 10
)
RETURNS TABLE (
  visitor_profile_id uuid,
  full_name          text,
  phone              text,
  organization       text,
  id_type            text,
  id_reference       text,
  is_blocked         boolean,
  last_visit_date    date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    vp.id,
    vp.full_name,
    vp.phone,
    vp.organization,
    vp.id_type,
    vp.id_reference,
    vp.is_blocked,
    (SELECT MAX(vv.visit_date) FROM public.visitor_visits vv
      WHERE vv.visitor_profile_id = vp.id AND vv.school_id = vp.school_id)
  FROM public.visitor_profiles vp
  WHERE vp.school_id = p_school_id
    AND (
      vp.full_name ILIKE '%' || p_query || '%'
      OR vp.phone  ILIKE '%' || p_query || '%'
    )
    AND EXISTS(
      SELECT 1 FROM public.school_memberships sm
      JOIN public.persons pr ON pr.id = sm.person_id
      WHERE pr.auth_user_id = (SELECT auth.uid())
        AND sm.school_id = p_school_id
        AND sm.status = 'active'
    )
  ORDER BY vp.full_name ASC
  LIMIT p_limit
$$;

CREATE OR REPLACE FUNCTION public.list_visitor_visits(
  p_school_id uuid,
  p_date      date    DEFAULT CURRENT_DATE,
  p_status    text    DEFAULT NULL,
  p_limit     int     DEFAULT 50
)
RETURNS TABLE (
  visit_id            uuid,
  visitor_profile_id  uuid,
  full_name           text,
  phone               text,
  organization        text,
  pass_reference      text,
  host_name           text,
  host_department     text,
  purpose             text,
  notes               text,
  status              text,
  arrived_at          timestamptz,
  departed_at         timestamptz,
  created_at          timestamptz,
  is_blocked          boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    vv.id,
    vp.id,
    vp.full_name,
    vp.phone,
    vp.organization,
    vv.pass_reference,
    vv.host_name,
    vv.host_department,
    vv.purpose,
    vv.notes,
    vv.status,
    vv.arrived_at,
    vv.departed_at,
    vv.created_at,
    vp.is_blocked
  FROM public.visitor_visits vv
  JOIN public.visitor_profiles vp
    ON vp.id = vv.visitor_profile_id AND vp.school_id = vv.school_id
  WHERE vv.school_id = p_school_id
    AND vv.visit_date = p_date
    AND (p_status IS NULL OR vv.status = p_status)
    AND EXISTS(
      SELECT 1 FROM public.school_memberships sm
      JOIN public.persons pr ON pr.id = sm.person_id
      WHERE pr.auth_user_id = (SELECT auth.uid())
        AND sm.school_id = p_school_id
        AND sm.status = 'active'
    )
  ORDER BY
    CASE vv.status
      WHEN 'inside'   THEN 0
      WHEN 'pending'  THEN 1
      WHEN 'approved' THEN 2
      ELSE 3
    END,
    vv.created_at DESC
  LIMIT p_limit
$$;

-- Revoke anon from read-only functions (they now enforce auth via EXISTS check above,
-- but keeping anon out is defence in depth). Write functions block anon via require_school_actor.
REVOKE EXECUTE ON FUNCTION public.search_visitor_profiles(uuid, text, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_visitor_visits(uuid, date, text, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_gate_overview(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lookup_staff_card_holder(uuid, text) FROM anon;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
