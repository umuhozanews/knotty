-- When a student is withdrawn, graduated, inactive, or transferred their
-- card assignments must be revoked so the gate lookup can no longer admit
-- them and the card number becomes available for reuse.
create or replace function public.change_student_status(
  p_school_id  uuid,
  p_student_id uuid,
  p_new_status text,
  p_reason     text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor      record;
  v_old_status text;
  v_membership_id uuid;
  v_card       record;
begin
  select * into v_actor from private.require_school_actor(p_school_id, 'students.update');

  if p_new_status not in ('withdrawn','graduated','inactive','transferred')
     or length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'valid terminal lifecycle status and reason required' using errcode = '22023';
  end if;

  select status, school_membership_id
    into v_old_status, v_membership_id
    from public.student_records
   where id = p_student_id and school_id = p_school_id
   for update;

  if not found then
    raise exception 'student not found' using errcode = 'P0002';
  end if;

  if v_old_status in ('withdrawn','graduated') and p_new_status = 'active' then
    raise exception 'terminal student status requires formal re-admission workflow' using errcode = '23514';
  end if;

  update public.student_records
     set status = p_new_status, updated_at = now()
   where id = p_student_id and school_id = p_school_id;

  if p_new_status in ('withdrawn','graduated','inactive') then
    update public.student_class_placements
       set status = 'ended', ends_on = current_date
     where school_id = p_school_id
       and enrollment_id in (
         select id from public.student_enrollments
          where school_id = p_school_id
            and student_id = p_student_id
            and status = 'enrolled'
       );
    update public.student_enrollments
       set status = case
                     when p_new_status = 'graduated'   then 'graduated'
                     when p_new_status = 'transferred' then 'transferred'
                     else 'withdrawn'
                   end,
           ended_at = now(), updated_at = now()
     where school_id = p_school_id
       and student_id = p_student_id
       and status = 'enrolled';
    update public.school_memberships
       set status = 'revoked', ended_at = now(), updated_at = now()
     where id = v_membership_id
       and status in ('active','suspended');
  end if;

  -- Revoke every live card so the gate / canteen cannot admit this student.
  for v_card in
    select id, status
      from public.card_assignments
     where school_id = p_school_id
       and student_id = p_student_id
       and status not in ('revoked','replaced')
  loop
    update public.card_assignments
       set status                  = 'revoked',
           revoked_at              = now(),
           revoked_by_membership_id = v_actor.membership_id,
           revoked_by_person_id    = v_actor.person_id,
           updated_at              = now()
     where id = v_card.id;

    update public.card_identifiers
       set status = 'revoked', ended_at = now()
     where card_assignment_id = v_card.id
       and school_id = p_school_id
       and status = 'active';

    insert into public.card_lifecycle_events(
      school_id, card_assignment_id, event_type,
      prior_status, new_status,
      actor_membership_id, actor_person_id, reason
    ) values (
      p_school_id, v_card.id, 'revoked',
      v_card.status, 'revoked',
      v_actor.membership_id, v_actor.person_id,
      'Auto-revoked: student status changed to ' || p_new_status
    );

    perform private.write_school_audit(
      p_school_id, 'card', v_card.id, 'card_status_changed', 'school',
      v_actor.person_id, null, null, null, v_actor.membership_id,
      jsonb_build_object('from', v_card.status, 'to', 'revoked',
                         'reason', 'student_' || p_new_status)
    );
  end loop;

  perform private.write_school_audit(
    p_school_id, 'student', p_student_id, 'student_status_changed', 'school',
    v_actor.person_id, null, null, null, v_actor.membership_id,
    jsonb_build_object('from', v_old_status, 'to', p_new_status,
                       'reason', btrim(p_reason))
  );
end;
$$;
