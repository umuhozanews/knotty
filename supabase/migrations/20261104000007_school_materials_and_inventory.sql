-- ── School Materials & Inventory Management Schema ──────────────────────────────
-- Supports Kitchen, Garden, Catering, Academics, Laboratory, Maintenance, Sports, IT, and Dormitory

CREATE TABLE IF NOT EXISTS public.school_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'kitchen', 'catering', 'garden', 'academics', 'laboratory', 'maintenance', 'sports', 'it_office', 'dormitory'
  )),
  location text NOT NULL DEFAULT 'Central Store',
  unit_of_measure text NOT NULL DEFAULT 'pieces',
  quantity_on_hand numeric NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  min_reorder_level numeric NOT NULL DEFAULT 5 CHECK (min_reorder_level >= 0),
  unit_cost numeric NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  supplier_name text,
  description text,
  status text NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock', 'discontinued')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, item_code)
);

CREATE TABLE IF NOT EXISTS public.material_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.school_materials(id) ON DELETE RESTRICT,
  transaction_type text NOT NULL CHECK (transaction_type IN ('stock_in', 'stock_out', 'damage_disposal', 'return')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  recipient_kind text NOT NULL DEFAULT 'department' CHECK (recipient_kind IN ('staff', 'student', 'department', 'other')),
  recipient_id uuid,
  recipient_name text NOT NULL,
  card_number text,
  department text NOT NULL DEFAULT 'General',
  purpose text NOT NULL,
  batch_or_invoice_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for lightning-fast lookups
CREATE INDEX IF NOT EXISTS idx_school_materials_school_cat ON public.school_materials(school_id, category);
CREATE INDEX IF NOT EXISTS idx_material_transactions_school_mat ON public.material_transactions(school_id, material_id, created_at DESC);

-- Row Level Security
ALTER TABLE public.school_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_materials_school_scoped ON public.school_materials;
CREATE POLICY school_materials_school_scoped ON public.school_materials
  FOR ALL TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM public.school_memberships
      WHERE person_id IN (SELECT id FROM public.persons WHERE auth_user_id = auth.uid())
        AND status = 'active'
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.school_memberships
      WHERE person_id IN (SELECT id FROM public.persons WHERE auth_user_id = auth.uid())
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS material_transactions_school_scoped ON public.material_transactions;
CREATE POLICY material_transactions_school_scoped ON public.material_transactions
  FOR ALL TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM public.school_memberships
      WHERE person_id IN (SELECT id FROM public.persons WHERE auth_user_id = auth.uid())
        AND status = 'active'
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.school_memberships
      WHERE person_id IN (SELECT id FROM public.persons WHERE auth_user_id = auth.uid())
        AND status = 'active'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.school_materials TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.material_transactions TO authenticated;
GRANT ALL ON TABLE public.school_materials, public.material_transactions TO service_role;
