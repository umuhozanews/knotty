-- Auto-resolve the current auth user to their persons.id on insert.
-- This fills created_by_person_id automatically without requiring the client
-- to pass a person UUID it doesn't have.
CREATE OR REPLACE FUNCTION public.current_person_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.persons WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_person_id() TO authenticated;

ALTER TABLE public.material_transactions
  ALTER COLUMN created_by_person_id SET DEFAULT public.current_person_id();
