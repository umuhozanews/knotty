-- =============================================================================
-- School dashboard stats RPC (bypasses RLS so admins can see aggregates)
-- and staff session log table
-- =============================================================================

-- ── 1. School overview stats RPC ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_school_dashboard_stats(p_school_id uuid)
RETURNS TABLE (
  total_students      bigint,
  present_today       bigint,
  low_balance_cards   bigint,
  total_teachers      bigint,
  total_workers       bigint,
  total_library_books bigint,
  active_borrows      bigint,
  overdue_books       bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM student_records    WHERE school_id = p_school_id AND status = 'active'),
    (SELECT COUNT(*) FROM attendance_records WHERE school_id = p_school_id AND attendance_date = CURRENT_DATE AND status = 'present'),
    (SELECT COUNT(*) FROM card_assignments   WHERE school_id = p_school_id AND status = 'active' AND wallet_balance < 500),
    (SELECT COUNT(*) FROM staff_records      WHERE school_id = p_school_id AND employment_status = 'active' AND primary_role_category = 'TEACHER'),
    (SELECT COUNT(*) FROM staff_records      WHERE school_id = p_school_id AND employment_status IN ('active','on_leave')),
    (SELECT COUNT(*) FROM library_books      WHERE school_id = p_school_id),
    (SELECT COUNT(*) FROM library_borrow_records WHERE school_id = p_school_id AND returned_at IS NULL),
    (SELECT COUNT(*) FROM library_borrow_records WHERE school_id = p_school_id AND returned_at IS NULL AND due_at < now())
$$;

GRANT EXECUTE ON FUNCTION public.get_school_dashboard_stats(uuid) TO authenticated;

-- ── 2. Add hint_password column to staff_records (stores admin-set password) ──
ALTER TABLE public.staff_records
  ADD COLUMN IF NOT EXISTS hint_password text;

-- ── 3. Staff session log table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_session_logs (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_record_id uuid        REFERENCES public.staff_records(id) ON DELETE CASCADE,
  school_id       uuid        REFERENCES public.schools(id) ON DELETE CASCADE,
  auth_user_id    uuid,
  event_type      text        NOT NULL CHECK (event_type IN ('login', 'logout')),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ssl_staff   ON public.staff_session_logs(staff_record_id);
CREATE INDEX IF NOT EXISTS idx_ssl_school  ON public.staff_session_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_ssl_created ON public.staff_session_logs(created_at DESC);

ALTER TABLE public.staff_session_logs ENABLE ROW LEVEL SECURITY;

-- Staff can insert their own events
DROP POLICY IF EXISTS "staff_can_log_own_session" ON public.staff_session_logs;
CREATE POLICY "staff_can_log_own_session"
ON public.staff_session_logs FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

-- School admins/managers can read all logs for their school
DROP POLICY IF EXISTS "admin_can_read_school_logs" ON public.staff_session_logs;
CREATE POLICY "admin_can_read_school_logs"
ON public.staff_session_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.school_memberships sm
    JOIN public.school_membership_roles smr ON smr.membership_id = sm.id
    JOIN public.persons p ON p.id = sm.person_id
    WHERE p.auth_user_id = auth.uid()
      AND sm.school_id = staff_session_logs.school_id
      AND smr.role_key IN ('ADMIN', 'SCHOOL_MANAGER')
      AND sm.status  = 'active'
      AND smr.status = 'active'
  )
);

-- ── 4. RPC to log a session event (callable from client) ──────────────────────
CREATE OR REPLACE FUNCTION public.log_staff_session(
  p_school_id       uuid,
  p_auth_user_id    uuid,
  p_event_type      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
BEGIN
  -- Look up staff_record_id for this auth user in this school
  SELECT sr.id INTO v_staff_id
  FROM staff_records sr
  JOIN persons p ON p.id = sr.person_id
  WHERE p.auth_user_id = p_auth_user_id
    AND sr.school_id = p_school_id
    AND sr.employment_status IN ('active', 'on_leave')
  LIMIT 1;

  IF v_staff_id IS NULL THEN RETURN; END IF;

  INSERT INTO staff_session_logs(staff_record_id, school_id, auth_user_id, event_type)
  VALUES (v_staff_id, p_school_id, p_auth_user_id, p_event_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_staff_session(uuid, uuid, text) TO authenticated;

-- ── 5. RPC to get staff session logs for a school (admin view) ────────────────
CREATE OR REPLACE FUNCTION public.get_school_session_logs(p_school_id uuid, p_limit int DEFAULT 100)
RETURNS TABLE (
  id              uuid,
  staff_record_id uuid,
  staff_name      text,
  role_key        text,
  event_type      text,
  created_at      timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ssl.id,
    ssl.staff_record_id,
    sr.legal_name AS staff_name,
    sr.primary_role_category AS role_key,
    ssl.event_type,
    ssl.created_at
  FROM staff_session_logs ssl
  JOIN staff_records sr ON sr.id = ssl.staff_record_id
  WHERE ssl.school_id = p_school_id
  ORDER BY ssl.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_session_logs(uuid, int) TO authenticated;
