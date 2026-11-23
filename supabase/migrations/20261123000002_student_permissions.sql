-- ============================================================
-- Student Exit Permissions Module
-- Tracks when and why a student is authorized to leave school grounds
-- ============================================================

-- ── Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_permissions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id              uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_record_id      uuid        NOT NULL,
  permission_type        text        NOT NULL,
  reason                 text        NOT NULL,
  granted_by_auth_user_id uuid       NOT NULL,
  granted_by_name        text        NOT NULL DEFAULT '',
  granted_at             timestamptz NOT NULL DEFAULT now(),
  valid_from             timestamptz NOT NULL DEFAULT now(),
  valid_until            timestamptz,          -- NULL = no expiry set
  status                 text        NOT NULL DEFAULT 'active',
  revoked_at             timestamptz,
  revoked_by_name        text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_permissions_type_check
    CHECK (permission_type IN ('go_home','go_out','medical','other')),
  CONSTRAINT student_permissions_status_check
    CHECK (status IN ('active','revoked','expired'))
);

CREATE INDEX IF NOT EXISTS idx_student_permissions_student
  ON public.student_permissions(school_id, student_record_id, status, granted_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_permissions_today
  ON public.student_permissions(school_id, granted_at DESC);

ALTER TABLE public.student_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_read_permissions"
  ON public.student_permissions FOR SELECT
  USING (private.has_school_permission(school_id, 'permissions.read'));

CREATE POLICY "school_grant_permissions"
  ON public.student_permissions FOR INSERT
  WITH CHECK (
    granted_by_auth_user_id = auth.uid()
    AND private.has_school_permission(school_id, 'permissions.manage')
  );

CREATE POLICY "school_update_permissions"
  ON public.student_permissions FOR UPDATE
  USING (private.has_school_permission(school_id, 'permissions.manage'));

-- ── Permission catalog entries ───────────────────────────────
INSERT INTO private.permission_catalog (scope, permission_key, description, is_sensitive)
VALUES
  ('school', 'permissions.read',   'View student exit permissions',           true),
  ('school', 'permissions.manage', 'Grant and revoke student exit permissions', true)
ON CONFLICT (scope, permission_key) DO NOTHING;

-- ── Role grants ───────────────────────────────────────────────
-- ADMIN and SCHOOL_MANAGER auto-inherit all school permissions (via cross join in seed)
-- so we only need to seed the domain roles explicitly
INSERT INTO private.role_permissions (scope, role_key, permission_key)
VALUES
  ('school', 'TEACHER',    'permissions.read'),
  ('school', 'TEACHER',    'permissions.manage'),
  ('school', 'DISCIPLINE', 'permissions.read'),
  ('school', 'DISCIPLINE', 'permissions.manage'),
  ('school', 'GATEKEEPER', 'permissions.read'),
  ('school', 'NURSE',      'permissions.read')
ON CONFLICT DO NOTHING;

-- ── Grant permission RPC ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_student_permission(
  p_school_id         uuid,
  p_student_record_id uuid,
  p_permission_type   text,
  p_reason            text,
  p_valid_until       timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private
AS $$
DECLARE
  v_name text;
  v_id   uuid;
BEGIN
  IF NOT private.has_school_permission(p_school_id, 'permissions.manage') THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;
  IF p_permission_type NOT IN ('go_home','go_out','medical','other') THEN
    RAISE EXCEPTION 'invalid permission type' USING errcode = '22023';
  END IF;
  IF length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'reason is too short' USING errcode = '22023';
  END IF;

  SELECT coalesce(ppi.legal_name, sm.auth_user_id::text)
  INTO v_name
  FROM public.school_memberships sm
  LEFT JOIN public.persons p2 ON p2.auth_user_id = sm.auth_user_id
  LEFT JOIN private.person_private_identity ppi ON ppi.person_id = p2.id
  WHERE sm.school_id = p_school_id
    AND sm.auth_user_id = auth.uid()
    AND sm.is_active = true
  LIMIT 1;

  INSERT INTO public.student_permissions(
    school_id, student_record_id, permission_type, reason,
    granted_by_auth_user_id, granted_by_name, valid_until
  ) VALUES (
    p_school_id, p_student_record_id, p_permission_type, trim(p_reason),
    auth.uid(), coalesce(v_name, 'Staff'), p_valid_until
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_student_permission(uuid,uuid,text,text,timestamptz)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.grant_student_permission(uuid,uuid,text,text,timestamptz)
  TO authenticated;

-- ── Revoke permission RPC ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_student_permission(
  p_school_id     uuid,
  p_permission_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private
AS $$
DECLARE v_name text;
BEGIN
  IF NOT private.has_school_permission(p_school_id, 'permissions.manage') THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;
  SELECT coalesce(ppi.legal_name, sm.auth_user_id::text)
  INTO v_name
  FROM public.school_memberships sm
  LEFT JOIN public.persons p2 ON p2.auth_user_id = sm.auth_user_id
  LEFT JOIN private.person_private_identity ppi ON ppi.person_id = p2.id
  WHERE sm.school_id = p_school_id AND sm.auth_user_id = auth.uid() AND sm.is_active = true
  LIMIT 1;

  UPDATE public.student_permissions
  SET status = 'revoked', revoked_at = now(), revoked_by_name = coalesce(v_name, 'Staff')
  WHERE id = p_permission_id AND school_id = p_school_id AND status = 'active';
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_student_permission(uuid,uuid)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.revoke_student_permission(uuid,uuid)
  TO authenticated;

-- ── Get permissions for a student RPC ───────────────────────
CREATE OR REPLACE FUNCTION public.get_student_permissions(
  p_school_id         uuid,
  p_student_record_id uuid
)
RETURNS TABLE (
  id               uuid,
  permission_type  text,
  reason           text,
  granted_by_name  text,
  granted_at       timestamptz,
  valid_from       timestamptz,
  valid_until      timestamptz,
  status           text,
  revoked_by_name  text,
  revoked_at       timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_school_permission(p_school_id, 'permissions.read') THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;
  -- Auto-expire passed permissions
  UPDATE public.student_permissions
  SET status = 'expired'
  WHERE school_id = p_school_id
    AND student_record_id = p_student_record_id
    AND status = 'active'
    AND valid_until IS NOT NULL
    AND valid_until < now();

  RETURN QUERY
  SELECT sp.id, sp.permission_type, sp.reason, sp.granted_by_name,
         sp.granted_at, sp.valid_from, sp.valid_until, sp.status,
         sp.revoked_by_name, sp.revoked_at
  FROM public.student_permissions sp
  WHERE sp.school_id = p_school_id
    AND sp.student_record_id = p_student_record_id
    AND sp.granted_at > now() - interval '24 hours'
  ORDER BY sp.granted_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_student_permissions(uuid,uuid)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_student_permissions(uuid,uuid)
  TO authenticated;

-- ── List today's permissions (school-wide) RPC ──────────────
CREATE OR REPLACE FUNCTION public.list_today_permissions(
  p_school_id uuid,
  p_limit     int DEFAULT 100
)
RETURNS TABLE (
  id                 uuid,
  student_record_id  uuid,
  student_name       text,
  class_name         text,
  profile_photo_path text,
  permission_type    text,
  reason             text,
  granted_by_name    text,
  granted_at         timestamptz,
  valid_until        timestamptz,
  status             text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_school_permission(p_school_id, 'permissions.read') THEN
    RAISE EXCEPTION 'not authorised' USING errcode = '42501';
  END IF;
  -- Auto-expire passed permissions in bulk
  UPDATE public.student_permissions
  SET status = 'expired'
  WHERE school_id = p_school_id
    AND status = 'active'
    AND valid_until IS NOT NULL
    AND valid_until < now();

  RETURN QUERY
  SELECT
    sp.id,
    sp.student_record_id,
    coalesce(ppi.legal_name, sr.admission_number)::text,
    coalesce(cs.name, '')::text,
    sr.profile_photo_path,
    sp.permission_type,
    sp.reason,
    sp.granted_by_name,
    sp.granted_at,
    sp.valid_until,
    sp.status
  FROM public.student_permissions sp
  JOIN public.student_records sr ON sr.id = sp.student_record_id
  LEFT JOIN private.person_private_identity ppi ON ppi.person_id = sr.person_id
  LEFT JOIN public.student_enrollments se
    ON se.student_id = sr.id AND se.is_current = true
  LEFT JOIN public.student_class_placements scp
    ON scp.enrollment_id = se.id AND scp.is_active = true
  LEFT JOIN public.class_sections cs ON cs.id = scp.class_section_id
  WHERE sp.school_id = p_school_id
    AND sp.granted_at > now() - interval '24 hours'
  ORDER BY sp.granted_at DESC
  LIMIT p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.list_today_permissions(uuid,int)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_today_permissions(uuid,int)
  TO authenticated;
