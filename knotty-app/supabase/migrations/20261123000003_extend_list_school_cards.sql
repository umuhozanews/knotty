-- Extend list_school_cards to include card_number and wallet_balance so the
-- Cards page can display and manage all school cards without hitting the
-- card_assignments RLS policy (which only allows cardholders to see their own card).
CREATE OR REPLACE FUNCTION public.list_school_cards(p_school_id uuid)
RETURNS TABLE(
  card_assignment_id uuid,
  holder_kind        text,
  student_id         uuid,
  staff_record_id    uuid,
  status             text,
  issued_at          timestamptz,
  activated_at       timestamptz,
  card_number        text,
  wallet_balance     numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT
    ca.id,
    ca.holder_kind,
    ca.student_id,
    ca.staff_record_id,
    ca.status,
    ca.issued_at,
    ca.activated_at,
    ca.card_number,
    ca.wallet_balance
  FROM public.card_assignments ca
  WHERE ca.school_id = p_school_id
    AND private.has_school_permission(p_school_id, 'cards.read');
$$;
