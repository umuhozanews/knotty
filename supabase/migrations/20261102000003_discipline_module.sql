-- ── Discipline Module ──────────────────────────────────────────────────────
-- Tables: discipline_records
-- RPCs:   list_school_discipline, list_student_discipline,
--         create_discipline_record, update_discipline_record, get_discipline_stats

-- ── Tables ──────────────────────────────────────────────────────────────────

create table public.discipline_records (
  id              uuid        primary key default gen_random_uuid(),
  school_id       uuid        not null references public.schools(id) on delete restrict,
  student_id      uuid        not null,
  recorded_by     uuid        references auth.users(id) on delete set null,
  type            text        not null
                    check (type in ('WARNING','SUSPENSION','MISCONDUCT','RULE_VIOLATION','OTHER')),
  title           text        not null,
  description     text,
  action_taken    text,
  severity        text        not null default 'MINOR'
                    check (severity in ('MINOR','MODERATE','SERIOUS')),
  status          text        not null default 'OPEN'
                    check (status in ('OPEN','RESOLVED','APPEALED')),
  marks_deducted  integer     not null default 0,
  parent_notified boolean     not null default false,
  recorded_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (id, school_id),
  foreign key (student_id, school_id) references public.student_records (id, school_id) on delete restrict,
  constraint discipline_marks_nonneg    check (marks_deducted >= 0),
  constraint discipline_title_nonblank  check (length(btrim(title)) > 0)
);

create index discipline_records_school_idx
  on public.discipline_records (school_id, status, recorded_at desc);
create index discipline_records_student_idx
  on public.discipline_records (school_id, student_id, recorded_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.discipline_records enable row level security;
alter table public.discipline_records force row level security;

create policy discipline_records_select on public.discipline_records
  for select to authenticated
  using (private.has_school_permission(school_id, 'discipline.read'));

create policy discipline_records_write on public.discipline_records
  for insert to authenticated
  with check (private.has_school_permission(school_id, 'discipline.manage'));

create policy discipline_records_update on public.discipline_records
  for update to authenticated
  using  (private.has_school_permission(school_id, 'discipline.manage'))
  with check (private.has_school_permission(school_id, 'discipline.manage'));

-- ── Grants ───────────────────────────────────────────────────────────────────

revoke all privileges on table public.discipline_records
  from public, anon, authenticated, service_role;

grant select, insert, update
  on table public.discipline_records
  to authenticated;

-- ── RPC: list_school_discipline ──────────────────────────────────────────────

create or replace function public.list_school_discipline(
  p_school_id uuid,
  p_search    text    default null,
  p_limit     int     default 50
)
returns table(
  record_id       uuid,
  type            text,
  title           text,
  description     text,
  action_taken    text,
  severity        text,
  status          text,
  marks_deducted  int,
  parent_notified boolean,
  recorded_at     timestamptz,
  student_id      uuid,
  student_name    text,
  student_code    text,
  recorder_name   text
)
language sql stable security definer set search_path = ''
as $$
  select
    d.id                                        as record_id,
    d.type,
    d.title,
    d.description,
    d.action_taken,
    d.severity,
    d.status,
    d.marks_deducted,
    d.parent_notified,
    d.recorded_at,
    sr.id                                       as student_id,
    coalesce(pi.legal_name, sr.admission_number) as student_name,
    sr.admission_number                         as student_code,
    coalesce(rpi.legal_name, '')                as recorder_name
  from public.discipline_records d
  join public.student_records              sr  on sr.id = d.student_id and sr.school_id = d.school_id
  join public.persons                      p   on p.id = sr.person_id
  left join private.person_private_identity pi  on pi.person_id = p.id
  left join public.persons                 rp  on rp.auth_user_id = d.recorded_by
  left join private.person_private_identity rpi on rpi.person_id = rp.id
  where d.school_id = p_school_id
    and private.has_school_permission(p_school_id, 'discipline.read')
    and (
      p_search is null or length(trim(p_search)) = 0
      or d.title ilike '%' || trim(p_search) || '%'
      or coalesce(pi.legal_name, '') ilike '%' || trim(p_search) || '%'
      or sr.admission_number ilike '%' || trim(p_search) || '%'
    )
  order by d.recorded_at desc
  limit least(p_limit, 500);
$$;

alter function public.list_school_discipline(uuid, text, int) owner to postgres;
revoke all on function public.list_school_discipline(uuid, text, int)
  from public, anon, service_role;
grant execute on function public.list_school_discipline(uuid, text, int) to authenticated;

-- ── RPC: list_student_discipline ─────────────────────────────────────────────

create or replace function public.list_student_discipline(
  p_school_id  uuid,
  p_student_id uuid,
  p_limit      int default 100
)
returns table(
  record_id       uuid,
  type            text,
  title           text,
  description     text,
  action_taken    text,
  severity        text,
  status          text,
  marks_deducted  int,
  parent_notified boolean,
  recorded_at     timestamptz,
  recorder_name   text
)
language sql stable security definer set search_path = ''
as $$
  select
    d.id              as record_id,
    d.type,
    d.title,
    d.description,
    d.action_taken,
    d.severity,
    d.status,
    d.marks_deducted,
    d.parent_notified,
    d.recorded_at,
    coalesce(rpi.legal_name, '') as recorder_name
  from public.discipline_records d
  left join public.persons                 rp  on rp.auth_user_id = d.recorded_by
  left join private.person_private_identity rpi on rpi.person_id = rp.id
  where d.school_id  = p_school_id
    and d.student_id = p_student_id
    and private.has_school_permission(p_school_id, 'discipline.read')
  order by d.recorded_at desc
  limit least(p_limit, 500);
$$;

alter function public.list_student_discipline(uuid, uuid, int) owner to postgres;
revoke all on function public.list_student_discipline(uuid, uuid, int)
  from public, anon, service_role;
grant execute on function public.list_student_discipline(uuid, uuid, int) to authenticated;

-- ── RPC: create_discipline_record ────────────────────────────────────────────

create or replace function public.create_discipline_record(
  p_school_id      uuid,
  p_student_id     uuid,
  p_type           text,
  p_title          text,
  p_description    text    default null,
  p_action_taken   text    default null,
  p_severity       text    default 'MINOR',
  p_marks_deducted int     default 0
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor  record;
  v_id     uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id, 'discipline.manage');

  if length(btrim(coalesce(p_title, ''))) = 0 then
    raise exception 'title is required' using errcode = '22023';
  end if;
  if p_type not in ('WARNING','SUSPENSION','MISCONDUCT','RULE_VIOLATION','OTHER') then
    raise exception 'invalid type' using errcode = '22023';
  end if;
  if p_severity not in ('MINOR','MODERATE','SERIOUS') then
    raise exception 'invalid severity' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.student_records
     where id = p_student_id and school_id = p_school_id
  ) then
    raise exception 'student not found in school' using errcode = 'P0002';
  end if;

  insert into public.discipline_records (
    school_id, student_id, recorded_by,
    type, title, description, action_taken, severity, marks_deducted
  ) values (
    p_school_id, p_student_id, v_actor.auth_user_id,
    p_type, btrim(p_title), p_description, p_action_taken, p_severity,
    greatest(0, coalesce(p_marks_deducted, 0))
  )
  returning id into v_id;

  return v_id;
end;
$$;

alter function public.create_discipline_record(uuid,uuid,text,text,text,text,text,int) owner to postgres;
revoke all on function public.create_discipline_record(uuid,uuid,text,text,text,text,text,int)
  from public, anon, service_role;
grant execute on function public.create_discipline_record(uuid,uuid,text,text,text,text,text,int)
  to authenticated;

-- ── RPC: update_discipline_record ────────────────────────────────────────────

create or replace function public.update_discipline_record(
  p_school_id       uuid,
  p_record_id       uuid,
  p_marks_deducted  int     default null,
  p_action_taken    text    default null,
  p_status          text    default null,
  p_parent_notified boolean default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor record;
begin
  select * into v_actor from private.require_school_actor(p_school_id, 'discipline.manage');

  if p_status is not null and p_status not in ('OPEN','RESOLVED','APPEALED') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  update public.discipline_records set
    marks_deducted  = coalesce(p_marks_deducted, marks_deducted),
    action_taken    = coalesce(p_action_taken,   action_taken),
    status          = coalesce(p_status,          status),
    parent_notified = coalesce(p_parent_notified, parent_notified)
  where id = p_record_id and school_id = p_school_id;

  if not found then
    raise exception 'discipline record not found in school' using errcode = 'P0002';
  end if;
end;
$$;

alter function public.update_discipline_record(uuid,uuid,int,text,text,boolean) owner to postgres;
revoke all on function public.update_discipline_record(uuid,uuid,int,text,text,boolean)
  from public, anon, service_role;
grant execute on function public.update_discipline_record(uuid,uuid,int,text,text,boolean)
  to authenticated;

-- ── RPC: get_discipline_stats ────────────────────────────────────────────────

create or replace function public.get_discipline_stats(p_school_id uuid)
returns table(
  total         bigint,
  open_count    bigint,
  resolved_count bigint,
  serious_count  bigint
)
language sql stable security definer set search_path = ''
as $$
  select
    count(*)                                              as total,
    count(*) filter (where status = 'OPEN')               as open_count,
    count(*) filter (where status = 'RESOLVED')           as resolved_count,
    count(*) filter (where severity = 'SERIOUS')          as serious_count
  from public.discipline_records
  where school_id = p_school_id
    and private.has_school_permission(p_school_id, 'discipline.read');
$$;

alter function public.get_discipline_stats(uuid) owner to postgres;
revoke all on function public.get_discipline_stats(uuid) from public, anon, service_role;
grant execute on function public.get_discipline_stats(uuid) to authenticated;
