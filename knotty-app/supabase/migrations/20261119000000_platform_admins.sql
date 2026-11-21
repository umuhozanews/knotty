-- Platform admins table: users who manage the whole platform (all schools)
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: platform admins can only read their own record
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_select_own"
  ON public.platform_admins
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Allow service_role full access (bypasses RLS anyway, this is just explicit)
CREATE POLICY "platform_admins_service_role_all"
  ON public.platform_admins
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- schools: allow platform admins to update status (for approve/suspend)
-- These policies run in addition to existing ones
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'schools' AND policyname = 'platform_admin_manage_schools'
  ) THEN
    CREATE POLICY "platform_admin_manage_schools"
      ON public.schools
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.platform_admins pa
          WHERE pa.auth_user_id = auth.uid() AND pa.is_active = true
        )
      );
  END IF;
END $$;
