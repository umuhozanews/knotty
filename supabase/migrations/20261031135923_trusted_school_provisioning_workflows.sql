-- Append-only operational audit for school and academic workflows.
create table public.school_operation_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  entity_type text not null check (entity_type in ('school','settings','academic_year','academic_term','education_level','class_section')),
  entity_id uuid not null,
  event_type text not null check (length(btrim(event_type)) > 0),
  actor_scope text not null check (actor_scope in ('platform','organization','school')),
  actor_person_id uuid not null references public.persons(id) on delete restrict,
  platform_membership_id uuid,
  actor_organization_id uuid,
  organization_membership_id uuid,
  school_membership_id uuid,
  event_data jsonb not null default '{}'::jsonb check (jsonb_typeof(event_data)='object'),
  created_at timestamptz not null default now(),
  foreign key (platform_membership_id,actor_person_id)
    references public.platform_memberships(id,person_id) on delete restrict,
  foreign key (actor_organization_id,organization_membership_id,actor_person_id)
    references public.organization_memberships(organization_id,id,person_id) on delete restrict,
  foreign key (school_id,school_membership_id,actor_person_id)
    references public.school_memberships(school_id,id,person_id) on delete restrict,
  check (
    (actor_scope='platform' and platform_membership_id is not null
      and actor_organization_id is null and organization_membership_id is null and school_membership_id is null)
    or (actor_scope='organization' and platform_membership_id is null
      and actor_organization_id is not null and organization_membership_id is not null and school_membership_id is null)
    or (actor_scope='school' and platform_membership_id is null
      and actor_organization_id is null and organization_membership_id is null and school_membership_id is not null)
  )
);
create index school_operation_audit_entity_time_idx on public.school_operation_audit (school_id,entity_type,entity_id,created_at desc);
create index school_operation_audit_actor_time_idx on public.school_operation_audit (school_id,actor_scope,actor_person_id,created_at desc);
alter table public.school_operation_audit enable row level security;
alter table public.school_operation_audit force row level security;
revoke all privileges on table public.school_operation_audit from public,anon,authenticated,service_role;

create policy schools_select_platform_registry on public.schools for select to authenticated
  using (private.has_platform_permission('schools.read'));
create policy schools_select_organization_registry on public.schools for select to authenticated
  using (organization_id is not null and private.has_organization_permission(organization_id,'schools.read'));

create function private.reject_school_operation_audit_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin raise exception 'school operation audit is append-only' using errcode='55000'; end;
$$;
revoke all on function private.reject_school_operation_audit_mutation() from public,anon,authenticated,service_role;
create trigger school_operation_audit_no_update_delete before update or delete on public.school_operation_audit
  for each row execute function private.reject_school_operation_audit_mutation();
create trigger school_operation_audit_no_truncate before truncate on public.school_operation_audit
  for each statement execute function private.reject_school_operation_audit_mutation();

create function private.require_school_actor(p_school_id uuid,p_permission_key text)
returns table(membership_id uuid,person_id uuid)
language plpgsql security invoker set search_path = '' as $$
begin
  select sm.id,sm.person_id into membership_id,person_id
  from public.school_memberships sm join public.persons p on p.id=sm.person_id
  where sm.school_id=p_school_id and sm.status='active' and p.status='active' and p.auth_user_id=(select auth.uid());
  if membership_id is null or not private.has_school_permission(p_school_id,p_permission_key) then
    raise exception 'active school membership and permission required' using errcode='42501';
  end if;
  return next;
end;
$$;
revoke all on function private.require_school_actor(uuid,text) from public,anon,authenticated,service_role;

create function private.require_school_registry_actor(p_school_id uuid,p_permission_key text)
returns table(actor_scope text,person_id uuid,platform_membership_id uuid,actor_organization_id uuid,
  organization_membership_id uuid,school_membership_id uuid)
language plpgsql security invoker set search_path = '' as $$
declare v_org_id uuid; v_person_id uuid;
begin
  select p.id into v_person_id from public.persons p where p.auth_user_id=(select auth.uid()) and p.status='active';
  if v_person_id is null then raise exception 'active person identity required' using errcode='42501'; end if;
  select s.organization_id into v_org_id from public.schools s where s.id=p_school_id;
  if not found then raise exception 'school not found' using errcode='P0002'; end if;
  if private.has_platform_permission(p_permission_key) then
    select pm.id into platform_membership_id from public.platform_memberships pm where pm.person_id=v_person_id and pm.status='active';
    if platform_membership_id is not null then actor_scope:='platform'; person_id:=v_person_id; return next; return; end if;
  end if;
  if v_org_id is not null and private.has_organization_permission(v_org_id,p_permission_key) then
    select om.id into organization_membership_id from public.organization_memberships om
      where om.organization_id=v_org_id and om.person_id=v_person_id and om.status='active';
    if organization_membership_id is not null then actor_scope:='organization'; person_id:=v_person_id; actor_organization_id:=v_org_id; return next; return; end if;
  end if;
  if private.has_school_permission(p_school_id,p_permission_key) then
    select sm.id into school_membership_id from public.school_memberships sm
      where sm.school_id=p_school_id and sm.person_id=v_person_id and sm.status='active';
    if school_membership_id is not null then actor_scope:='school'; person_id:=v_person_id; return next; return; end if;
  end if;
  raise exception 'not authorized to manage this school' using errcode='42501';
end;
$$;
revoke all on function private.require_school_registry_actor(uuid,text) from public,anon,authenticated,service_role;

create function private.write_school_audit(p_school_id uuid,p_entity_type text,p_entity_id uuid,p_event_type text,
  p_actor_scope text,p_person_id uuid,p_platform_membership_id uuid,p_actor_organization_id uuid,
  p_organization_membership_id uuid,p_school_membership_id uuid,p_event_data jsonb default '{}'::jsonb)
returns void language sql security invoker set search_path = '' as $$
  insert into public.school_operation_audit(school_id,entity_type,entity_id,event_type,actor_scope,actor_person_id,
    platform_membership_id,actor_organization_id,organization_membership_id,school_membership_id,event_data)
  values(p_school_id,p_entity_type,p_entity_id,p_event_type,p_actor_scope,p_person_id,p_platform_membership_id,
    p_actor_organization_id,p_organization_membership_id,p_school_membership_id,coalesce(p_event_data,'{}'::jsonb));
$$;
revoke all on function private.write_school_audit(uuid,text,uuid,text,text,uuid,uuid,uuid,uuid,uuid,jsonb)
  from public,anon,authenticated,service_role;

create function public.provision_school(p_organization_id uuid,p_name text,p_code text,p_email text,p_phone text default null,p_address text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_person_id uuid; v_platform_id uuid; v_org_member_id uuid; v_scope text; v_school_id uuid; v_school_member_id uuid;
begin
  select id into v_person_id from public.persons where auth_user_id=(select auth.uid()) and status='active';
  if v_person_id is null or length(btrim(coalesce(p_name,'')))=0 or length(btrim(coalesce(p_code,'')))=0 or position('@' in coalesce(p_email,'')) < 2 then
    raise exception 'authenticated active person and valid school fields required' using errcode='22023';
  end if;
  if private.has_platform_permission('schools.create') then
    select id into v_platform_id from public.platform_memberships where person_id=v_person_id and status='active';
    if v_platform_id is null then raise exception 'active platform membership required' using errcode='42501'; end if;
    v_scope:='platform';
  elsif p_organization_id is not null and private.has_organization_permission(p_organization_id,'schools.create') then
    select id into v_org_member_id from public.organization_memberships where organization_id=p_organization_id and person_id=v_person_id and status='active';
    if v_org_member_id is null then raise exception 'active organization membership required' using errcode='42501'; end if;
    v_scope:='organization';
  else
    raise exception 'school creation permission required for requested organization' using errcode='42501';
  end if;
  if exists(select 1 from public.school_memberships where person_id=v_person_id and status='active') then
    raise exception 'school creator already has an active school membership; assign an eligible initial school manager through an approved bootstrap process' using errcode='23505';
  end if;
  insert into public.schools(organization_id,name,code,email,phone,address)
    values(p_organization_id,btrim(p_name),btrim(p_code),lower(btrim(p_email)),nullif(btrim(p_phone),''),nullif(btrim(p_address),'')) returning id into v_school_id;
  insert into public.school_settings(school_id) values(v_school_id);
  insert into public.school_memberships(school_id,person_id,status,started_at) values(v_school_id,v_person_id,'active',now()) returning id into v_school_member_id;
  insert into public.school_membership_roles(school_id,membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason)
    values(v_school_id,v_school_member_id,v_person_id,'SCHOOL_MANAGER',v_school_member_id,v_person_id,'initial manager granted by authorized school provisioning');
  perform private.write_school_audit(v_school_id,'school',v_school_id,'school_provisioned',v_scope,v_person_id,v_platform_id,
    case when v_scope='organization' then p_organization_id else null end,v_org_member_id,null,'{}'::jsonb);
  return v_school_id;
end;
$$;
alter function public.provision_school(uuid,text,text,text,text,text) owner to postgres;
revoke all on function public.provision_school(uuid,text,text,text,text,text) from public,anon,service_role;
grant execute on function public.provision_school(uuid,text,text,text,text,text) to authenticated;

create function public.update_school_profile(p_school_id uuid,p_name text default null,p_phone text default null,p_address text default null,p_branch_code text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record;
begin
  select * into v_actor from private.require_school_registry_actor(p_school_id,'schools.manage');
  if p_name is not null and length(btrim(p_name))=0 then raise exception 'school name cannot be blank' using errcode='22023'; end if;
  update public.schools set name=coalesce(nullif(btrim(p_name),''),name),
    phone=case when p_phone is null then phone else nullif(btrim(p_phone),'') end,
    address=case when p_address is null then address else nullif(btrim(p_address),'') end,
    branch_code=case when p_branch_code is null then branch_code else nullif(btrim(p_branch_code),'') end,
    updated_at=now() where id=p_school_id;
  perform private.write_school_audit(p_school_id,'school',p_school_id,'school_profile_updated',v_actor.actor_scope,v_actor.person_id,
    v_actor.platform_membership_id,v_actor.actor_organization_id,v_actor.organization_membership_id,v_actor.school_membership_id,
    jsonb_build_object('changed',array_remove(array[case when p_name is not null then 'name' end,case when p_phone is not null then 'phone' end,case when p_address is not null then 'address' end,case when p_branch_code is not null then 'branch_code' end],null)));
end;
$$;
alter function public.update_school_profile(uuid,text,text,text,text) owner to postgres;
revoke all on function public.update_school_profile(uuid,text,text,text,text) from public,anon,service_role;
grant execute on function public.update_school_profile(uuid,text,text,text,text) to authenticated;

create function public.update_school_settings(p_school_id uuid,p_timezone text,p_locale text,p_currency char(3),p_curriculum_framework text,p_school_day_start time,p_week_starts_on smallint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'schools.manage');
  update public.school_settings set timezone=p_timezone,locale=p_locale,default_currency=p_currency,
    curriculum_framework=p_curriculum_framework,school_day_start=p_school_day_start,week_starts_on=p_week_starts_on,
    updated_by_membership_id=v_actor.membership_id,updated_by_person_id=v_actor.person_id,updated_at=now()
  where school_id=p_school_id;
  if not found then raise exception 'school settings not found' using errcode='P0002'; end if;
  perform private.write_school_audit(p_school_id,'settings',p_school_id,'school_settings_updated','school',v_actor.person_id,null,null,null,v_actor.membership_id,
    jsonb_build_object('timezone',p_timezone,'locale',p_locale,'currency',p_currency,'curriculum_framework',p_curriculum_framework));
end;
$$;
alter function public.update_school_settings(uuid,text,text,char,text,time,smallint) owner to postgres;
revoke all on function public.update_school_settings(uuid,text,text,char,text,time,smallint) from public,anon,service_role;
grant execute on function public.update_school_settings(uuid,text,text,char,text,time,smallint) to authenticated;

create function public.create_academic_year(p_school_id uuid,p_name text,p_start_date date,p_end_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'academics.manage');
  if length(btrim(coalesce(p_name,'')))=0 or p_end_date<=p_start_date then raise exception 'valid year name and date range required' using errcode='22023'; end if;
  insert into public.academic_years(school_id,name,start_date,end_date,status,created_by_membership_id,created_by_person_id)
  values(p_school_id,btrim(p_name),p_start_date,p_end_date,'draft',v_actor.membership_id,v_actor.person_id) returning id into v_id;
  perform private.write_school_audit(p_school_id,'academic_year',v_id,'academic_year_created','school',v_actor.person_id,null,null,null,v_actor.membership_id,
    jsonb_build_object('status','draft'));
  return v_id;
end;
$$;
alter function public.create_academic_year(uuid,text,date,date) owner to postgres;
revoke all on function public.create_academic_year(uuid,text,date,date) from public,anon,service_role;
grant execute on function public.create_academic_year(uuid,text,date,date) to authenticated;

create function public.activate_academic_year(p_school_id uuid,p_academic_year_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_status text;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'academics.manage');
  select status into v_status from public.academic_years where id=p_academic_year_id and school_id=p_school_id for update;
  if not found then raise exception 'academic year not found in school' using errcode='P0002'; end if;
  if v_status<>'draft' then raise exception 'only a draft academic year can be activated' using errcode='23514'; end if;
  update public.academic_years set status='active',activated_at=now(),activated_by_membership_id=v_actor.membership_id,
    activated_by_person_id=v_actor.person_id,updated_at=now() where id=p_academic_year_id and school_id=p_school_id;
  perform private.write_school_audit(p_school_id,'academic_year',p_academic_year_id,'academic_year_activated','school',v_actor.person_id,null,null,null,v_actor.membership_id,'{}'::jsonb);
end;
$$;
alter function public.activate_academic_year(uuid,uuid) owner to postgres;
revoke all on function public.activate_academic_year(uuid,uuid) from public,anon,service_role;
grant execute on function public.activate_academic_year(uuid,uuid) to authenticated;

create function public.close_academic_year(p_school_id uuid,p_academic_year_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_status text;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'academics.manage');
  select status into v_status from public.academic_years where id=p_academic_year_id and school_id=p_school_id for update;
  if not found then raise exception 'academic year not found in school' using errcode='P0002'; end if;
  if v_status<>'active' then raise exception 'only an active academic year can be closed' using errcode='23514'; end if;
  if exists(select 1 from public.academic_terms where school_id=p_school_id and academic_year_id=p_academic_year_id and status='active') then
    raise exception 'close active academic terms before closing their year' using errcode='23514';
  end if;
  update public.academic_years set status='closed',closed_at=now(),closed_by_membership_id=v_actor.membership_id,
    closed_by_person_id=v_actor.person_id,updated_at=now() where id=p_academic_year_id and school_id=p_school_id;
  perform private.write_school_audit(p_school_id,'academic_year',p_academic_year_id,'academic_year_closed','school',v_actor.person_id,null,null,null,v_actor.membership_id,'{}'::jsonb);
end;
$$;
alter function public.close_academic_year(uuid,uuid) owner to postgres;
revoke all on function public.close_academic_year(uuid,uuid) from public,anon,service_role;
grant execute on function public.close_academic_year(uuid,uuid) to authenticated;

create function public.create_academic_term(p_school_id uuid,p_academic_year_id uuid,p_name text,p_sequence smallint,p_kind text,p_start_date date,p_end_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_year public.academic_years%rowtype; v_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'academics.manage');
  select * into v_year from public.academic_years where id=p_academic_year_id and school_id=p_school_id for share;
  if not found or v_year.status='closed' then raise exception 'open academic year required' using errcode='23514'; end if;
  if p_start_date<v_year.start_date or p_end_date>v_year.end_date or p_end_date<=p_start_date or length(btrim(coalesce(p_name,'')))=0 then
    raise exception 'term dates must be inside the academic year and name/date range valid' using errcode='22023';
  end if;
  insert into public.academic_terms(school_id,academic_year_id,name,sequence_number,term_kind,start_date,end_date,status,created_by_membership_id,created_by_person_id)
  values(p_school_id,p_academic_year_id,btrim(p_name),p_sequence,p_kind,p_start_date,p_end_date,'scheduled',v_actor.membership_id,v_actor.person_id) returning id into v_id;
  perform private.write_school_audit(p_school_id,'academic_term',v_id,'academic_term_created','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('status','scheduled'));
  return v_id;
end;
$$;
alter function public.create_academic_term(uuid,uuid,text,smallint,text,date,date) owner to postgres;
revoke all on function public.create_academic_term(uuid,uuid,text,smallint,text,date,date) from public,anon,service_role;
grant execute on function public.create_academic_term(uuid,uuid,text,smallint,text,date,date) to authenticated;

create function public.set_academic_term_status(p_school_id uuid,p_academic_term_id uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_term public.academic_terms%rowtype; v_year_status text;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'academics.manage');
  select * into v_term from public.academic_terms where id=p_academic_term_id and school_id=p_school_id for update;
  if not found then raise exception 'academic term not found in school' using errcode='P0002'; end if;
  if p_status not in ('active','closed') or v_term.status='closed' then raise exception 'invalid academic term state transition' using errcode='23514'; end if;
  if p_status='active' then
    select status into v_year_status from public.academic_years where id=v_term.academic_year_id and school_id=p_school_id;
    if v_year_status<>'active' then raise exception 'term can be activated only within an active academic year' using errcode='23514'; end if;
  end if;
  update public.academic_terms set status=p_status,updated_at=now() where id=p_academic_term_id and school_id=p_school_id;
  perform private.write_school_audit(p_school_id,'academic_term',p_academic_term_id,'academic_term_'||p_status,'school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('prior_status',v_term.status,'status',p_status));
end;
$$;
alter function public.set_academic_term_status(uuid,uuid,text) owner to postgres;
revoke all on function public.set_academic_term_status(uuid,uuid,text) from public,anon,service_role;
grant execute on function public.set_academic_term_status(uuid,uuid,text) to authenticated;

create function public.create_education_level(p_school_id uuid,p_level_code text,p_name text,p_stage text,p_display_order smallint,p_framework text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'academics.manage');
  insert into public.education_levels(school_id,level_code,name,stage,display_order,curriculum_framework)
    values(p_school_id,btrim(p_level_code),btrim(p_name),p_stage,p_display_order,nullif(btrim(p_framework),'')) returning id into v_id;
  perform private.write_school_audit(p_school_id,'education_level',v_id,'education_level_created','school',v_actor.person_id,null,null,null,v_actor.membership_id,'{}'::jsonb);
  return v_id;
end;
$$;
alter function public.create_education_level(uuid,text,text,text,smallint,text) owner to postgres;
revoke all on function public.create_education_level(uuid,text,text,text,smallint,text) from public,anon,service_role;
grant execute on function public.create_education_level(uuid,text,text,text,smallint,text) to authenticated;

create function public.create_class_section(p_school_id uuid,p_academic_year_id uuid,p_education_level_id uuid,p_section_code text,p_name text,p_stream_name text default null,p_capacity integer default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_year_status text; v_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'academics.manage');
  select status into v_year_status from public.academic_years where id=p_academic_year_id and school_id=p_school_id for share;
  if not found or v_year_status='closed' then raise exception 'open academic year required' using errcode='23514'; end if;
  insert into public.class_sections(school_id,academic_year_id,education_level_id,section_code,name,stream_name,capacity,created_by_membership_id,created_by_person_id)
    values(p_school_id,p_academic_year_id,p_education_level_id,btrim(p_section_code),btrim(p_name),nullif(btrim(p_stream_name),''),p_capacity,v_actor.membership_id,v_actor.person_id) returning id into v_id;
  perform private.write_school_audit(p_school_id,'class_section',v_id,'class_section_created','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('academic_year_id',p_academic_year_id));
  return v_id;
end;
$$;
alter function public.create_class_section(uuid,uuid,uuid,text,text,text,integer) owner to postgres;
revoke all on function public.create_class_section(uuid,uuid,uuid,text,text,text,integer) from public,anon,service_role;
grant execute on function public.create_class_section(uuid,uuid,uuid,text,text,text,integer) to authenticated;
