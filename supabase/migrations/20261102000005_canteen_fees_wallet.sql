-- Canteen, fees, wallet, notifications foundation.
-- Write this migration to disk; do NOT run supabase db push.

-- ── 1. Wallet balance on card ─────────────────────────────────────────────────
alter table public.card_assignments
  add column if not exists wallet_balance numeric(12,2) not null default 0
    check (wallet_balance >= 0);

-- ── 2. Wallet transactions ledger ────────────────────────────────────────────
create table if not exists public.wallet_transactions (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null references public.schools(id) on delete restrict,
  card_assignment_id   uuid not null references public.card_assignments(id) on delete restrict,
  student_id           uuid not null,
  amount               numeric(12,2) not null,
  type                 text not null check (type in ('topup','purchase','refund','adjustment')),
  description          text,
  reference_id         uuid,
  created_by_person_id uuid,
  created_at           timestamptz not null default now()
);
create index if not exists wallet_transactions_card_idx on public.wallet_transactions (school_id, card_assignment_id, created_at desc);
create index if not exists wallet_transactions_student_idx on public.wallet_transactions (school_id, student_id, created_at desc);

-- ── 3. Canteen products ───────────────────────────────────────────────────────
create table if not exists public.canteen_products (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete restrict,
  name       text not null check (length(btrim(name)) > 0),
  price      numeric(10,2) not null check (price >= 0),
  category   text not null default 'Other',
  photo_url  text,
  stock_qty  integer,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists canteen_products_school_idx on public.canteen_products (school_id, is_active, name);

-- ── 4. Canteen transactions ───────────────────────────────────────────────────
create table if not exists public.canteen_transactions (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete restrict,
  student_id            uuid not null,
  card_assignment_id    uuid references public.card_assignments(id) on delete set null,
  items                 jsonb not null default '[]',
  total_amount          numeric(12,2) not null check (total_amount >= 0),
  wallet_balance_before numeric(12,2),
  wallet_balance_after  numeric(12,2),
  status                text not null default 'completed' check (status in ('completed','refunded','failed')),
  created_at            timestamptz not null default now()
);
create index if not exists canteen_transactions_school_date_idx on public.canteen_transactions (school_id, created_at desc);
create index if not exists canteen_transactions_student_idx on public.canteen_transactions (school_id, student_id, created_at desc);

-- ── 5. Fee structures ─────────────────────────────────────────────────────────
create table if not exists public.fee_structures (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete restrict,
  name       text not null check (length(btrim(name)) > 0),
  amount     numeric(12,2) not null check (amount > 0),
  applies_to text[] not null default '{}',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fee_structures_school_idx on public.fee_structures (school_id, is_active);

-- ── 6. Fee invoices ───────────────────────────────────────────────────────────
create table if not exists public.fee_invoices (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete restrict,
  student_id       uuid not null,
  fee_structure_id uuid references public.fee_structures(id) on delete set null,
  title            text not null,
  total_amount     numeric(12,2) not null check (total_amount > 0),
  amount_paid      numeric(12,2) not null default 0 check (amount_paid >= 0),
  due_date         date,
  status           text not null default 'pending'
    check (status in ('pending','partial','paid','overdue','cancelled')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists fee_invoices_school_idx on public.fee_invoices (school_id, status, due_date);
create index if not exists fee_invoices_student_idx on public.fee_invoices (school_id, student_id);

-- ── 7. Fee payments ───────────────────────────────────────────────────────────
create table if not exists public.fee_payments (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null references public.schools(id) on delete restrict,
  invoice_id           uuid not null references public.fee_invoices(id) on delete restrict,
  student_id           uuid not null,
  amount               numeric(12,2) not null check (amount > 0),
  channel              text not null default 'CASH' check (channel in ('CASH','MOMO','BANK','WALLET')),
  phone                text,
  notes                text,
  created_by_person_id uuid,
  created_at           timestamptz not null default now()
);
create index if not exists fee_payments_invoice_idx on public.fee_payments (invoice_id, created_at desc);
create index if not exists fee_payments_school_idx on public.fee_payments (school_id, created_at desc);

-- ── 8. Notifications ──────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete restrict,
  recipient_person_id uuid not null references public.persons(id) on delete cascade,
  title               text not null,
  body                text,
  type                text not null default 'info'
    check (type in ('info','warning','success','payment','attendance','discipline')),
  is_read             boolean not null default false,
  reference_type      text,
  reference_id        uuid,
  created_at          timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_person_id, is_read, created_at desc);
create index if not exists notifications_school_idx on public.notifications (school_id, created_at desc);

-- ── 9. RLS ─────────────────────────────────────────────────────────────────────
alter table public.wallet_transactions enable row level security;
alter table public.wallet_transactions force row level security;

alter table public.canteen_products enable row level security;
alter table public.canteen_products force row level security;

alter table public.canteen_transactions enable row level security;
alter table public.canteen_transactions force row level security;

alter table public.fee_structures enable row level security;
alter table public.fee_structures force row level security;

alter table public.fee_invoices enable row level security;
alter table public.fee_invoices force row level security;

alter table public.fee_payments enable row level security;
alter table public.fee_payments force row level security;

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

-- Helper: active member check
create policy wallet_transactions_read on public.wallet_transactions for select to authenticated
  using (exists (
    select 1 from public.school_memberships sm
    where sm.school_id = wallet_transactions.school_id
      and sm.person_id = (select p.id from public.persons p where p.auth_user_id = auth.uid() limit 1)
      and sm.status = 'active'
  ));

create policy canteen_products_read on public.canteen_products for select to authenticated
  using (exists (
    select 1 from public.school_memberships sm
    where sm.school_id = canteen_products.school_id
      and sm.person_id = (select p.id from public.persons p where p.auth_user_id = auth.uid() limit 1)
      and sm.status = 'active'
  ));

create policy canteen_products_write on public.canteen_products for all to authenticated
  using (exists (
    select 1 from public.school_memberships sm
    where sm.school_id = canteen_products.school_id
      and sm.person_id = (select p.id from public.persons p where p.auth_user_id = auth.uid() limit 1)
      and sm.status = 'active'
  ))
  with check (exists (
    select 1 from public.school_memberships sm
    where sm.school_id = canteen_products.school_id
      and sm.person_id = (select p.id from public.persons p where p.auth_user_id = auth.uid() limit 1)
      and sm.status = 'active'
  ));

create policy canteen_transactions_read on public.canteen_transactions for select to authenticated
  using (exists (
    select 1 from public.school_memberships sm
    where sm.school_id = canteen_transactions.school_id
      and sm.person_id = (select p.id from public.persons p where p.auth_user_id = auth.uid() limit 1)
      and sm.status = 'active'
  ));

create policy fee_structures_read on public.fee_structures for select to authenticated
  using (exists (
    select 1 from public.school_memberships sm
    where sm.school_id = fee_structures.school_id
      and sm.person_id = (select p.id from public.persons p where p.auth_user_id = auth.uid() limit 1)
      and sm.status = 'active'
  ));

create policy fee_structures_write on public.fee_structures for all to authenticated
  using (exists (
    select 1 from public.school_memberships sm
    where sm.school_id = fee_structures.school_id
      and sm.person_id = (select p.id from public.persons p where p.auth_user_id = auth.uid() limit 1)
      and sm.status = 'active'
  ))
  with check (exists (
    select 1 from public.school_memberships sm
    where sm.school_id = fee_structures.school_id
      and sm.person_id = (select p.id from public.persons p where p.auth_user_id = auth.uid() limit 1)
      and sm.status = 'active'
  ));

create policy fee_invoices_read on public.fee_invoices for select to authenticated
  using (exists (
    select 1 from public.school_memberships sm
    where sm.school_id = fee_invoices.school_id
      and sm.person_id = (select p.id from public.persons p where p.auth_user_id = auth.uid() limit 1)
      and sm.status = 'active'
  ));

create policy fee_invoices_write on public.fee_invoices for all to authenticated
  using (exists (
    select 1 from public.school_memberships sm
    where sm.school_id = fee_invoices.school_id
      and sm.person_id = (select p.id from public.persons p where p.auth_user_id = auth.uid() limit 1)
      and sm.status = 'active'
  ))
  with check (exists (
    select 1 from public.school_memberships sm
    where sm.school_id = fee_invoices.school_id
      and sm.person_id = (select p.id from public.persons p where p.auth_user_id = auth.uid() limit 1)
      and sm.status = 'active'
  ));

create policy fee_payments_read on public.fee_payments for select to authenticated
  using (exists (
    select 1 from public.school_memberships sm
    where sm.school_id = fee_payments.school_id
      and sm.person_id = (select p.id from public.persons p where p.auth_user_id = auth.uid() limit 1)
      and sm.status = 'active'
  ));

create policy notifications_own on public.notifications for all to authenticated
  using (
    recipient_person_id = (select p.id from public.persons p where p.auth_user_id = auth.uid() limit 1)
  );

-- ── 10. RPC: lookup_card_holder ───────────────────────────────────────────────
create or replace function public.lookup_card_holder(
  p_school_id  uuid,
  p_card_number text
)
returns table(
  card_assignment_id   uuid,
  card_number          text,
  student_id           uuid,
  legal_name           text,
  class_name           text,
  education_level_name text,
  admission_number     text,
  profile_photo_path   text,
  wallet_balance       numeric,
  card_status          text,
  is_frozen            boolean
)
language sql stable security definer set search_path = ''
as $$
  select
    ca.id                                           as card_assignment_id,
    ca.card_number,
    ca.student_id,
    coalesce(pi.legal_name, '')                     as legal_name,
    coalesce(cs.name, '')                           as class_name,
    coalesce(el.name, '')                           as education_level_name,
    coalesce(sr.admission_number, '')               as admission_number,
    sr.profile_photo_path,
    ca.wallet_balance,
    ca.status                                       as card_status,
    (ca.status = 'suspended')                       as is_frozen
  from public.card_assignments ca
  join public.student_records sr
    on sr.id = ca.student_id
   and sr.school_id = ca.school_id
  left join private.person_private_identity pi
    on pi.person_id = sr.person_id
  left join lateral (
    select scp.class_section_id
    from public.student_class_placements scp
    join public.student_enrollments se on se.id = scp.enrollment_id
    where se.school_id = ca.school_id
      and scp.school_id = ca.school_id
      and se.student_id = ca.student_id
      and scp.status = 'active'
    order by scp.created_at desc
    limit 1
  ) scp on true
  left join public.class_sections cs  on cs.id = scp.class_section_id
  left join public.education_levels el on el.id = cs.education_level_id
  where ca.school_id = p_school_id
    and ca.card_number = p_card_number
    and ca.holder_kind = 'student'
    and ca.status not in ('revoked','replaced')
  limit 1
$$;
revoke all on function public.lookup_card_holder(uuid,text) from public, anon, service_role;
grant execute on function public.lookup_card_holder(uuid,text) to authenticated;

-- ── 11. RPC: top_up_wallet ────────────────────────────────────────────────────
create or replace function public.top_up_wallet(
  p_school_id          uuid,
  p_card_assignment_id uuid,
  p_amount             numeric,
  p_description        text default 'Cash top-up'
)
returns numeric
language plpgsql security definer set search_path = ''
as $$
declare
  v_student_id  uuid;
  v_new_balance numeric;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select student_id into v_student_id
  from public.card_assignments
  where id = p_card_assignment_id and school_id = p_school_id;

  if v_student_id is null then
    raise exception 'Card not found in this school';
  end if;

  update public.card_assignments
  set wallet_balance = wallet_balance + p_amount,
      updated_at = now()
  where id = p_card_assignment_id and school_id = p_school_id
  returning wallet_balance into v_new_balance;

  insert into public.wallet_transactions
    (school_id, card_assignment_id, student_id, amount, type, description)
  values
    (p_school_id, p_card_assignment_id, v_student_id, p_amount, 'topup', p_description);

  return v_new_balance;
end;
$$;
revoke all on function public.top_up_wallet(uuid,uuid,numeric,text) from public, anon, service_role;
grant execute on function public.top_up_wallet(uuid,uuid,numeric,text) to authenticated;

-- ── 12. RPC: canteen_purchase ─────────────────────────────────────────────────
create or replace function public.canteen_purchase(
  p_school_id          uuid,
  p_card_assignment_id uuid,
  p_items              jsonb,
  p_total              numeric
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_student_id      uuid;
  v_balance_before  numeric;
  v_balance_after   numeric;
  v_tx_id           uuid;
begin
  if p_total <= 0 then
    raise exception 'Total must be positive';
  end if;

  select student_id, wallet_balance
  into v_student_id, v_balance_before
  from public.card_assignments
  where id = p_card_assignment_id and school_id = p_school_id
  for update;

  if v_student_id is null then
    raise exception 'Card not found';
  end if;

  if v_balance_before < p_total then
    raise exception 'Insufficient wallet balance (% RWF available)', v_balance_before::int;
  end if;

  update public.card_assignments
  set wallet_balance = wallet_balance - p_total,
      updated_at = now()
  where id = p_card_assignment_id and school_id = p_school_id
  returning wallet_balance into v_balance_after;

  insert into public.canteen_transactions
    (school_id, student_id, card_assignment_id, items, total_amount, wallet_balance_before, wallet_balance_after)
  values
    (p_school_id, v_student_id, p_card_assignment_id, p_items, p_total, v_balance_before, v_balance_after)
  returning id into v_tx_id;

  insert into public.wallet_transactions
    (school_id, card_assignment_id, student_id, amount, type, description, reference_id)
  values
    (p_school_id, p_card_assignment_id, v_student_id, -p_total, 'purchase', 'Canteen purchase', v_tx_id);

  return jsonb_build_object('transaction_id', v_tx_id, 'new_balance', v_balance_after);
end;
$$;
revoke all on function public.canteen_purchase(uuid,uuid,jsonb,numeric) from public, anon, service_role;
grant execute on function public.canteen_purchase(uuid,uuid,jsonb,numeric) to authenticated;

-- ── 13. RPC: pay_fee_invoice ──────────────────────────────────────────────────
create or replace function public.pay_fee_invoice(
  p_school_id  uuid,
  p_invoice_id uuid,
  p_amount     numeric,
  p_channel    text default 'CASH',
  p_phone      text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_student_id  uuid;
  v_total       numeric;
  v_paid        numeric;
  v_new_paid    numeric;
  v_new_status  text;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select student_id, total_amount, amount_paid
  into v_student_id, v_total, v_paid
  from public.fee_invoices
  where id = p_invoice_id and school_id = p_school_id
  for update;

  if v_student_id is null then
    raise exception 'Invoice not found';
  end if;

  v_new_paid := v_paid + p_amount;
  v_new_status := case
    when v_new_paid >= v_total then 'paid'
    when v_new_paid > 0        then 'partial'
    else 'pending'
  end;

  update public.fee_invoices
  set amount_paid = v_new_paid,
      status = v_new_status,
      updated_at = now()
  where id = p_invoice_id;

  insert into public.fee_payments
    (school_id, invoice_id, student_id, amount, channel, phone)
  values
    (p_school_id, p_invoice_id, v_student_id, p_amount, p_channel, p_phone);
end;
$$;
revoke all on function public.pay_fee_invoice(uuid,uuid,numeric,text,text) from public, anon, service_role;
grant execute on function public.pay_fee_invoice(uuid,uuid,numeric,text,text) to authenticated;

-- ── 14. RPC: list_school_staff_members ───────────────────────────────────────
create or replace function public.list_school_staff_members(p_school_id uuid)
returns table(
  staff_record_id      uuid,
  person_id            uuid,
  staff_number         text,
  employment_status    text,
  primary_role_category text,
  started_on           date,
  legal_name           text,
  profile_photo_path   text,
  primary_email        text,
  primary_phone        text
)
language sql stable security definer set search_path = ''
as $$
  select
    sr.id              as staff_record_id,
    sr.person_id,
    sr.staff_number,
    sr.employment_status,
    sr.primary_role_category,
    sr.started_on,
    coalesce(pi.legal_name, '') as legal_name,
    pi.profile_photo_path,
    (
      select cp.contact_value
      from private.person_contact_points cp
      where cp.person_id = sr.person_id and cp.contact_type = 'email'
      order by cp.is_primary desc, cp.created_at asc limit 1
    ) as primary_email,
    (
      select cp.contact_value
      from private.person_contact_points cp
      where cp.person_id = sr.person_id and cp.contact_type = 'phone'
      order by cp.is_primary desc, cp.created_at asc limit 1
    ) as primary_phone
  from public.staff_records sr
  left join private.person_private_identity pi on pi.person_id = sr.person_id
  where sr.school_id = p_school_id
  order by sr.created_at desc
$$;
revoke all on function public.list_school_staff_members(uuid) from public, anon, service_role;
grant execute on function public.list_school_staff_members(uuid) to authenticated;

-- ── 15. RPC: get_my_student_profile ──────────────────────────────────────────
create or replace function public.get_my_student_profile(p_school_id uuid)
returns table(
  student_id           uuid,
  admission_number     text,
  legal_name           text,
  date_of_birth        date,
  gender               text,
  nationality          text,
  student_status       text,
  profile_photo_path   text,
  primary_email        text,
  primary_phone        text,
  class_section_id     uuid,
  class_section_name   text,
  education_level_name text,
  card_assignment_id   uuid,
  card_number          text,
  card_status          text,
  wallet_balance       numeric
)
language sql stable security definer set search_path = ''
as $$
  select
    sr.id                                           as student_id,
    sr.admission_number,
    coalesce(pi.legal_name, '')                     as legal_name,
    sr.date_of_birth,
    sr.gender,
    sr.nationality,
    sr.status                                       as student_status,
    sr.profile_photo_path,
    (
      select cp.contact_value
      from private.person_contact_points cp
      where cp.person_id = sr.person_id and cp.contact_type = 'email'
      order by cp.is_primary desc, cp.created_at asc limit 1
    )                                               as primary_email,
    (
      select cp.contact_value
      from private.person_contact_points cp
      where cp.person_id = sr.person_id and cp.contact_type = 'phone'
      order by cp.is_primary desc, cp.created_at asc limit 1
    )                                               as primary_phone,
    cs.id                                           as class_section_id,
    cs.name                                         as class_section_name,
    el.name                                         as education_level_name,
    ca.id                                           as card_assignment_id,
    ca.card_number,
    ca.status                                       as card_status,
    coalesce(ca.wallet_balance, 0)                  as wallet_balance
  from public.student_records sr
  join public.persons p on p.id = sr.person_id and p.auth_user_id = auth.uid()
  left join private.person_private_identity pi on pi.person_id = sr.person_id
  left join lateral (
    select scp.class_section_id
    from public.student_class_placements scp
    join public.student_enrollments se on se.id = scp.enrollment_id
    where se.school_id = sr.school_id
      and scp.school_id = sr.school_id
      and se.student_id = sr.id
      and scp.status = 'active'
    order by scp.created_at desc
    limit 1
  ) scp on true
  left join public.class_sections cs on cs.id = scp.class_section_id
  left join public.education_levels el on el.id = cs.education_level_id
  left join lateral (
    select ca2.id, ca2.card_number, ca2.status, ca2.wallet_balance
    from public.card_assignments ca2
    where ca2.student_id = sr.id
      and ca2.school_id = sr.school_id
      and ca2.status not in ('revoked','replaced')
    order by ca2.issued_at desc
    limit 1
  ) ca on true
  where sr.school_id = p_school_id
  limit 1
$$;
revoke all on function public.get_my_student_profile(uuid) from public, anon, service_role;
grant execute on function public.get_my_student_profile(uuid) to authenticated;
