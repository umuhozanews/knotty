-- ============================================================
-- KNOTTY / IshuriHUB — Admin User Setup Script
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================
-- STEP 1: Run the DIAGNOSTIC block to see what already exists.
-- STEP 2: Run the CREATE block only for what is missing.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- STEP 1 · DIAGNOSTICS — run this first
-- ────────────────────────────────────────────────────────────

-- 1a. List all auth users (find your email here)
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- 1b. List all schools (you need a school_id for the steps below)
SELECT id, name, code, email
FROM public.schools;

-- 1c. Check if a person row exists for your auth user
--     Replace the email below with yours
SELECT
  u.id   AS auth_user_id,
  u.email,
  p.id   AS person_id,
  p.status
FROM auth.users u
LEFT JOIN public.persons p ON p.auth_user_id = u.id
WHERE u.email = 'ganzaxcelo@gmail.com';   -- ← change if needed

-- 1d. Check school membership
SELECT
  sm.id          AS membership_id,
  sm.school_id,
  sm.person_id,
  sm.status,
  sm.started_at
FROM public.school_memberships sm
JOIN public.persons p ON p.id = sm.person_id
JOIN auth.users u ON u.id = p.auth_user_id
WHERE u.email = 'ganzaxcelo@gmail.com';   -- ← change if needed

-- 1e. Check membership role
SELECT
  smr.id,
  smr.role_key,
  smr.status,
  smr.assigned_at
FROM public.school_membership_roles smr
JOIN public.school_memberships sm ON sm.id = smr.membership_id
JOIN public.persons p ON p.id = sm.person_id
JOIN auth.users u ON u.id = p.auth_user_id
WHERE u.email = 'ganzaxcelo@gmail.com';   -- ← change if needed


-- ────────────────────────────────────────────────────────────
-- STEP 2 · CREATE — run each block only if Step 1 shows it missing
-- ────────────────────────────────────────────────────────────

-- ── 2a. Create person row (skip if 1c already shows a person_id)
--
-- INSERT INTO public.persons (auth_user_id, status)
-- SELECT id, 'active'
-- FROM auth.users
-- WHERE email = 'ganzaxcelo@gmail.com'   -- ← change if needed
-- ON CONFLICT (auth_user_id) DO NOTHING;


-- ── 2b. Create school membership + ADMIN role in one transaction
--       (skip if 1d already shows status = 'active')
--
-- Replace the school_id value with the one from Step 1b.
--
-- DO $$
-- DECLARE
--   v_school_id   uuid := 'PASTE-YOUR-SCHOOL-ID-HERE';
--   v_person_id   uuid;
--   v_membership_id uuid;
-- BEGIN
--   -- resolve person
--   SELECT p.id INTO v_person_id
--   FROM public.persons p
--   JOIN auth.users u ON u.id = p.auth_user_id
--   WHERE u.email = 'ganzaxcelo@gmail.com';   -- ← change if needed
--
--   IF v_person_id IS NULL THEN
--     RAISE EXCEPTION 'Person row not found — run step 2a first';
--   END IF;
--
--   -- create membership
--   INSERT INTO public.school_memberships (school_id, person_id, status, started_at)
--   VALUES (v_school_id, v_person_id, 'active', now())
--   ON CONFLICT DO NOTHING
--   RETURNING id INTO v_membership_id;
--
--   -- if membership already existed, fetch its id
--   IF v_membership_id IS NULL THEN
--     SELECT id INTO v_membership_id
--     FROM public.school_memberships
--     WHERE school_id = v_school_id AND person_id = v_person_id;
--
--     -- make sure it is active
--     UPDATE public.school_memberships
--     SET status = 'active', started_at = COALESCE(started_at, now()), ended_at = NULL
--     WHERE id = v_membership_id;
--   END IF;
--
--   -- create ADMIN role (self-assigned bootstrap)
--   INSERT INTO public.school_membership_roles
--     (school_id, membership_id, person_id, scope, role_key, status,
--      assigned_by_membership_id, assigned_by_person_id)
--   VALUES
--     (v_school_id, v_membership_id, v_person_id, 'school', 'ADMIN', 'active',
--      v_membership_id, v_person_id)
--   ON CONFLICT DO NOTHING;
--
--   RAISE NOTICE 'Done — membership_id: %, person_id: %', v_membership_id, v_person_id;
-- END $$;


-- ── 2c. Verify everything is wired up correctly
SELECT
  u.email,
  p.id           AS person_id,
  p.status       AS person_status,
  sm.id          AS membership_id,
  sm.status      AS membership_status,
  smr.role_key,
  smr.status     AS role_status,
  s.name         AS school_name,
  s.id           AS school_id
FROM auth.users u
JOIN public.persons p             ON p.auth_user_id = u.id
JOIN public.school_memberships sm ON sm.person_id   = p.id
JOIN public.school_membership_roles smr ON smr.membership_id = sm.id
JOIN public.schools s             ON s.id = sm.school_id
WHERE u.email = 'ganzaxcelo@gmail.com'   -- ← change if needed
  AND sm.status  = 'active'
  AND smr.status = 'active';
