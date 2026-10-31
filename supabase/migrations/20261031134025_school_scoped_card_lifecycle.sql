-- Historical school-scoped card assignments. Raw NFC UIDs and QR secrets are
-- never persisted; the future trusted issuer stores only keyed digests.
create table public.card_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  card_number text not null,
  holder_kind text not null check (holder_kind in ('student','staff')),
  student_id uuid,
  staff_record_id uuid,
  status text not null default 'issued'
    check (status in ('issued','active','suspended','lost','damaged','replaced','revoked')),
  issued_at timestamptz not null default now(),
  activated_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  revoked_by_membership_id uuid,
  revoked_by_person_id uuid,
  replacement_card_id uuid,
  issued_by_membership_id uuid not null,
  issued_by_person_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,school_id),
  unique (school_id,card_number),
  foreign key (school_id,student_id) references public.student_records(school_id,id) on delete restrict,
  foreign key (staff_record_id,school_id) references public.staff_records(id,school_id) on delete restrict,
  foreign key (replacement_card_id,school_id) references public.card_assignments(id,school_id) on delete restrict,
  foreign key (school_id,issued_by_membership_id,issued_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  foreign key (school_id,revoked_by_membership_id,revoked_by_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  check (length(btrim(card_number)) > 0),
  check ((holder_kind='student' and student_id is not null and staff_record_id is null)
      or (holder_kind='staff' and staff_record_id is not null and student_id is null)),
  check ((revoked_at is null) = (revoked_by_membership_id is null)
      and (revoked_at is null) = (revoked_by_person_id is null)),
  check ((status='revoked' and revoked_at is not null)
      or (status<>'revoked' and revoked_at is null)),
  check ((status in ('active','suspended','lost','damaged','replaced','revoked') and activated_at is not null)
      or (status='issued' and activated_at is null)),
  check ((status='suspended' and suspended_at is not null) or (status<>'suspended' and suspended_at is null)),
  check ((status='replaced' and replacement_card_id is not null) or (status<>'replaced' and replacement_card_id is null))
);
create unique index card_assignments_active_student_key on public.card_assignments (school_id,student_id)
  where holder_kind='student' and status in ('issued','active','suspended');
create unique index card_assignments_active_staff_key on public.card_assignments (school_id,staff_record_id)
  where holder_kind='staff' and status in ('issued','active','suspended');
create index card_assignments_school_status_idx on public.card_assignments (school_id,status,issued_at desc);
create index card_assignments_student_history_idx on public.card_assignments (school_id,student_id,issued_at desc) where student_id is not null;
create index card_assignments_staff_history_idx on public.card_assignments (school_id,staff_record_id,issued_at desc) where staff_record_id is not null;
create index card_assignments_issuer_idx on public.card_assignments (school_id,issued_by_membership_id,issued_by_person_id);

create table public.card_identifiers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  card_assignment_id uuid not null,
  identifier_kind text not null check (identifier_kind in ('nfc_uid','qr_token')),
  keyed_digest bytea not null check (octet_length(keyed_digest)=32),
  digest_key_version smallint not null check (digest_key_version > 0),
  status text not null default 'active' check (status in ('active','retired','revoked')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (school_id,identifier_kind,keyed_digest),
  foreign key (card_assignment_id,school_id) references public.card_assignments(id,school_id) on delete restrict,
  check ((status='active' and ended_at is null) or (status<>'active' and ended_at is not null))
);
create unique index card_identifiers_one_active_kind_per_card
  on public.card_identifiers (card_assignment_id,identifier_kind) where status='active';
create index card_identifiers_card_history_idx on public.card_identifiers (school_id,card_assignment_id,created_at desc);

create table public.card_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  card_assignment_id uuid not null,
  event_type text not null check (event_type in ('issued','activated','suspended','resumed','reported_lost','reported_damaged','replaced','revoked','identifier_rotated')),
  prior_status text,
  new_status text not null check (new_status in ('issued','active','suspended','lost','damaged','replaced','revoked')),
  actor_membership_id uuid not null,
  actor_person_id uuid not null,
  reason text,
  event_data jsonb not null default '{}'::jsonb check (jsonb_typeof(event_data)='object'),
  created_at timestamptz not null default now(),
  foreign key (card_assignment_id,school_id) references public.card_assignments(id,school_id) on delete restrict,
  foreign key (school_id,actor_membership_id,actor_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict
);
create index card_lifecycle_events_card_time_idx on public.card_lifecycle_events (school_id,card_assignment_id,created_at desc);
create index card_lifecycle_events_actor_time_idx on public.card_lifecycle_events (school_id,actor_membership_id,created_at desc);

create function private.reject_card_event_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'card lifecycle history is append-only' using errcode='55000';
end;
$$;
revoke all on function private.reject_card_event_mutation() from public,anon,authenticated,service_role;
create trigger card_lifecycle_events_no_update_delete before update or delete on public.card_lifecycle_events
  for each row execute function private.reject_card_event_mutation();
create trigger card_lifecycle_events_no_truncate before truncate on public.card_lifecycle_events
  for each statement execute function private.reject_card_event_mutation();

alter table public.attendance_scan_events add column card_assignment_id uuid;
alter table public.attendance_scan_events add constraint attendance_scan_events_card_scope_fkey
  foreign key (card_assignment_id,school_id) references public.card_assignments(id,school_id) on delete restrict;
create index attendance_scan_events_card_time_idx on public.attendance_scan_events (school_id,card_assignment_id,occurred_at desc) where card_assignment_id is not null;

alter table public.card_assignments enable row level security; alter table public.card_assignments force row level security;
alter table public.card_identifiers enable row level security; alter table public.card_identifiers force row level security;
alter table public.card_lifecycle_events enable row level security; alter table public.card_lifecycle_events force row level security;

create policy card_assignments_select_holder on public.card_assignments for select to authenticated using (
  (holder_kind='student' and exists (select 1 from public.student_records sr where sr.id=card_assignments.student_id and sr.school_id=card_assignments.school_id and sr.auth_user_id=(select auth.uid())))
  or (holder_kind='staff' and exists (select 1 from public.staff_records sr join public.persons p on p.id=sr.person_id where sr.id=card_assignments.staff_record_id and sr.school_id=card_assignments.school_id and p.auth_user_id=(select auth.uid()) and p.status='active'))
);
-- Identifiers, device credentials, other holders' cards and lifecycle details
-- have no authenticated Data API read policy.
revoke all privileges on table public.card_assignments,public.card_identifiers,public.card_lifecycle_events
  from public,anon,authenticated,service_role;
grant usage on schema public to authenticated;
grant select on table public.card_assignments to authenticated;
