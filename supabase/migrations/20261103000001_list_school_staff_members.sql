-- Staff roster function for the admin/settings UI.
-- Mirrors the pattern in list_school_students: security definer lets
-- postgres read private-schema tables while the caller's permission
-- is still checked via has_school_permission().

create or replace function public.list_school_staff_members(
  p_school_id uuid
)
returns table(
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
language sql stable security definer set search_path = ''
as $$
  select
    sr.id                                           as staff_record_id,
    sr.person_id,
    coalesce(pi.legal_name, '')                     as legal_name,
    (
      select cp.contact_value
        from private.person_contact_points cp
       where cp.person_id = sr.person_id
         and cp.contact_type = 'email'
       order by cp.is_primary desc, cp.created_at asc
       limit 1
    )                                               as primary_email,
    (
      select cp.contact_value
        from private.person_contact_points cp
       where cp.person_id = sr.person_id
         and cp.contact_type = 'phone'
       order by cp.is_primary desc, cp.created_at asc
       limit 1
    )                                               as primary_phone,
    coalesce(
      (select src.category_key
         from public.staff_record_categories src
        where src.staff_record_id = sr.id
          and src.school_id = sr.school_id
        order by src.assigned_at asc
        limit 1),
      sr.job_title
    )                                               as primary_role_category,
    sr.employment_status,
    sr.employee_number                              as staff_number,
    sr.job_title,
    sr.department,
    sr.hired_on,
    sr.profile_photo_path
  from public.staff_records sr
  left join private.person_private_identity pi on pi.person_id = sr.person_id
  where sr.school_id = p_school_id
    and private.has_school_permission(p_school_id, 'staff.read')
  order by coalesce(pi.legal_name, '') asc;
$$;

alter function public.list_school_staff_members(uuid) owner to postgres;
revoke all on function public.list_school_staff_members(uuid) from public, anon;
grant execute on function public.list_school_staff_members(uuid) to authenticated, service_role;
