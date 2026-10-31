-- School-scoped attendance records, scan events and registered devices.
-- Input processing is intentionally unavailable until trusted device and role
-- authorization workflows are implemented.

create table public.attendance_devices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  device_code text not null,
  device_kind text not null check (device_kind in ('gate_terminal','mobile','virtual_tap')),
  credential_digest bytea,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  created_by_membership_id uuid not null,
  created_by_person_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,school_id),
  unique (school_id,device_code),
  check (length(btrim(device_code)) > 0),
  check (credential_digest is null or octet_length(credential_digest) = 32),
  foreign key (school_id,created_by_membership_id,created_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict
);
create index attendance_devices_school_status_idx on public.attendance_devices (school_id,status,device_kind);
create index attendance_devices_creator_idx on public.attendance_devices (school_id,created_by_membership_id,created_by_person_id);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid not null,
  attendance_date date not null,
  status text not null check (status in ('present','absent','late','excused','early_departure')),
  first_arrived_at timestamptz,
  departed_at timestamptz,
  source text not null check (source in ('manual','nfc','virtual_tap')),
  created_by_membership_id uuid,
  created_by_person_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,school_id),
  unique (school_id,student_id,attendance_date),
  foreign key (school_id,student_id) references public.student_records(school_id,id) on delete restrict,
  foreign key (school_id,created_by_membership_id,created_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  check ((created_by_membership_id is null) = (created_by_person_id is null)),
  check (status <> 'absent' or first_arrived_at is null),
  check (departed_at is null or first_arrived_at is not null),
  check (departed_at is null or departed_at >= first_arrived_at),
  check ((source='manual' and created_by_membership_id is not null)
      or (source in ('nfc','virtual_tap')))
);
create index attendance_records_school_date_class_idx
  on public.attendance_records (school_id,attendance_date,status,student_id);
create index attendance_records_student_date_idx
  on public.attendance_records (school_id,student_id,attendance_date desc);
create index attendance_records_actor_idx
  on public.attendance_records (school_id,created_by_membership_id,created_by_person_id)
  where created_by_membership_id is not null;

create table public.staff_attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  staff_record_id uuid not null,
  attendance_date date not null,
  status text not null check (status in ('present','absent','late','excused','early_departure')),
  first_arrived_at timestamptz,
  departed_at timestamptz,
  source text not null check (source in ('manual','nfc','virtual_tap')),
  created_by_membership_id uuid,
  created_by_person_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,school_id),
  unique (school_id,staff_record_id,attendance_date),
  foreign key (staff_record_id,school_id) references public.staff_records(id,school_id) on delete restrict,
  foreign key (school_id,created_by_membership_id,created_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  check ((created_by_membership_id is null) = (created_by_person_id is null)),
  check (status <> 'absent' or first_arrived_at is null),
  check (departed_at is null or first_arrived_at is not null),
  check (departed_at is null or departed_at >= first_arrived_at),
  check ((source='manual' and created_by_membership_id is not null) or source in ('nfc','virtual_tap'))
);
create index staff_attendance_school_date_status_idx on public.staff_attendance_records (school_id,attendance_date,status,staff_record_id);
create index staff_attendance_staff_date_idx on public.staff_attendance_records (school_id,staff_record_id,attendance_date desc);
create index staff_attendance_actor_idx on public.staff_attendance_records (school_id,created_by_membership_id,created_by_person_id) where created_by_membership_id is not null;

create table public.attendance_scan_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  idempotency_key uuid not null,
  device_id uuid,
  actor_membership_id uuid,
  actor_person_id uuid,
  student_id uuid,
  staff_record_id uuid,
  attendance_record_id uuid,
  staff_attendance_record_id uuid,
  scan_type text not null check (scan_type in ('manual','nfc','virtual_tap')),
  outcome text not null check (outcome in ('accepted','rejected','duplicate','error')),
  occurred_at timestamptz not null,
  processed_at timestamptz not null default now(),
  rejection_code text,
  created_at timestamptz not null default now(),
  unique (school_id,idempotency_key),
  unique (id,school_id),
  foreign key (device_id,school_id) references public.attendance_devices(id,school_id) on delete restrict,
  foreign key (school_id,student_id) references public.student_records(school_id,id) on delete restrict,
  foreign key (staff_record_id,school_id) references public.staff_records(id,school_id) on delete restrict,
  foreign key (attendance_record_id,school_id) references public.attendance_records(id,school_id) on delete restrict,
  foreign key (staff_attendance_record_id,school_id) references public.staff_attendance_records(id,school_id) on delete restrict,
  foreign key (school_id,actor_membership_id,actor_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  check ((actor_membership_id is null) = (actor_person_id is null)),
  check ((scan_type='manual' and actor_membership_id is not null and device_id is null)
      or (scan_type='virtual_tap' and actor_membership_id is not null)
      or (scan_type='nfc' and device_id is not null)),
  check ((student_id is null) or (staff_record_id is null)),
  check ((attendance_record_id is null) or (staff_attendance_record_id is null)),
  check ((outcome='accepted' and (
        (student_id is not null and attendance_record_id is not null and staff_record_id is null and staff_attendance_record_id is null)
        or (staff_record_id is not null and staff_attendance_record_id is not null and student_id is null and attendance_record_id is null)))
      or outcome <> 'accepted'),
  check (rejection_code is null or length(btrim(rejection_code)) > 0)
);
create index attendance_scan_events_school_time_idx on public.attendance_scan_events (school_id,occurred_at desc,id);
create index attendance_scan_events_device_time_idx on public.attendance_scan_events (school_id,device_id,occurred_at desc) where device_id is not null;
create index attendance_scan_events_student_time_idx on public.attendance_scan_events (school_id,student_id,occurred_at desc) where student_id is not null;
create index attendance_scan_events_staff_time_idx on public.attendance_scan_events (school_id,staff_record_id,occurred_at desc) where staff_record_id is not null;
create index attendance_scan_events_actor_time_idx on public.attendance_scan_events (school_id,actor_membership_id,occurred_at desc) where actor_membership_id is not null;

create table public.attendance_correction_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  attendance_record_id uuid not null,
  actor_membership_id uuid not null,
  actor_person_id uuid not null,
  prior_state jsonb not null check (jsonb_typeof(prior_state)='object'),
  corrected_state jsonb not null check (jsonb_typeof(corrected_state)='object'),
  reason text not null check (length(btrim(reason)) > 0),
  created_at timestamptz not null default now(),
  foreign key (attendance_record_id,school_id) references public.attendance_records(id,school_id) on delete restrict,
  foreign key (school_id,actor_membership_id,actor_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict
);
create index attendance_correction_audit_record_time_idx on public.attendance_correction_audit (school_id,attendance_record_id,created_at desc);
create index attendance_correction_audit_actor_time_idx on public.attendance_correction_audit (school_id,actor_membership_id,created_at desc);

create function private.reject_attendance_audit_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'attendance audit records are append-only' using errcode='55000';
end;
$$;
revoke all on function private.reject_attendance_audit_mutation() from public,anon,authenticated,service_role;
create trigger attendance_correction_audit_no_update_delete
  before update or delete on public.attendance_correction_audit
  for each row execute function private.reject_attendance_audit_mutation();
create trigger attendance_correction_audit_no_truncate
  before truncate on public.attendance_correction_audit
  for each statement execute function private.reject_attendance_audit_mutation();
create trigger attendance_scan_events_no_update_delete
  before update or delete on public.attendance_scan_events
  for each row execute function private.reject_attendance_audit_mutation();
create trigger attendance_scan_events_no_truncate
  before truncate on public.attendance_scan_events
  for each statement execute function private.reject_attendance_audit_mutation();

alter table public.attendance_devices enable row level security; alter table public.attendance_devices force row level security;
alter table public.attendance_records enable row level security; alter table public.attendance_records force row level security;
alter table public.staff_attendance_records enable row level security; alter table public.staff_attendance_records force row level security;
alter table public.attendance_scan_events enable row level security; alter table public.attendance_scan_events force row level security;
alter table public.attendance_correction_audit enable row level security; alter table public.attendance_correction_audit force row level security;

create policy attendance_records_select_student_self on public.attendance_records
  for select to authenticated using (exists (
    select 1 from public.student_records sr where sr.id=attendance_records.student_id
      and sr.school_id=attendance_records.school_id and sr.auth_user_id=(select auth.uid())
  ));
create policy staff_attendance_records_select_self on public.staff_attendance_records
  for select to authenticated using (exists (
    select 1 from public.staff_records sr join public.persons p on p.id=sr.person_id
    where sr.id=staff_attendance_records.staff_record_id and sr.school_id=staff_attendance_records.school_id
      and p.status='active' and p.auth_user_id=(select auth.uid())
  ));
-- Staff-wide reads and guardian reads remain default-deny until their exact
-- role permission and individual guardian permission policies are approved.

revoke all privileges on table public.attendance_devices,public.attendance_records,public.staff_attendance_records,
  public.attendance_scan_events,public.attendance_correction_audit from public,anon,authenticated,service_role;
grant usage on schema public to authenticated;
grant select on table public.attendance_records,public.staff_attendance_records to authenticated;
