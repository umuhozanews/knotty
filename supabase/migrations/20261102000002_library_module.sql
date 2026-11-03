-- ── Library Module ─────────────────────────────────────────────────────────
-- Tables: library_books, library_book_copies, library_borrow_records
-- RPCs:   list_library_books, get_library_stats, list_school_borrows,
--         lookup_library_student, student_borrow_history, create_library_book,
--         borrow_book, return_book, renew_borrow, waive_library_fine,
--         list_overdue_borrows

-- ── Tables ──────────────────────────────────────────────────────────────────

create table public.library_books (
  id            uuid        primary key default gen_random_uuid(),
  school_id     uuid        not null references public.schools(id) on delete restrict,
  title         text        not null,
  author        text        not null default 'Unknown',
  isbn          text,
  category      text,
  location      text,
  description   text,
  total_copies  int         not null default 1,
  created_at    timestamptz not null default now(),
  unique (id, school_id),
  constraint library_books_title_nonblank check (length(btrim(title)) > 0),
  constraint library_books_copies_nonneg  check (total_copies >= 0)
);

create index library_books_school_idx
  on public.library_books (school_id, category, created_at desc);

create table public.library_book_copies (
  id         uuid        primary key default gen_random_uuid(),
  book_id    uuid        not null,
  school_id  uuid        not null,
  copy_tag   text        not null,
  status     text        not null default 'available'
               check (status in ('available','borrowed','lost','damaged','withdrawn')),
  condition  text,
  notes      text,
  created_at timestamptz not null default now(),
  unique (id, school_id),
  unique (school_id, copy_tag),
  foreign key (book_id, school_id) references public.library_books (id, school_id) on delete restrict
);

create index library_book_copies_book_idx
  on public.library_book_copies (book_id, school_id, status);

create table public.library_borrow_records (
  id            uuid        primary key default gen_random_uuid(),
  school_id     uuid        not null,
  student_id    uuid        not null,
  copy_id       uuid        not null,
  borrowed_at   timestamptz not null default now(),
  due_at        timestamptz not null,
  returned_at   timestamptz,
  fine_amount   int         not null default 0,
  fine_waived   boolean     not null default false,
  renewed_count int         not null default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (id, school_id),
  foreign key (student_id, school_id) references public.student_records (id, school_id) on delete restrict,
  foreign key (copy_id, school_id)    references public.library_book_copies (id, school_id) on delete restrict,
  constraint library_borrow_fine_nonneg check (fine_amount >= 0)
);

create index library_borrow_records_school_idx
  on public.library_borrow_records (school_id, returned_at, due_at);
create index library_borrow_records_student_idx
  on public.library_borrow_records (school_id, student_id, returned_at);
create index library_borrow_records_copy_idx
  on public.library_borrow_records (copy_id, returned_at);

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.library_books          enable row level security;
alter table public.library_books          force row level security;
alter table public.library_book_copies    enable row level security;
alter table public.library_book_copies    force row level security;
alter table public.library_borrow_records enable row level security;
alter table public.library_borrow_records force row level security;

create policy library_books_select on public.library_books
  for select to authenticated
  using (private.has_school_permission(school_id, 'library.read'));

create policy library_books_write on public.library_books
  for insert to authenticated
  with check (private.has_school_permission(school_id, 'library.manage'));

create policy library_books_update on public.library_books
  for update to authenticated
  using  (private.has_school_permission(school_id, 'library.manage'))
  with check (private.has_school_permission(school_id, 'library.manage'));

create policy library_books_delete on public.library_books
  for delete to authenticated
  using (private.has_school_permission(school_id, 'library.manage'));

create policy library_copies_select on public.library_book_copies
  for select to authenticated
  using (private.has_school_permission(school_id, 'library.read'));

create policy library_copies_write on public.library_book_copies
  for insert to authenticated
  with check (private.has_school_permission(school_id, 'library.manage'));

create policy library_copies_update on public.library_book_copies
  for update to authenticated
  using  (private.has_school_permission(school_id, 'library.manage'))
  with check (private.has_school_permission(school_id, 'library.manage'));

create policy library_borrows_select on public.library_borrow_records
  for select to authenticated
  using (
    private.has_school_permission(school_id, 'library.read')
    or exists (
      select 1 from public.student_records sr
       where sr.id        = library_borrow_records.student_id
         and sr.school_id = library_borrow_records.school_id
         and sr.auth_user_id = (select auth.uid())
    )
  );

create policy library_borrows_write on public.library_borrow_records
  for insert to authenticated
  with check (private.has_school_permission(school_id, 'library.manage'));

create policy library_borrows_update on public.library_borrow_records
  for update to authenticated
  using  (private.has_school_permission(school_id, 'library.manage'))
  with check (private.has_school_permission(school_id, 'library.manage'));

-- ── Grants ───────────────────────────────────────────────────────────────────

revoke all privileges on table public.library_books,
  public.library_book_copies, public.library_borrow_records
  from public, anon, authenticated, service_role;

grant select, insert, update, delete
  on table public.library_books,
     public.library_book_copies,
     public.library_borrow_records
  to authenticated;

-- ── Helper: shared borrow row shape ─────────────────────────────────────────

create type public.library_borrow_row as (
  borrow_id       uuid,
  borrowed_at     timestamptz,
  due_at          timestamptz,
  returned_at     timestamptz,
  fine_amount     int,
  fine_waived     boolean,
  renewed_count   int,
  student_id      uuid,
  student_first   text,
  student_last    text,
  student_code    text,
  copy_id         uuid,
  copy_tag        text,
  book_id         uuid,
  book_title      text,
  book_author     text,
  book_location   text,
  book_isbn       text
);

-- ── RPC: list_library_books ──────────────────────────────────────────────────

create or replace function public.list_library_books(
  p_school_id uuid,
  p_search    text    default null,
  p_category  text    default null,
  p_limit     int     default 100
)
returns table(
  book_id         uuid,
  title           text,
  author          text,
  isbn            text,
  category        text,
  location        text,
  total_copies    int,
  available_copies bigint,
  created_at      timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select
    b.id,
    b.title,
    b.author,
    b.isbn,
    b.category,
    b.location,
    b.total_copies,
    count(c.id) filter (where c.status = 'available') as available_copies,
    b.created_at
  from public.library_books b
  left join public.library_book_copies c
    on c.book_id = b.id and c.school_id = b.school_id
  where b.school_id = p_school_id
    and private.has_school_permission(p_school_id, 'library.read')
    and (
      p_search is null or length(trim(p_search)) = 0
      or b.title  ilike '%' || trim(p_search) || '%'
      or b.author ilike '%' || trim(p_search) || '%'
      or b.isbn   ilike '%' || trim(p_search) || '%'
    )
    and (p_category is null or b.category = p_category)
  group by b.id
  order by b.created_at desc
  limit least(p_limit, 500);
$$;

alter function public.list_library_books(uuid, text, text, int) owner to postgres;
revoke all on function public.list_library_books(uuid, text, text, int)
  from public, anon, service_role;
grant execute on function public.list_library_books(uuid, text, text, int) to authenticated;

-- ── RPC: get_library_stats ───────────────────────────────────────────────────

create or replace function public.get_library_stats(p_school_id uuid)
returns table(
  total_books    bigint,
  total_copies   bigint,
  active_borrows bigint,
  overdue_borrows bigint,
  pending_fees   bigint
)
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*) from public.library_books where school_id = p_school_id)
      as total_books,
    (select count(*) from public.library_book_copies where school_id = p_school_id and status <> 'withdrawn')
      as total_copies,
    (select count(*) from public.library_borrow_records where school_id = p_school_id and returned_at is null)
      as active_borrows,
    (select count(*) from public.library_borrow_records
      where school_id = p_school_id and returned_at is null and due_at < now())
      as overdue_borrows,
    (select coalesce(sum(
        greatest(0, floor(extract(epoch from (now() - due_at)) / 86400)::int) * 200
      ), 0)
      from public.library_borrow_records
      where school_id = p_school_id and returned_at is null and due_at < now()
        and fine_waived = false)
      as pending_fees
  where private.has_school_permission(p_school_id, 'library.read');
$$;

alter function public.get_library_stats(uuid) owner to postgres;
revoke all on function public.get_library_stats(uuid) from public, anon, service_role;
grant execute on function public.get_library_stats(uuid) to authenticated;

-- ── RPC: list_school_borrows ─────────────────────────────────────────────────

create or replace function public.list_school_borrows(
  p_school_id uuid,
  p_status    text    default 'active',
  p_limit     int     default 50
)
returns setof public.library_borrow_row
language sql stable security definer set search_path = ''
as $$
  select
    r.id,
    r.borrowed_at,
    r.due_at,
    r.returned_at,
    r.fine_amount,
    r.fine_waived,
    r.renewed_count,
    r.student_id,
    coalesce(pi.legal_name, '') as student_first,
    ''                          as student_last,
    sr.admission_number         as student_code,
    c.id                        as copy_id,
    c.copy_tag,
    b.id                        as book_id,
    b.title                     as book_title,
    b.author                    as book_author,
    b.location                  as book_location,
    b.isbn                      as book_isbn
  from public.library_borrow_records r
  join public.library_book_copies   c  on c.id = r.copy_id and c.school_id = r.school_id
  join public.library_books         b  on b.id = c.book_id and b.school_id = r.school_id
  join public.student_records       sr on sr.id = r.student_id and sr.school_id = r.school_id
  join public.persons               p  on p.id = sr.person_id
  left join private.person_private_identity pi on pi.person_id = p.id
  where r.school_id = p_school_id
    and private.has_school_permission(p_school_id, 'library.read')
    and (
      p_status = 'active'   and r.returned_at is null
      or p_status = 'returned' and r.returned_at is not null
      or p_status = 'overdue'  and r.returned_at is null and r.due_at < now()
      or p_status = 'all'
    )
  order by r.borrowed_at desc
  limit least(p_limit, 500);
$$;

alter function public.list_school_borrows(uuid, text, int) owner to postgres;
revoke all on function public.list_school_borrows(uuid, text, int)
  from public, anon, service_role;
grant execute on function public.list_school_borrows(uuid, text, int) to authenticated;

-- ── RPC: lookup_library_student ──────────────────────────────────────────────

create or replace function public.lookup_library_student(
  p_school_id  uuid,
  p_identifier text
)
returns table(
  student_id         uuid,
  legal_name         text,
  class_name         text,
  card_number        text,
  admission_number   text,
  profile_photo_path text,
  is_card_active     boolean,
  is_card_frozen     boolean
)
language sql stable security definer set search_path = ''
as $$
  select
    sr.id                   as student_id,
    coalesce(pi.legal_name, sr.admission_number) as legal_name,
    coalesce(cs.name, '')   as class_name,
    ca.card_number,
    sr.admission_number,
    sr.profile_photo_path,
    (ca.status = 'active')  as is_card_active,
    (ca.status = 'suspended') as is_card_frozen
  from public.student_records sr
  join public.persons p on p.id = sr.person_id
  left join private.person_private_identity pi on pi.person_id = p.id
  -- Active enrollment → class placement
  left join lateral (
    select se.id as enrollment_id
      from public.student_enrollments se
     where se.school_id  = sr.school_id
       and se.student_id = sr.id
       and se.status     = 'enrolled'
     order by se.enrolled_at desc
     limit 1
  ) se on true
  left join lateral (
    select scp.class_section_id
      from public.student_class_placements scp
     where scp.school_id    = sr.school_id
       and scp.enrollment_id = se.enrollment_id
       and scp.status        = 'active'
     order by scp.created_at desc
     limit 1
  ) scp on true
  left join public.class_sections cs
    on cs.id = scp.class_section_id and cs.school_id = sr.school_id
  -- Active card
  left join lateral (
    select ca2.card_number, ca2.status
      from public.card_assignments ca2
     where ca2.student_id  = sr.id
       and ca2.school_id   = sr.school_id
       and ca2.holder_kind = 'student'
       and ca2.status in ('issued','active','suspended')
     order by ca2.issued_at desc
     limit 1
  ) ca on true
  where sr.school_id = p_school_id
    and sr.status <> 'archived'
    and private.has_school_permission(p_school_id, 'library.read')
    and (
      -- match card number (strip spaces/hyphens for flexibility)
      regexp_replace(lower(coalesce(ca.card_number, '')),  '[^a-z0-9]', '', 'g')
        = regexp_replace(lower(trim(p_identifier)), '[^a-z0-9]', '', 'g')
      -- or admission number
      or lower(sr.admission_number) = lower(trim(p_identifier))
      -- or partial legal name (at least 3 chars)
      or (length(trim(p_identifier)) >= 3
          and coalesce(pi.legal_name, '') ilike '%' || trim(p_identifier) || '%')
    )
  order by sr.admission_number
  limit 1;
$$;

alter function public.lookup_library_student(uuid, text) owner to postgres;
revoke all on function public.lookup_library_student(uuid, text)
  from public, anon, service_role;
grant execute on function public.lookup_library_student(uuid, text) to authenticated;

-- ── RPC: student_borrow_history ──────────────────────────────────────────────

create or replace function public.student_borrow_history(
  p_school_id  uuid,
  p_student_id uuid,
  p_limit      int default 30
)
returns setof public.library_borrow_row
language sql stable security definer set search_path = ''
as $$
  select
    r.id,
    r.borrowed_at,
    r.due_at,
    r.returned_at,
    r.fine_amount,
    r.fine_waived,
    r.renewed_count,
    r.student_id,
    coalesce(pi.legal_name, '') as student_first,
    ''                          as student_last,
    sr.admission_number         as student_code,
    c.id                        as copy_id,
    c.copy_tag,
    b.id                        as book_id,
    b.title                     as book_title,
    b.author                    as book_author,
    b.location                  as book_location,
    b.isbn                      as book_isbn
  from public.library_borrow_records r
  join public.library_book_copies   c  on c.id = r.copy_id and c.school_id = r.school_id
  join public.library_books         b  on b.id = c.book_id and b.school_id = r.school_id
  join public.student_records       sr on sr.id = r.student_id and sr.school_id = r.school_id
  join public.persons               p  on p.id = sr.person_id
  left join private.person_private_identity pi on pi.person_id = p.id
  where r.school_id  = p_school_id
    and r.student_id = p_student_id
    and (
      private.has_school_permission(p_school_id, 'library.read')
      or exists (
        select 1 from public.student_records s2
         where s2.id = p_student_id
           and s2.school_id = p_school_id
           and s2.auth_user_id = (select auth.uid())
      )
    )
  order by r.borrowed_at desc
  limit least(p_limit, 200);
$$;

alter function public.student_borrow_history(uuid, uuid, int) owner to postgres;
revoke all on function public.student_borrow_history(uuid, uuid, int)
  from public, anon, service_role;
grant execute on function public.student_borrow_history(uuid, uuid, int) to authenticated;

-- ── RPC: list_overdue_borrows ────────────────────────────────────────────────

create or replace function public.list_overdue_borrows(
  p_school_id uuid,
  p_limit     int default 50
)
returns table(
  borrow_id      uuid,
  borrowed_at    timestamptz,
  due_at         timestamptz,
  returned_at    timestamptz,
  fine_amount    int,
  fine_waived    boolean,
  renewed_count  int,
  student_id     uuid,
  student_first  text,
  student_last   text,
  student_code   text,
  copy_id        uuid,
  copy_tag       text,
  book_id        uuid,
  book_title     text,
  book_author    text,
  book_location  text,
  book_isbn      text,
  days_overdue   int,
  accrued_fine   int
)
language sql stable security definer set search_path = ''
as $$
  select
    r.id,
    r.borrowed_at,
    r.due_at,
    r.returned_at,
    r.fine_amount,
    r.fine_waived,
    r.renewed_count,
    r.student_id,
    coalesce(pi.legal_name, '') as student_first,
    ''                          as student_last,
    sr.admission_number         as student_code,
    c.id,
    c.copy_tag,
    b.id,
    b.title,
    b.author,
    b.location,
    b.isbn,
    greatest(1, floor(extract(epoch from (now() - r.due_at)) / 86400)::int) as days_overdue,
    greatest(1, floor(extract(epoch from (now() - r.due_at)) / 86400)::int) * 200 as accrued_fine
  from public.library_borrow_records r
  join public.library_book_copies   c  on c.id = r.copy_id and c.school_id = r.school_id
  join public.library_books         b  on b.id = c.book_id and b.school_id = r.school_id
  join public.student_records       sr on sr.id = r.student_id and sr.school_id = r.school_id
  join public.persons               p  on p.id = sr.person_id
  left join private.person_private_identity pi on pi.person_id = p.id
  where r.school_id   = p_school_id
    and r.returned_at is null
    and r.due_at      < now()
    and private.has_school_permission(p_school_id, 'library.read')
  order by r.due_at asc
  limit least(p_limit, 200);
$$;

alter function public.list_overdue_borrows(uuid, int) owner to postgres;
revoke all on function public.list_overdue_borrows(uuid, int)
  from public, anon, service_role;
grant execute on function public.list_overdue_borrows(uuid, int) to authenticated;

-- ── RPC: create_library_book ─────────────────────────────────────────────────

create or replace function public.create_library_book(
  p_school_id    uuid,
  p_title        text,
  p_author       text        default 'Unknown',
  p_isbn         text        default null,
  p_category     text        default null,
  p_location     text        default null,
  p_total_copies int         default 1
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor  record;
  v_book_id uuid;
  v_tag    text;
  i        int;
begin
  select * into v_actor from private.require_school_actor(p_school_id, 'library.manage');

  if length(btrim(coalesce(p_title, ''))) = 0 then
    raise exception 'book title is required' using errcode = '22023';
  end if;
  if p_total_copies < 1 or p_total_copies > 99 then
    raise exception 'total_copies must be between 1 and 99' using errcode = '22023';
  end if;

  insert into public.library_books(school_id, title, author, isbn, category, location, total_copies)
  values (p_school_id, btrim(p_title), coalesce(btrim(p_author), 'Unknown'),
          nullif(btrim(coalesce(p_isbn, '')), ''),
          nullif(btrim(coalesce(p_category, '')), ''),
          nullif(btrim(coalesce(p_location, '')), ''),
          p_total_copies)
  returning id into v_book_id;

  -- Auto-generate copy tags: use isbn or short title slug + sequential number
  for i in 1..p_total_copies loop
    if p_isbn is not null and length(btrim(p_isbn)) > 0 then
      v_tag := upper(btrim(p_isbn)) || '-' || lpad(i::text, 3, '0');
    else
      v_tag := upper(
        regexp_replace(left(btrim(p_title), 12), '[^A-Za-z0-9]', '', 'g')
      ) || '-' || lpad(i::text, 3, '0');
    end if;
    -- Ensure uniqueness within school by appending book_id prefix if tag conflicts
    if exists (select 1 from public.library_book_copies where school_id = p_school_id and copy_tag = v_tag) then
      v_tag := v_tag || '-' || left(v_book_id::text, 4);
    end if;
    insert into public.library_book_copies(book_id, school_id, copy_tag, status)
    values (v_book_id, p_school_id, v_tag, 'available');
  end loop;

  return v_book_id;
end;
$$;

alter function public.create_library_book(uuid, text, text, text, text, text, int) owner to postgres;
revoke all on function public.create_library_book(uuid, text, text, text, text, text, int)
  from public, anon, service_role;
grant execute on function public.create_library_book(uuid, text, text, text, text, text, int) to authenticated;

-- ── RPC: borrow_book ─────────────────────────────────────────────────────────

create or replace function public.borrow_book(
  p_school_id  uuid,
  p_book_id    uuid,
  p_student_id uuid,
  p_due_days   int  default 7
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor    record;
  v_copy_id  uuid;
  v_borrow_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id, 'library.manage');

  if p_due_days < 1 or p_due_days > 90 then
    raise exception 'due_days must be between 1 and 90' using errcode = '22023';
  end if;

  -- Verify student belongs to school and is active
  if not exists (
    select 1 from public.student_records
     where id = p_student_id and school_id = p_school_id and status = 'active'
  ) then
    raise exception 'active student not found in school' using errcode = 'P0002';
  end if;

  -- Find an available copy of the requested book
  select id into v_copy_id
    from public.library_book_copies
   where book_id   = p_book_id
     and school_id = p_school_id
     and status    = 'available'
   order by created_at asc
   limit 1
   for update skip locked;

  if v_copy_id is null then
    raise exception 'no available copies of this book' using errcode = 'P0002';
  end if;

  -- Mark copy as borrowed
  update public.library_book_copies
     set status = 'borrowed'
   where id = v_copy_id and school_id = p_school_id;

  -- Create borrow record
  insert into public.library_borrow_records(school_id, student_id, copy_id, due_at)
  values (p_school_id, p_student_id, v_copy_id, now() + (p_due_days || ' days')::interval)
  returning id into v_borrow_id;

  return v_borrow_id;
end;
$$;

alter function public.borrow_book(uuid, uuid, uuid, int) owner to postgres;
revoke all on function public.borrow_book(uuid, uuid, uuid, int)
  from public, anon, service_role;
grant execute on function public.borrow_book(uuid, uuid, uuid, int) to authenticated;

-- ── RPC: return_book ─────────────────────────────────────────────────────────

create or replace function public.return_book(
  p_school_id uuid,
  p_borrow_id uuid   default null,
  p_copy_tag  text   default null
)
returns table(borrow_id uuid, fine_amount int, fine_charged_to_wallet boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor      record;
  v_borrow_id  uuid;
  v_copy_id    uuid;
  v_due_at     timestamptz;
  v_fine       int;
  v_days_over  int;
begin
  select * into v_actor from private.require_school_actor(p_school_id, 'library.manage');

  if p_borrow_id is null and p_copy_tag is null then
    raise exception 'borrow_id or copy_tag required' using errcode = '22023';
  end if;

  -- Resolve borrow record
  if p_borrow_id is not null then
    select r.id, r.copy_id, r.due_at
      into v_borrow_id, v_copy_id, v_due_at
      from public.library_borrow_records r
     where r.id = p_borrow_id and r.school_id = p_school_id and r.returned_at is null
     for update;
  else
    select r.id, r.copy_id, r.due_at
      into v_borrow_id, v_copy_id, v_due_at
      from public.library_borrow_records r
      join public.library_book_copies c on c.id = r.copy_id and c.school_id = r.school_id
     where c.copy_tag  = btrim(p_copy_tag)
       and r.school_id = p_school_id
       and r.returned_at is null
     order by r.borrowed_at desc
     limit 1
     for update of r;
  end if;

  if v_borrow_id is null then
    raise exception 'active borrow record not found' using errcode = 'P0002';
  end if;

  -- Calculate fine: 200 RWF per day overdue
  v_days_over := greatest(0, floor(extract(epoch from (now() - v_due_at)) / 86400)::int);
  v_fine := v_days_over * 200;

  -- Mark returned
  update public.library_borrow_records
     set returned_at = now(),
         fine_amount = v_fine
   where id = v_borrow_id and school_id = p_school_id;

  -- Free the copy
  update public.library_book_copies
     set status = 'available'
   where id = v_copy_id and school_id = p_school_id;

  return query select v_borrow_id, v_fine, false;
end;
$$;

alter function public.return_book(uuid, uuid, text) owner to postgres;
revoke all on function public.return_book(uuid, uuid, text)
  from public, anon, service_role;
grant execute on function public.return_book(uuid, uuid, text) to authenticated;

-- ── RPC: renew_borrow ────────────────────────────────────────────────────────

create or replace function public.renew_borrow(
  p_school_id  uuid,
  p_borrow_id  uuid,
  p_extra_days int default 14
)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor    record;
  v_new_due  timestamptz;
  v_renewed  int;
begin
  select * into v_actor from private.require_school_actor(p_school_id, 'library.manage');

  if p_extra_days < 1 or p_extra_days > 60 then
    raise exception 'extra_days must be between 1 and 60' using errcode = '22023';
  end if;

  select renewed_count, due_at + (p_extra_days || ' days')::interval
    into v_renewed, v_new_due
    from public.library_borrow_records
   where id = p_borrow_id and school_id = p_school_id and returned_at is null
   for update;

  if not found then
    raise exception 'active borrow record not found' using errcode = 'P0002';
  end if;

  if v_renewed >= 3 then
    raise exception 'maximum renewals (3) reached for this borrow' using errcode = '23514';
  end if;

  update public.library_borrow_records
     set due_at        = v_new_due,
         renewed_count = renewed_count + 1
   where id = p_borrow_id and school_id = p_school_id;

  return v_new_due;
end;
$$;

alter function public.renew_borrow(uuid, uuid, int) owner to postgres;
revoke all on function public.renew_borrow(uuid, uuid, int)
  from public, anon, service_role;
grant execute on function public.renew_borrow(uuid, uuid, int) to authenticated;

-- ── RPC: waive_library_fine ──────────────────────────────────────────────────

create or replace function public.waive_library_fine(
  p_school_id uuid,
  p_borrow_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor record;
begin
  select * into v_actor from private.require_school_actor(p_school_id, 'library.manage');

  update public.library_borrow_records
     set fine_waived = true,
         fine_amount = 0
   where id = p_borrow_id and school_id = p_school_id;

  if not found then
    raise exception 'borrow record not found in school' using errcode = 'P0002';
  end if;
end;
$$;

alter function public.waive_library_fine(uuid, uuid) owner to postgres;
revoke all on function public.waive_library_fine(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.waive_library_fine(uuid, uuid) to authenticated;
