-- ── Health Module ──────────────────────────────────────────────────────────
-- Tables: health_records, medical_profiles, clinic_visits,
--         medication_administrations
-- RPCs:   list_school_health_records, list_student_health_records,
--         create_health_record, get_medical_profile, upsert_medical_profile,
--         list_student_clinic_visits, create_clinic_visit, get_health_stats

-- ── Tables ──────────────────────────────────────────────────────────────────

create table public.health_records (
  id                 uuid        primary key default gen_random_uuid(),
  school_id          uuid        not null references public.schools(id) on delete restrict,
  student_id         uuid        not null,
  recorded_by        uuid        references auth.users(id) on delete set null,
  type               text        not null
                       check (type in ('ILLNESS','INJURY','MEDICATION','CHECKUP','ALLERGY')),
  title              text        not null,
  description        text,
  treatment_given    text,
  severity           text        not null default 'LOW'
                       check (severity in ('LOW','MEDIUM','HIGH')),
  follow_up_required boolean     not null default false,
  resolved_at        timestamptz,
  recorded_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  unique (id, school_id),
  foreign key (student_id, school_id) references public.student_records (id, school_id) on delete restrict,
  constraint health_records_title_nonblank check (length(btrim(title)) > 0)
);

create index health_records_school_idx
  on public.health_records (school_id, recorded_at desc);
create index health_records_student_idx
  on public.health_records (school_id, student_id, recorded_at desc);

create table public.medical_profiles (
  id                       uuid        primary key default gen_random_uuid(),
  school_id                uuid        not null references public.schools(id) on delete restrict,
  student_id               uuid        not null,
  blood_type               text,
  allergies                text[]      not null default '{}',
  chronic_conditions       text[]      not null default '{}',
  emergency_contact_phone  text        not null default '',
  updated_at               timestamptz not null default now(),
  unique (school_id, student_id),
  unique (id, school_id),
  foreign key (student_id, school_id) references public.student_records (id, school_id) on delete restrict
);

create table public.clinic_visits (
  id                   uuid        primary key default gen_random_uuid(),
  school_id            uuid        not null references public.schools(id) on delete restrict,
  student_id           uuid        not null,
  recorded_by          uuid        references auth.users(id) on delete set null,
  visit_datetime       timestamptz not null default now(),
  presenting_complaint text        not null,
  treatment_notes      text,
  follow_up_required   boolean     not null default false,
  created_at           timestamptz not null default now(),
  unique (id, school_id),
  foreign key (student_id, school_id) references public.student_records (id, school_id) on delete restrict,
  constraint clinic_visits_complaint_nonblank check (length(btrim(presenting_complaint)) > 0)
);

create index clinic_visits_school_idx
  on public.clinic_visits (school_id, visit_datetime desc);
create index clinic_visits_student_idx
  on public.clinic_visits (school_id, student_id, visit_datetime desc);

create table public.medication_administrations (
  id              uuid        primary key default gen_random_uuid(),
  school_id       uuid        not null references public.schools(id) on delete restrict,
  clinic_visit_id uuid,
  student_id      uuid        not null,
  medication_name text        not null,
  dosage          text        not null default '',
  administered_at timestamptz not null default now(),
  unique (id, school_id),
  foreign key (student_id, school_id)    references public.student_records (id, school_id) on delete restrict,
  foreign key (clinic_visit_id, school_id) references public.clinic_visits (id, school_id) on delete restrict,
  constraint medication_name_nonblank check (length(btrim(medication_name)) > 0)
);

create index medication_administrations_visit_idx
  on public.medication_administrations (clinic_visit_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.health_records              enable row level security;
alter table public.health_records              force row level security;
alter table public.medical_profiles            enable row level security;
alter table public.medical_profiles            force row level security;
alter table public.clinic_visits               enable row level security;
alter table public.clinic_visits               force row level security;
alter table public.medication_administrations  enable row level security;
alter table public.medication_administrations  force row level security;

create policy health_records_select on public.health_records
  for select to authenticated
  using (private.has_school_permission(school_id, 'health.read_sensitive'));

create policy health_records_write on public.health_records
  for insert to authenticated
  with check (private.has_school_permission(school_id, 'health.manage'));

create policy health_records_update on public.health_records
  for update to authenticated
  using  (private.has_school_permission(school_id, 'health.manage'))
  with check (private.has_school_permission(school_id, 'health.manage'));

create policy medical_profiles_select on public.medical_profiles
  for select to authenticated
  using (private.has_school_permission(school_id, 'health.read_sensitive'));

create policy medical_profiles_write on public.medical_profiles
  for insert to authenticated
  with check (private.has_school_permission(school_id, 'health.manage'));

create policy medical_profiles_update on public.medical_profiles
  for update to authenticated
  using  (private.has_school_permission(school_id, 'health.manage'))
  with check (private.has_school_permission(school_id, 'health.manage'));

create policy clinic_visits_select on public.clinic_visits
  for select to authenticated
  using (private.has_school_permission(school_id, 'health.read_sensitive'));

create policy clinic_visits_write on public.clinic_visits
  for insert to authenticated
  with check (private.has_school_permission(school_id, 'health.manage'));

create policy clinic_visits_update on public.clinic_visits
  for update to authenticated
  using  (private.has_school_permission(school_id, 'health.manage'))
  with check (private.has_school_permission(school_id, 'health.manage'));

create policy medication_admin_select on public.medication_administrations
  for select to authenticated
  using (private.has_school_permission(school_id, 'health.read_sensitive'));

create policy medication_admin_write on public.medication_administrations
  for insert to authenticated
  with check (private.has_school_permission(school_id, 'health.manage'));

-- ── Grants ───────────────────────────────────────────────────────────────────

revoke all privileges on table
  public.health_records,
  public.medical_profiles,
  public.clinic_visits,
  public.medication_administrations
  from public, anon, authenticated, service_role;

grant select, insert, update
  on table public.health_records, public.medical_profiles, public.clinic_visits
  to authenticated;

grant select, insert
  on table public.medication_administrations
  to authenticated;

-- ── RPC: list_school_health_records ──────────────────────────────────────────

create or replace function public.list_school_health_records(
  p_school_id uuid,
  p_limit     int default 50
)
returns table(
  record_id          uuid,
  type               text,
  title              text,
  description        text,
  treatment_given    text,
  severity           text,
  follow_up_required boolean,
  resolved_at        timestamptz,
  recorded_at        timestamptz,
  student_id         uuid,
  student_name       text,
  student_code       text,
  recorder_name      text
)
language sql stable security definer set search_path = ''
as $$
  select
    h.id                                         as record_id,
    h.type,
    h.title,
    h.description,
    h.treatment_given,
    h.severity,
    h.follow_up_required,
    h.resolved_at,
    h.recorded_at,
    sr.id                                        as student_id,
    coalesce(pi.legal_name, sr.admission_number) as student_name,
    sr.admission_number                          as student_code,
    coalesce(rpi.legal_name, '')                 as recorder_name
  from public.health_records h
  join public.student_records              sr  on sr.id = h.student_id and sr.school_id = h.school_id
  join public.persons                      p   on p.id = sr.person_id
  left join private.person_private_identity pi  on pi.person_id = p.id
  left join public.persons                 rp  on rp.auth_user_id = h.recorded_by
  left join private.person_private_identity rpi on rpi.person_id = rp.id
  where h.school_id = p_school_id
    and private.has_school_permission(p_school_id, 'health.read_sensitive')
  order by h.recorded_at desc
  limit least(p_limit, 500);
$$;

alter function public.list_school_health_records(uuid, int) owner to postgres;
revoke all on function public.list_school_health_records(uuid, int)
  from public, anon, service_role;
grant execute on function public.list_school_health_records(uuid, int) to authenticated;

-- ── RPC: list_student_health_records ─────────────────────────────────────────

create or replace function public.list_student_health_records(
  p_school_id  uuid,
  p_student_id uuid
)
returns table(
  record_id          uuid,
  type               text,
  title              text,
  description        text,
  treatment_given    text,
  severity           text,
  follow_up_required boolean,
  resolved_at        timestamptz,
  recorded_at        timestamptz,
  recorder_name      text
)
language sql stable security definer set search_path = ''
as $$
  select
    h.id              as record_id,
    h.type,
    h.title,
    h.description,
    h.treatment_given,
    h.severity,
    h.follow_up_required,
    h.resolved_at,
    h.recorded_at,
    coalesce(rpi.legal_name, '') as recorder_name
  from public.health_records h
  left join public.persons                 rp  on rp.auth_user_id = h.recorded_by
  left join private.person_private_identity rpi on rpi.person_id = rp.id
  where h.school_id  = p_school_id
    and h.student_id = p_student_id
    and private.has_school_permission(p_school_id, 'health.read_sensitive')
  order by h.recorded_at desc;
$$;

alter function public.list_student_health_records(uuid, uuid) owner to postgres;
revoke all on function public.list_student_health_records(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.list_student_health_records(uuid, uuid) to authenticated;

-- ── RPC: create_health_record ────────────────────────────────────────────────

create or replace function public.create_health_record(
  p_school_id          uuid,
  p_student_id         uuid,
  p_type               text,
  p_title              text,
  p_description        text    default null,
  p_treatment_given    text    default null,
  p_severity           text    default 'LOW',
  p_follow_up_required boolean default false
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor record;
  v_id    uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id, 'health.manage');

  if length(btrim(coalesce(p_title, ''))) = 0 then
    raise exception 'title is required' using errcode = '22023';
  end if;
  if p_type not in ('ILLNESS','INJURY','MEDICATION','CHECKUP','ALLERGY') then
    raise exception 'invalid type' using errcode = '22023';
  end if;
  if p_severity not in ('LOW','MEDIUM','HIGH') then
    raise exception 'invalid severity' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.student_records
     where id = p_student_id and school_id = p_school_id
  ) then
    raise exception 'student not found in school' using errcode = 'P0002';
  end if;

  insert into public.health_records (
    school_id, student_id, recorded_by,
    type, title, description, treatment_given, severity, follow_up_required
  ) values (
    p_school_id, p_student_id, v_actor.auth_user_id,
    p_type, btrim(p_title), p_description, p_treatment_given,
    p_severity, coalesce(p_follow_up_required, false)
  )
  returning id into v_id;

  return v_id;
end;
$$;

alter function public.create_health_record(uuid,uuid,text,text,text,text,text,boolean) owner to postgres;
revoke all on function public.create_health_record(uuid,uuid,text,text,text,text,text,boolean)
  from public, anon, service_role;
grant execute on function public.create_health_record(uuid,uuid,text,text,text,text,text,boolean)
  to authenticated;

-- ── RPC: get_medical_profile ─────────────────────────────────────────────────

create or replace function public.get_medical_profile(
  p_school_id  uuid,
  p_student_id uuid
)
returns table(
  profile_id               uuid,
  blood_type               text,
  allergies                text[],
  chronic_conditions       text[],
  emergency_contact_phone  text,
  updated_at               timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select
    id                      as profile_id,
    blood_type,
    allergies,
    chronic_conditions,
    emergency_contact_phone,
    updated_at
  from public.medical_profiles
  where school_id  = p_school_id
    and student_id = p_student_id
    and private.has_school_permission(p_school_id, 'health.read_sensitive')
  limit 1;
$$;

alter function public.get_medical_profile(uuid, uuid) owner to postgres;
revoke all on function public.get_medical_profile(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.get_medical_profile(uuid, uuid) to authenticated;

-- ── RPC: upsert_medical_profile ──────────────────────────────────────────────

create or replace function public.upsert_medical_profile(
  p_school_id               uuid,
  p_student_id              uuid,
  p_blood_type              text    default null,
  p_allergies               text[]  default '{}',
  p_chronic_conditions      text[]  default '{}',
  p_emergency_contact_phone text    default ''
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor record;
  v_id    uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id, 'health.manage');

  if not exists (
    select 1 from public.student_records
     where id = p_student_id and school_id = p_school_id
  ) then
    raise exception 'student not found in school' using errcode = 'P0002';
  end if;

  insert into public.medical_profiles (
    school_id, student_id, blood_type, allergies,
    chronic_conditions, emergency_contact_phone, updated_at
  ) values (
    p_school_id, p_student_id,
    p_blood_type,
    coalesce(p_allergies, '{}'),
    coalesce(p_chronic_conditions, '{}'),
    coalesce(p_emergency_contact_phone, ''),
    now()
  )
  on conflict (school_id, student_id) do update set
    blood_type              = excluded.blood_type,
    allergies               = excluded.allergies,
    chronic_conditions      = excluded.chronic_conditions,
    emergency_contact_phone = excluded.emergency_contact_phone,
    updated_at              = now()
  returning id into v_id;

  return v_id;
end;
$$;

alter function public.upsert_medical_profile(uuid,uuid,text,text[],text[],text) owner to postgres;
revoke all on function public.upsert_medical_profile(uuid,uuid,text,text[],text[],text)
  from public, anon, service_role;
grant execute on function public.upsert_medical_profile(uuid,uuid,text,text[],text[],text)
  to authenticated;

-- ── RPC: list_student_clinic_visits ──────────────────────────────────────────

create or replace function public.list_student_clinic_visits(
  p_school_id  uuid,
  p_student_id uuid,
  p_limit      int default 30
)
returns table(
  visit_id             uuid,
  visit_datetime       timestamptz,
  presenting_complaint text,
  treatment_notes      text,
  follow_up_required   boolean,
  recorder_name        text,
  medications          jsonb
)
language sql stable security definer set search_path = ''
as $$
  select
    v.id              as visit_id,
    v.visit_datetime,
    v.presenting_complaint,
    v.treatment_notes,
    v.follow_up_required,
    coalesce(rpi.legal_name, '') as recorder_name,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',              m.id,
        'medication_name', m.medication_name,
        'dosage',          m.dosage,
        'administered_at', m.administered_at
      ) order by m.administered_at)
      from public.medication_administrations m
      where m.clinic_visit_id = v.id and m.school_id = v.school_id
    ), '[]'::jsonb) as medications
  from public.clinic_visits v
  left join public.persons                 rp  on rp.auth_user_id = v.recorded_by
  left join private.person_private_identity rpi on rpi.person_id = rp.id
  where v.school_id  = p_school_id
    and v.student_id = p_student_id
    and private.has_school_permission(p_school_id, 'health.read_sensitive')
  order by v.visit_datetime desc
  limit least(p_limit, 200);
$$;

alter function public.list_student_clinic_visits(uuid, uuid, int) owner to postgres;
revoke all on function public.list_student_clinic_visits(uuid, uuid, int)
  from public, anon, service_role;
grant execute on function public.list_student_clinic_visits(uuid, uuid, int) to authenticated;

-- ── RPC: create_clinic_visit ─────────────────────────────────────────────────

create or replace function public.create_clinic_visit(
  p_school_id          uuid,
  p_student_id         uuid,
  p_presenting_complaint text,
  p_treatment_notes    text    default null,
  p_follow_up_required boolean default false,
  p_medications        jsonb   default '[]'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor   record;
  v_visit_id uuid;
  v_med     jsonb;
begin
  select * into v_actor from private.require_school_actor(p_school_id, 'health.manage');

  if length(btrim(coalesce(p_presenting_complaint, ''))) = 0 then
    raise exception 'presenting_complaint is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.student_records
     where id = p_student_id and school_id = p_school_id
  ) then
    raise exception 'student not found in school' using errcode = 'P0002';
  end if;

  insert into public.clinic_visits (
    school_id, student_id, recorded_by,
    presenting_complaint, treatment_notes, follow_up_required
  ) values (
    p_school_id, p_student_id, v_actor.auth_user_id,
    btrim(p_presenting_complaint), p_treatment_notes,
    coalesce(p_follow_up_required, false)
  )
  returning id into v_visit_id;

  -- Insert medications if provided
  for v_med in select * from jsonb_array_elements(coalesce(p_medications, '[]'))
  loop
    if length(btrim(coalesce(v_med->>'medication_name', ''))) > 0 then
      insert into public.medication_administrations (
        school_id, clinic_visit_id, student_id, medication_name, dosage
      ) values (
        p_school_id, v_visit_id, p_student_id,
        btrim(v_med->>'medication_name'),
        coalesce(btrim(v_med->>'dosage'), '')
      );
    end if;
  end loop;

  return v_visit_id;
end;
$$;

alter function public.create_clinic_visit(uuid,uuid,text,text,boolean,jsonb) owner to postgres;
revoke all on function public.create_clinic_visit(uuid,uuid,text,text,boolean,jsonb)
  from public, anon, service_role;
grant execute on function public.create_clinic_visit(uuid,uuid,text,text,boolean,jsonb)
  to authenticated;

-- ── RPC: get_health_stats ────────────────────────────────────────────────────

create or replace function public.get_health_stats(p_school_id uuid)
returns table(
  total_records    bigint,
  follow_up_pending bigint,
  visits_today     bigint,
  visits_this_week bigint
)
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*) from public.health_records
      where school_id = p_school_id)
      as total_records,
    (select count(*) from public.health_records
      where school_id = p_school_id
        and follow_up_required = true
        and resolved_at is null)
      as follow_up_pending,
    (select count(*) from public.clinic_visits
      where school_id = p_school_id
        and visit_datetime >= current_date
        and visit_datetime <  current_date + interval '1 day')
      as visits_today,
    (select count(*) from public.clinic_visits
      where school_id = p_school_id
        and visit_datetime >= date_trunc('week', now())
        and visit_datetime <  date_trunc('week', now()) + interval '7 days')
      as visits_this_week
  where private.has_school_permission(p_school_id, 'health.read_sensitive');
$$;

alter function public.get_health_stats(uuid) owner to postgres;
revoke all on function public.get_health_stats(uuid) from public, anon, service_role;
grant execute on function public.get_health_stats(uuid) to authenticated;
