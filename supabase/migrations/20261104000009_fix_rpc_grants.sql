-- Re-apply EXECUTE grants for all public RPCs called by the frontend.
-- Safe to run multiple times (idempotent).

-- Student roster (admin view)
grant execute on function public.list_school_students(uuid, uuid, text) to authenticated;

-- Staff roster
grant execute on function public.list_school_staff_members(uuid) to authenticated;

-- Gate overview & visitor management
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'get_gate_overview') then
    execute 'grant execute on function public.get_gate_overview(uuid) to authenticated';
  end if;
end $$;

-- Student self-service RPCs
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'get_my_wallet') then
    execute 'grant execute on function public.get_my_wallet(uuid) to authenticated';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'get_my_attendance') then
    execute 'grant execute on function public.get_my_attendance(uuid, integer) to authenticated';
  end if;
end $$;
