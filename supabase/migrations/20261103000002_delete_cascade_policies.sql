-- Delete RLS policies for academic structures and staff
create policy education_levels_delete_managed on public.education_levels
  for delete to authenticated
  using (private.has_school_permission(school_id, 'academics.manage'));

create policy class_sections_delete_managed on public.class_sections
  for delete to authenticated
  using (private.has_school_permission(school_id, 'academics.manage'));

-- Cascade delete a class section (removes placements, assignments, subjects first)
create or replace function public.delete_class_section(
  p_school_id       uuid,
  p_class_section_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_school_actor(p_school_id, 'academics.manage');
  delete from public.student_class_placements
    where school_id = p_school_id and class_section_id = p_class_section_id;
  delete from public.teacher_assignments
    where school_id = p_school_id and class_section_id = p_class_section_id;
  delete from public.class_subjects
    where school_id = p_school_id and class_section_id = p_class_section_id;
  delete from public.class_sections
    where id = p_class_section_id and school_id = p_school_id;
end;
$$;
alter function public.delete_class_section(uuid,uuid) owner to postgres;
revoke all on function public.delete_class_section(uuid,uuid) from public, anon;
grant execute on function public.delete_class_section(uuid,uuid) to authenticated, service_role;

-- Cascade delete an education level (deletes all its class sections first)
create or replace function public.delete_education_level(
  p_school_id  uuid,
  p_level_id   uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare v_class_id uuid;
begin
  perform private.require_school_actor(p_school_id, 'academics.manage');
  for v_class_id in (
    select id from public.class_sections
    where school_id = p_school_id and education_level_id = p_level_id
  ) loop
    perform public.delete_class_section(p_school_id, v_class_id);
  end loop;
  delete from public.education_levels
    where id = p_level_id and school_id = p_school_id;
end;
$$;
alter function public.delete_education_level(uuid,uuid) owner to postgres;
revoke all on function public.delete_education_level(uuid,uuid) from public, anon;
grant execute on function public.delete_education_level(uuid,uuid) to authenticated, service_role;
