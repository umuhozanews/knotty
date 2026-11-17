-- ── Materials Management — Full Rebuild ──────────────────────────────────────
-- Drops old tables (wrong schema) and recreates with clean, consistent design.
-- Adds student_assigned_items table and get_student_assigned_items RPC
-- used by the gate terminal.

-- Drop in dependency order
DROP TABLE IF EXISTS public.student_assigned_items CASCADE;
DROP TABLE IF EXISTS public.material_transactions    CASCADE;
DROP TABLE IF EXISTS public.school_materials         CASCADE;

-- ── Inventory items ───────────────────────────────────────────────────────────
CREATE TABLE public.school_materials (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_code       text        NOT NULL,
  name            text        NOT NULL,
  category        text        NOT NULL CHECK (category IN (
    'kitchen', 'catering', 'garden', 'academics', 'laboratory',
    'maintenance', 'sports', 'it_office', 'dormitory'
  )),
  location        text        NOT NULL DEFAULT 'Central Store',
  unit            text        NOT NULL DEFAULT 'pieces',
  quantity        numeric     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity    numeric     NOT NULL DEFAULT 5 CHECK (min_quantity >= 0),
  unit_cost       numeric     NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  supplier        text,
  description     text,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, item_code)
);

-- ── Stock movement log ────────────────────────────────────────────────────────
CREATE TABLE public.material_transactions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id               uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  material_id             uuid        NOT NULL REFERENCES public.school_materials(id) ON DELETE RESTRICT,
  transaction_type        text        NOT NULL CHECK (transaction_type IN (
    'stock_in', 'stock_out', 'damage_disposal', 'return'
  )),
  quantity                numeric     NOT NULL CHECK (quantity > 0),
  unit_cost               numeric     NOT NULL DEFAULT 0,
  total_cost              numeric     NOT NULL DEFAULT 0,
  reference_number        text,
  notes                   text,
  created_by_person_id    uuid        REFERENCES public.persons(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ── Items assigned to individual students ─────────────────────────────────────
CREATE TABLE public.student_assigned_items (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  material_id           uuid        REFERENCES public.school_materials(id) ON DELETE SET NULL,
  student_id            uuid        NOT NULL REFERENCES public.student_records(id) ON DELETE CASCADE,
  item_name             text        NOT NULL,
  quantity              numeric     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  issued_at             timestamptz NOT NULL DEFAULT now(),
  expected_return_at    timestamptz,
  returned_at           timestamptz,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_school_materials_school_cat ON public.school_materials(school_id, category)
  WHERE is_active = true;
CREATE INDEX idx_material_txns_material ON public.material_transactions(material_id, created_at DESC);
CREATE INDEX idx_material_txns_school   ON public.material_transactions(school_id, created_at DESC);
CREATE INDEX idx_student_assigned_items_student
  ON public.student_assigned_items(school_id, student_id)
  WHERE returned_at IS NULL;

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_school_materials_updated_at ON public.school_materials;
CREATE TRIGGER trg_school_materials_updated_at
  BEFORE UPDATE ON public.school_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.school_materials        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_assigned_items  ENABLE ROW LEVEL SECURITY;

-- Helper: returns school_ids the current user is an active member of
CREATE OR REPLACE FUNCTION private.my_school_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sm.school_id
  FROM public.school_memberships sm
  JOIN public.persons p ON p.id = sm.person_id
  WHERE p.auth_user_id = auth.uid() AND sm.status = 'active';
$$;

CREATE POLICY sm_school_scoped ON public.school_materials
  FOR ALL TO authenticated
  USING   (school_id IN (SELECT private.my_school_ids()))
  WITH CHECK (school_id IN (SELECT private.my_school_ids()));

CREATE POLICY mt_school_scoped ON public.material_transactions
  FOR ALL TO authenticated
  USING   (school_id IN (SELECT private.my_school_ids()))
  WITH CHECK (school_id IN (SELECT private.my_school_ids()));

CREATE POLICY sai_school_scoped ON public.student_assigned_items
  FOR ALL TO authenticated
  USING   (school_id IN (SELECT private.my_school_ids()))
  WITH CHECK (school_id IN (SELECT private.my_school_ids()));

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_materials       TO authenticated;
GRANT SELECT, INSERT                 ON public.material_transactions  TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.student_assigned_items TO authenticated;
GRANT ALL ON public.school_materials, public.material_transactions, public.student_assigned_items TO service_role;

-- ── RPC: items currently assigned to a student (used by gate terminal) ────────
CREATE OR REPLACE FUNCTION public.get_student_assigned_items(
  p_school_id  uuid,
  p_student_id uuid
)
RETURNS TABLE (
  id                  uuid,
  item_name           text,
  quantity            numeric,
  issued_at           timestamptz,
  expected_return_at  timestamptz,
  notes               text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    sai.id,
    sai.item_name,
    sai.quantity,
    sai.issued_at,
    sai.expected_return_at,
    sai.notes
  FROM public.student_assigned_items sai
  WHERE sai.school_id = p_school_id
    AND sai.student_id = p_student_id
    AND sai.returned_at IS NULL
  ORDER BY sai.issued_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_assigned_items(uuid, uuid) TO authenticated, service_role;
