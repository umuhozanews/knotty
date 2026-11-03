-- Fix admin_activate_student to use students.update permission.
-- The ADMIN role has students.update but not students.manage.

create or replace function public.admin_activate_student(p_school_id uuid, p_student_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_status text;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'students.update');
  select status into v_status from public.student_records where id=p_student_id and school_id=p_school_id for update;
  if not found then raise exception 'student not found in this school' using errcode='P0002'; end if;
  if v_status='active' then raise exception 'student is already active' using errcode='23514'; end if;
  if v_status not in ('pending','enrolled') then raise exception 'only pending or enrolled students can be activated' using errcode='23514'; end if;
  update public.student_records set status='active',updated_at=now() where id=p_student_id and school_id=p_school_id;
  perform private.write_school_audit(p_school_id,'student',p_student_id,'student_activated','school',v_actor.person_id,null,null,null,v_actor.membership_id,'{}'::jsonb);
end;
$$;
