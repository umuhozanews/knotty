-- Keep every school time-zone write valid, including writes outside the
-- settings RPC, so attendance-local date/time conversion cannot be poisoned.
create function private.validate_school_settings_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names tz
    where tz.name = new.timezone
  ) then
    raise exception 'unsupported school time zone: %', new.timezone
      using errcode = '22023';
  end if;
  return new;
end;
$$;
alter function private.validate_school_settings_timezone() owner to postgres;
revoke all on function private.validate_school_settings_timezone() from public, anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1
    from public.school_settings ss
    where not exists (
      select 1 from pg_catalog.pg_timezone_names tz where tz.name = ss.timezone
    )
  ) then
    raise exception 'existing school settings contain an unsupported time zone';
  end if;
end;
$$;

create trigger school_settings_timezone_valid
before insert or update of timezone on public.school_settings
for each row execute function private.validate_school_settings_timezone();

-- Expose only the bounded outcome contract required by device clients. The
-- scan event remains the source of truth and student/staff identity is omitted.
create function public.get_attendance_scan_outcome(p_scan_event_id uuid)
returns table(scan_event_id uuid, outcome text, rejection_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.outcome, e.rejection_code
  from public.attendance_scan_events e
  where e.id = p_scan_event_id
    and e.outcome in ('accepted', 'rejected', 'duplicate');
$$;
alter function public.get_attendance_scan_outcome(uuid) owner to postgres;
revoke all on function public.get_attendance_scan_outcome(uuid) from public, anon, authenticated;
grant execute on function public.get_attendance_scan_outcome(uuid) to service_role;
