-- Admin-level student roster with contact, class/level, and card data.
-- Replaces the lightweight list_student_roster for the management UI.
-- Uses security definer so postgres can read private schema tables; the
-- caller's permission is still enforced via has_school_permission().

create or replace function public.list_school_students(
  p_school_id        uuid,
  p_class_section_id uuid    default null,
  p_search           text    default null
)
returns table(
  student_id           uuid,
  admission_number     text,
  legal_name           text,
  date_of_birth        date,
  gender               text,
  nationality          text,
  student_status       text,
  admission_date       date,
  profile_photo_path   text,
  primary_email        text,
  primary_phone        text,
  class_section_id     uuid,
  class_section_name   text,
  education_level_id   uuid,
  education_level_name text,
  card_assignment_id   uuid,
  card_number          text,
  card_status          text
)
language sql stable security definer set search_path = ''
as $$
  select
    sr.id                                  as student_id,
    sr.admission_number,
    coalesce(pi.legal_name, '')            as legal_name,
    sr.date_of_birth,
    sr.gender,
    sr.nationality,
    sr.status                              as student_status,
    sr.admission_date,
    sr.profile_photo_path,
    (
      select cp.contact_value
        from private.person_contact_points cp
       where cp.person_id = sr.person_id
         and cp.contact_type = 'email'
       order by cp.is_primary desc, cp.created_at asc
       limit 1
    )                                      as primary_email,
    (
      select cp.contact_value
        from private.person_contact_points cp
       where cp.person_id = sr.person_id
         and cp.contact_type = 'phone'
       order by cp.is_primary desc, cp.created_at asc
       limit 1
    )                                      as primary_phone,
    cs.id                                  as class_section_id,
    cs.name                                as class_section_name,
    el.id                                  as education_level_id,
    el.name                                as education_level_name,
    ca.id                                  as card_assignment_id,
    ca.card_number,
    ca.status                              as card_status
  from public.student_records sr
  join private.person_private_identity pi on pi.person_id = sr.person_id
  -- Most-recent active enrollment for this student in this school
  left join lateral (
    select se2.id as enrollment_id, se2.academic_year_id
      from public.student_enrollments se2
     where se2.school_id = sr.school_id
       and se2.student_id = sr.id
       and se2.status = 'enrolled'
     order by se2.enrolled_at desc
     limit 1
  ) se on true
  -- Active class placement under that enrollment
  left join lateral (
    select scp2.class_section_id
      from public.student_class_placements scp2
     where se.enrollment_id is not null
       and scp2.school_id = sr.school_id
       and scp2.enrollment_id = se.enrollment_id
       and scp2.status = 'active'
     order by scp2.created_at desc
     limit 1
  ) scp on true
  left join public.class_sections cs
    on cs.id = scp.class_section_id
   and cs.school_id = sr.school_id
  left join public.education_levels el
    on el.id = cs.education_level_id
   and el.school_id = sr.school_id
  -- Most-recent non-revoked/replaced card for this student
  left join lateral (
    select ca2.id, ca2.card_number, ca2.status
      from public.card_assignments ca2
     where ca2.student_id = sr.id
       and ca2.school_id = sr.school_id
       and ca2.holder_kind = 'student'
       and ca2.status in ('issued', 'active', 'suspended')
     order by ca2.issued_at desc
     limit 1
  ) ca on true
  where sr.school_id = p_school_id
    and sr.status <> 'archived'
    and (p_class_section_id is null or cs.id = p_class_section_id)
    and (
      p_search is null
      or length(trim(p_search)) = 0
      or pi.legal_name ilike '%' || trim(p_search) || '%'
      or sr.admission_number ilike '%' || trim(p_search) || '%'
    )
    and private.has_school_permission(p_school_id, 'students.read_sensitive')
  order by
    coalesce(el.display_order, 999),
    cs.section_code,
    pi.legal_name
$$;

alter function public.list_school_students(uuid, uuid, text) owner to postgres;
revoke all on function public.list_school_students(uuid, uuid, text)
  from public, anon, service_role;
grant execute on function public.list_school_students(uuid, uuid, text) to authenticated;
