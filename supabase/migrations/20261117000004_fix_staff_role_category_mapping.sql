-- Fix: list_school_staff_members returned 'non_teaching'/'teaching' from
-- staff_record_categories instead of the actual role key (MATERIALS, TEACHER, etc.).
-- Now reads role_key from school_membership_roles first (the authoritative source).

CREATE OR REPLACE FUNCTION public.list_school_staff_members(
  p_school_id uuid
)
RETURNS TABLE(
  staff_record_id    uuid,
  person_id          uuid,
  legal_name         text,
  primary_email      text,
  primary_phone      text,
  primary_role_category text,
  employment_status  text,
  staff_number       text,
  job_title          text,
  department         text,
  hired_on           date,
  profile_photo_path text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    sr.id                                           AS staff_record_id,
    sr.person_id,
    coalesce(pi.legal_name, '')                     AS legal_name,
    (
      SELECT cp.contact_value
        FROM private.person_contact_points cp
       WHERE cp.person_id = sr.person_id
         AND cp.contact_type = 'email'
       ORDER BY cp.is_primary DESC, cp.created_at ASC
       LIMIT 1
    )                                               AS primary_email,
    (
      SELECT cp.contact_value
        FROM private.person_contact_points cp
       WHERE cp.person_id = sr.person_id
         AND cp.contact_type = 'phone'
       ORDER BY cp.is_primary DESC, cp.created_at ASC
       LIMIT 1
    )                                               AS primary_phone,
    coalesce(
      (SELECT smr.role_key
         FROM public.school_membership_roles smr
        WHERE smr.person_id = sr.person_id
          AND smr.school_id = sr.school_id
        ORDER BY smr.assigned_at ASC
        LIMIT 1),
      (SELECT src.category_key
         FROM public.staff_record_categories src
        WHERE src.staff_record_id = sr.id
          AND src.school_id = sr.school_id
        ORDER BY src.assigned_at ASC
        LIMIT 1),
      sr.job_title
    )                                               AS primary_role_category,
    sr.employment_status,
    sr.employee_number                              AS staff_number,
    sr.job_title,
    sr.department,
    sr.hired_on,
    sr.profile_photo_path
  FROM public.staff_records sr
  LEFT JOIN private.person_private_identity pi ON pi.person_id = sr.person_id
  WHERE sr.school_id = p_school_id
    AND private.has_school_permission(p_school_id, 'staff.read')
  ORDER BY coalesce(pi.legal_name, '') ASC;
$$;

ALTER FUNCTION public.list_school_staff_members(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.list_school_staff_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_school_staff_members(uuid) TO authenticated, service_role;
