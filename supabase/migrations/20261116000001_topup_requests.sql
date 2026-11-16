-- Wallet top-up request lifecycle (Cash and MoMo).
-- A topup_request tracks the full payment lifecycle before the wallet is credited.
-- Only the paypack-webhook Edge Function (service role) may mark a request completed.

create table if not exists public.topup_requests (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null references public.schools(id) on delete restrict,
  card_assignment_id   uuid not null references public.card_assignments(id) on delete restrict,
  student_id           uuid not null,
  amount               numeric(12,2) not null check (amount > 0),
  channel              text not null check (channel in ('CASH','MOMO')),
  status               text not null default 'pending'
    check (status in ('pending','completed','failed','expired')),
  phone                text,
  payment_ref          text,
  provider_ref         text,
  initiated_by_person_id uuid,
  description          text,
  created_at           timestamptz not null default now(),
  completed_at         timestamptz
);

create index if not exists topup_requests_school_idx on public.topup_requests (school_id, status, created_at desc);
create index if not exists topup_requests_card_idx  on public.topup_requests (card_assignment_id, created_at desc);
create index if not exists topup_requests_ref_idx   on public.topup_requests (payment_ref) where payment_ref is not null;

alter table public.topup_requests enable row level security;
alter table public.topup_requests force row level security;

-- Active school members may read top-up requests for their school
create policy topup_requests_read on public.topup_requests for select to authenticated
  using (exists (
    select 1 from public.school_memberships sm
    where sm.school_id = topup_requests.school_id
      and sm.person_id = (select p.id from public.persons p where p.auth_user_id = auth.uid() limit 1)
      and sm.status = 'active'
  ));

-- ── RPC: initiate_cash_topup ──────────────────────────────────────────────────
-- Called by the mobile app (authenticated). Creates a completed topup_request
-- and immediately credits the wallet (cash is collected in person).
create or replace function public.initiate_cash_topup(
  p_school_id          uuid,
  p_card_assignment_id uuid,
  p_amount             numeric,
  p_description        text default 'Cash top-up'
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_student_id  uuid;
  v_new_balance numeric;
  v_request_id  uuid;
  v_person_id   uuid;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  -- Resolve caller person
  select p.id into v_person_id
  from public.persons p
  where p.auth_user_id = auth.uid()
  limit 1;

  -- Verify card belongs to this school and is active
  select student_id into v_student_id
  from public.card_assignments
  where id = p_card_assignment_id
    and school_id = p_school_id
    and status not in ('revoked','replaced');

  if v_student_id is null then
    raise exception 'Card not found or not active in this school';
  end if;

  -- Create completed topup_request record
  insert into public.topup_requests
    (school_id, card_assignment_id, student_id, amount, channel, status,
     initiated_by_person_id, description, completed_at)
  values
    (p_school_id, p_card_assignment_id, v_student_id, p_amount, 'CASH', 'completed',
     v_person_id, p_description, now())
  returning id into v_request_id;

  -- Credit the wallet
  update public.card_assignments
  set wallet_balance = wallet_balance + p_amount,
      updated_at = now()
  where id = p_card_assignment_id and school_id = p_school_id
  returning wallet_balance into v_new_balance;

  insert into public.wallet_transactions
    (school_id, card_assignment_id, student_id, amount, type, description, reference_id, created_by_person_id)
  values
    (p_school_id, p_card_assignment_id, v_student_id, p_amount, 'topup', p_description, v_request_id, v_person_id);

  return jsonb_build_object(
    'request_id', v_request_id,
    'new_balance', v_new_balance,
    'channel', 'CASH'
  );
end;
$$;
revoke all on function public.initiate_cash_topup(uuid,uuid,numeric,text) from public, anon, service_role;
grant execute on function public.initiate_cash_topup(uuid,uuid,numeric,text) to authenticated;

-- ── RPC: create_momo_topup_request ───────────────────────────────────────────
-- Called by initiate-topup Edge Function after Paypack CASHIN is initiated.
-- Returns the request id so the webhook can find it later by payment_ref.
create or replace function public.create_momo_topup_request(
  p_school_id          uuid,
  p_card_assignment_id uuid,
  p_student_id         uuid,
  p_amount             numeric,
  p_phone              text,
  p_payment_ref        text,
  p_initiated_by_person_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.topup_requests
    (school_id, card_assignment_id, student_id, amount, channel, status,
     phone, payment_ref, initiated_by_person_id)
  values
    (p_school_id, p_card_assignment_id, p_student_id, p_amount, 'MOMO', 'pending',
     p_phone, p_payment_ref, p_initiated_by_person_id)
  returning id into v_id;
  return v_id;
end;
$$;
-- Only callable by authenticated (the Edge Function uses caller auth)
revoke all on function public.create_momo_topup_request(uuid,uuid,uuid,numeric,text,text,uuid) from public, anon, service_role;
grant execute on function public.create_momo_topup_request(uuid,uuid,uuid,numeric,text,text,uuid) to authenticated;

-- ── RPC: complete_momo_topup ──────────────────────────────────────────────────
-- Called ONLY by the paypack-webhook Edge Function using service role.
-- Finds the pending request by payment_ref, credits the wallet atomically.
create or replace function public.complete_momo_topup(
  p_payment_ref  text,
  p_provider_ref text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_req          record;
  v_new_balance  numeric;
begin
  -- Lock and fetch the pending request
  select * into v_req
  from public.topup_requests
  where payment_ref = p_payment_ref
    and status = 'pending'
    and channel = 'MOMO'
  for update;

  if not found then
    raise exception 'Pending MoMo top-up request not found for ref %', p_payment_ref;
  end if;

  -- Mark completed
  update public.topup_requests
  set status = 'completed',
      provider_ref = p_provider_ref,
      completed_at = now()
  where id = v_req.id;

  -- Credit the wallet
  update public.card_assignments
  set wallet_balance = wallet_balance + v_req.amount,
      updated_at = now()
  where id = v_req.card_assignment_id
    and school_id = v_req.school_id
  returning wallet_balance into v_new_balance;

  insert into public.wallet_transactions
    (school_id, card_assignment_id, student_id, amount, type, description, reference_id)
  values
    (v_req.school_id, v_req.card_assignment_id, v_req.student_id,
     v_req.amount, 'topup', 'MoMo top-up', v_req.id);

  return jsonb_build_object(
    'request_id', v_req.id,
    'new_balance', v_new_balance,
    'student_id', v_req.student_id
  );
end;
$$;
-- Service role only — never expose to authenticated users
revoke all on function public.complete_momo_topup(text,text) from public, anon, authenticated;
grant execute on function public.complete_momo_topup(text,text) to service_role;

-- ── RPC: get_canteen_sales_summary ───────────────────────────────────────────
create or replace function public.get_canteen_sales_summary(
  p_school_id uuid,
  p_date      date default current_date
)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'total_sales',       coalesce(sum(total_amount), 0),
    'transaction_count', count(*),
    'date',              p_date
  )
  from public.canteen_transactions
  where school_id = p_school_id
    and created_at::date = p_date
    and status = 'completed'
$$;
revoke all on function public.get_canteen_sales_summary(uuid,date) from public, anon, service_role;
grant execute on function public.get_canteen_sales_summary(uuid,date) to authenticated;

-- ── RPC: list_canteen_transactions ───────────────────────────────────────────
create or replace function public.list_canteen_transactions(
  p_school_id uuid,
  p_limit     int default 50,
  p_offset    int default 0
)
returns table(
  id                 uuid,
  student_id         uuid,
  legal_name         text,
  items              jsonb,
  total_amount       numeric,
  wallet_balance_after numeric,
  status             text,
  created_at         timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select
    ct.id,
    ct.student_id,
    coalesce(pi.legal_name, '') as legal_name,
    ct.items,
    ct.total_amount,
    ct.wallet_balance_after,
    ct.status,
    ct.created_at
  from public.canteen_transactions ct
  left join public.student_records sr on sr.id = ct.student_id
  left join private.person_private_identity pi on pi.person_id = sr.person_id
  where ct.school_id = p_school_id
  order by ct.created_at desc
  limit p_limit offset p_offset
$$;
revoke all on function public.list_canteen_transactions(uuid,int,int) from public, anon, service_role;
grant execute on function public.list_canteen_transactions(uuid,int,int) to authenticated;

-- ── RPC: list_topup_requests ──────────────────────────────────────────────────
create or replace function public.list_topup_requests(
  p_school_id uuid,
  p_limit     int default 50,
  p_offset    int default 0
)
returns table(
  id             uuid,
  student_id     uuid,
  legal_name     text,
  amount         numeric,
  channel        text,
  status         text,
  phone          text,
  created_at     timestamptz,
  completed_at   timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select
    tr.id,
    tr.student_id,
    coalesce(pi.legal_name, '') as legal_name,
    tr.amount,
    tr.channel,
    tr.status,
    tr.phone,
    tr.created_at,
    tr.completed_at
  from public.topup_requests tr
  left join public.student_records sr on sr.id = tr.student_id
  left join private.person_private_identity pi on pi.person_id = sr.person_id
  where tr.school_id = p_school_id
  order by tr.created_at desc
  limit p_limit offset p_offset
$$;
revoke all on function public.list_topup_requests(uuid,int,int) from public, anon, service_role;
grant execute on function public.list_topup_requests(uuid,int,int) to authenticated;
