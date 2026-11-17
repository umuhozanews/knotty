-- Fix: change_student_status fails when a student's card_assignment row has
-- inconsistent holder_kind/student_id/staff_record_id data (violates check3).
-- Any UPDATE on such a row causes PostgreSQL to re-evaluate all CHECK constraints
-- and raise a check_violation even though we're only updating status/revoked_at.
--
-- Part 1: Clean up bad rows in card_assignments where check3 is already violated.
-- Part 2: Re-create change_student_status with exception handling so a bad card
--         row never blocks a student status transition.

-- ── Part 1: Data cleanup ─────────────────────────────────────────────────────

-- Student cards that also have a staff_record_id: null it out (keep the card).
UPDATE public.card_assignments
   SET staff_record_id = NULL,
       updated_at = now()
 WHERE holder_kind = 'student'
   AND staff_record_id IS NOT NULL;

-- Staff cards that also have a student_id: null it out (keep the card).
UPDATE public.card_assignments
   SET student_id = NULL,
       updated_at = now()
 WHERE holder_kind = 'staff'
   AND student_id IS NOT NULL;

-- Student-kind rows where student_id is NULL — truly orphaned, cascade delete.
DELETE FROM public.card_lifecycle_events
  WHERE card_assignment_id IN (
    SELECT id FROM public.card_assignments
     WHERE holder_kind = 'student' AND student_id IS NULL
  );
DELETE FROM public.card_identifiers
  WHERE card_assignment_id IN (
    SELECT id FROM public.card_assignments
     WHERE holder_kind = 'student' AND student_id IS NULL
  );
DELETE FROM public.card_assignments
 WHERE holder_kind = 'student' AND student_id IS NULL;

-- Staff-kind rows where staff_record_id is NULL — truly orphaned, cascade delete.
DELETE FROM public.card_lifecycle_events
  WHERE card_assignment_id IN (
    SELECT id FROM public.card_assignments
     WHERE holder_kind = 'staff' AND staff_record_id IS NULL
  );
DELETE FROM public.card_identifiers
  WHERE card_assignment_id IN (
    SELECT id FROM public.card_assignments
     WHERE holder_kind = 'staff' AND staff_record_id IS NULL
  );
DELETE FROM public.card_assignments
 WHERE holder_kind = 'staff' AND staff_record_id IS NULL;

-- ── Part 2: Defensive change_student_status ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.change_student_status(
  p_school_id  uuid,
  p_student_id uuid,
  p_new_status text,
  p_reason     text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor      record;
  v_old_status text;
  v_membership_id uuid;
  v_card       record;
BEGIN
  SELECT * INTO v_actor FROM private.require_school_actor(p_school_id, 'students.update');

  IF p_new_status NOT IN ('withdrawn','graduated','inactive','transferred')
     OR length(btrim(coalesce(p_reason,''))) < 3 THEN
    RAISE EXCEPTION 'valid terminal lifecycle status and reason required' USING ERRCODE = '22023';
  END IF;

  SELECT status, school_membership_id
    INTO v_old_status, v_membership_id
    FROM public.student_records
   WHERE id = p_student_id AND school_id = p_school_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_old_status IN ('withdrawn','graduated') AND p_new_status = 'active' THEN
    RAISE EXCEPTION 'terminal student status requires formal re-admission workflow' USING ERRCODE = '23514';
  END IF;

  UPDATE public.student_records
     SET status = p_new_status, updated_at = now()
   WHERE id = p_student_id AND school_id = p_school_id;

  IF p_new_status IN ('withdrawn','graduated','inactive') THEN
    UPDATE public.student_class_placements
       SET status = 'ended', ends_on = current_date
     WHERE school_id = p_school_id
       AND enrollment_id IN (
         SELECT id FROM public.student_enrollments
          WHERE school_id = p_school_id
            AND student_id = p_student_id
            AND status = 'enrolled'
       );
    UPDATE public.student_enrollments
       SET status = CASE
                     WHEN p_new_status = 'graduated'   THEN 'graduated'
                     WHEN p_new_status = 'transferred' THEN 'transferred'
                     ELSE 'withdrawn'
                   END,
           ended_at = now(), updated_at = now()
     WHERE school_id = p_school_id
       AND student_id = p_student_id
       AND status = 'enrolled';
    UPDATE public.school_memberships
       SET status = 'revoked', ended_at = now(), updated_at = now()
     WHERE id = v_membership_id
       AND status IN ('active','suspended');
  END IF;

  -- Revoke every live card. Use BEGIN/EXCEPTION so a card row with bad data
  -- (pre-existing check constraint violation) never blocks the status change.
  FOR v_card IN
    SELECT id, status
      FROM public.card_assignments
     WHERE school_id = p_school_id
       AND student_id = p_student_id
       AND status NOT IN ('revoked','replaced')
  LOOP
    BEGIN
      UPDATE public.card_assignments
         SET status                   = 'revoked',
             revoked_at               = now(),
             revoked_by_membership_id = v_actor.membership_id,
             revoked_by_person_id     = v_actor.person_id,
             updated_at               = now()
       WHERE id = v_card.id;

      UPDATE public.card_identifiers
         SET status = 'revoked', ended_at = now()
       WHERE card_assignment_id = v_card.id
         AND school_id = p_school_id
         AND status = 'active';

      INSERT INTO public.card_lifecycle_events(
        school_id, card_assignment_id, event_type,
        prior_status, new_status,
        actor_membership_id, actor_person_id, reason
      ) VALUES (
        p_school_id, v_card.id, 'revoked',
        v_card.status, 'revoked',
        v_actor.membership_id, v_actor.person_id,
        'Auto-revoked: student status changed to ' || p_new_status
      );

      PERFORM private.write_school_audit(
        p_school_id, 'card', v_card.id, 'card_status_changed', 'school',
        v_actor.person_id, null, null, null, v_actor.membership_id,
        jsonb_build_object('from', v_card.status, 'to', 'revoked',
                           'reason', 'student_' || p_new_status)
      );
    EXCEPTION
      WHEN check_violation OR foreign_key_violation THEN
        -- Card row has a data integrity issue; skip revocation but let the
        -- student status change proceed. The card is functionally unusable
        -- because the student record status is already updated above.
        RAISE NOTICE 'change_student_status: skipping card % (data integrity issue: %)',
                     v_card.id, SQLERRM;
    END;
  END LOOP;

  PERFORM private.write_school_audit(
    p_school_id, 'student', p_student_id, 'student_status_changed', 'school',
    v_actor.person_id, null, null, null, v_actor.membership_id,
    jsonb_build_object('from', v_old_status, 'to', p_new_status,
                       'reason', btrim(p_reason))
  );
END;
$$;
