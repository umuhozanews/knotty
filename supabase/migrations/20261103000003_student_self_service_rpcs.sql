-- Student self-service RPCs: each resolves auth.uid() → student_id
-- and returns only that student's own data.

-- ─────────────────────────────────────────────
-- get_my_wallet: card info + balance
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_wallet(p_school_id uuid)
RETURNS TABLE (
  card_number   text,
  card_status   text,
  wallet_balance numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_student_id uuid;
BEGIN
  SELECT sr.id INTO v_student_id
  FROM student_records sr
  JOIN persons p ON p.id = sr.person_id
  WHERE p.auth_user_id = auth.uid() AND sr.school_id = p_school_id
  LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student record not found'; END IF;

  RETURN QUERY
  SELECT ca.card_number, ca.status::text, ca.wallet_balance
  FROM card_assignments ca
  WHERE ca.student_id = v_student_id
    AND ca.school_id = p_school_id
    AND ca.status NOT IN ('replaced','revoked')
  ORDER BY ca.issued_at DESC
  LIMIT 1;
END;
$$;

-- ─────────────────────────────────────────────
-- get_my_transactions: recent wallet activity
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_transactions(
  p_school_id uuid,
  p_limit     int DEFAULT 20
)
RETURNS TABLE (
  txn_id      uuid,
  amount      numeric,
  txn_type    text,
  description text,
  txn_at      timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_student_id uuid;
BEGIN
  SELECT sr.id INTO v_student_id
  FROM student_records sr
  JOIN persons p ON p.id = sr.person_id
  WHERE p.auth_user_id = auth.uid() AND sr.school_id = p_school_id
  LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student record not found'; END IF;

  RETURN QUERY
  SELECT wt.id, wt.amount, wt.type::text, wt.description, wt.created_at
  FROM wallet_transactions wt
  WHERE wt.student_id = v_student_id AND wt.school_id = p_school_id
  ORDER BY wt.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ─────────────────────────────────────────────
-- get_my_attendance: own attendance records
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_attendance(
  p_school_id uuid,
  p_limit     int DEFAULT 90
)
RETURNS TABLE (
  record_id       uuid,
  attendance_date date,
  status          text,
  first_arrived_at timestamptz,
  departed_at     timestamptz,
  source          text,
  recorded_at     timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_student_id uuid;
BEGIN
  SELECT sr.id INTO v_student_id
  FROM student_records sr
  JOIN persons p ON p.id = sr.person_id
  WHERE p.auth_user_id = auth.uid() AND sr.school_id = p_school_id
  LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student record not found'; END IF;

  RETURN QUERY
  SELECT
    ar.id,
    ar.attendance_date::date,
    ar.status::text,
    ar.first_arrived_at,
    ar.departed_at,
    ar.source::text,
    ar.created_at
  FROM attendance_records ar
  WHERE ar.student_id = v_student_id AND ar.school_id = p_school_id
  ORDER BY ar.attendance_date DESC
  LIMIT p_limit;
END;
$$;

-- ─────────────────────────────────────────────
-- get_my_discipline: own discipline records
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_discipline(
  p_school_id uuid,
  p_limit     int DEFAULT 20
)
RETURNS TABLE (
  record_id     uuid,
  type          text,
  title         text,
  description   text,
  action_taken  text,
  severity      text,
  status        text,
  marks_deducted numeric,
  recorded_at   timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_student_id uuid;
BEGIN
  SELECT sr.id INTO v_student_id
  FROM student_records sr
  JOIN persons p ON p.id = sr.person_id
  WHERE p.auth_user_id = auth.uid() AND sr.school_id = p_school_id
  LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student record not found'; END IF;

  RETURN QUERY
  SELECT
    dr.id,
    dr.type,
    dr.title,
    dr.description,
    dr.action_taken,
    dr.severity,
    dr.status,
    dr.marks_deducted,
    dr.created_at
  FROM discipline_records dr
  WHERE dr.student_id = v_student_id AND dr.school_id = p_school_id
  ORDER BY dr.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ─────────────────────────────────────────────
-- get_my_health: own health/nurse records
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_health(
  p_school_id uuid,
  p_limit     int DEFAULT 20
)
RETURNS TABLE (
  record_id         uuid,
  type              text,
  title             text,
  description       text,
  treatment_given   text,
  severity          text,
  follow_up_required boolean,
  resolved_at       timestamptz,
  recorded_at       timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_student_id uuid;
BEGIN
  SELECT sr.id INTO v_student_id
  FROM student_records sr
  JOIN persons p ON p.id = sr.person_id
  WHERE p.auth_user_id = auth.uid() AND sr.school_id = p_school_id
  LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student record not found'; END IF;

  RETURN QUERY
  SELECT
    hr.id,
    hr.type,
    hr.title,
    hr.description,
    hr.treatment_given,
    hr.severity,
    hr.follow_up_required,
    hr.resolved_at,
    hr.created_at
  FROM health_records hr
  WHERE hr.student_id = v_student_id AND hr.school_id = p_school_id
  ORDER BY hr.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ─────────────────────────────────────────────
-- get_my_library_borrows: own book borrows
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_library_borrows(
  p_school_id uuid,
  p_limit     int DEFAULT 20
)
RETURNS TABLE (
  borrow_id    uuid,
  book_title   text,
  book_author  text,
  copy_tag     text,
  borrowed_at  timestamptz,
  due_at       timestamptz,
  returned_at  timestamptz,
  fine_amount  numeric,
  fine_waived  boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_student_id uuid;
BEGIN
  SELECT sr.id INTO v_student_id
  FROM student_records sr
  JOIN persons p ON p.id = sr.person_id
  WHERE p.auth_user_id = auth.uid() AND sr.school_id = p_school_id
  LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student record not found'; END IF;

  RETURN QUERY
  SELECT
    lb.id,
    b.title,
    b.author,
    bc.copy_tag,
    lb.borrowed_at,
    lb.due_at,
    lb.returned_at,
    lb.fine_amount,
    lb.fine_waived
  FROM library_borrows lb
  JOIN book_copies bc ON bc.id = lb.copy_id
  JOIN library_books b ON b.id = bc.book_id
  WHERE lb.student_id = v_student_id AND lb.school_id = p_school_id
  ORDER BY lb.borrowed_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant all to authenticated users (RLS is enforced inside via auth.uid() match)
GRANT EXECUTE ON FUNCTION public.get_my_wallet(uuid)           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_transactions(uuid,int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_attendance(uuid,int)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_discipline(uuid,int)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_health(uuid,int)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_library_borrows(uuid,int) TO authenticated, service_role;
