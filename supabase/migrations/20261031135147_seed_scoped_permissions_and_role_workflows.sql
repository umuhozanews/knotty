-- Migration-managed built-in permissions and scoped role assignment RPCs.
-- Grant sets are derived from the legacy Express route middleware, narrowed
-- where the legacy broad access would violate tenant/sensitive-data isolation.

insert into private.role_definitions (scope,role_key,display_name) values
  ('platform','PLATFORM_ADMIN','Platform administrator'),
  ('organization','ORGANIZATION_MANAGER','Organization manager'),
  ('school','SCHOOL_MANAGER','School manager'),
  ('school','ADMIN','School administrator'),
  ('school','TEACHER','Teacher'),
  ('school','STUDENT','Student'),
  ('school','PARENT','Parent or guardian'),
  ('school','BURSAR','Bursar'),
  ('school','NURSE','Nurse'),
  ('school','DISCIPLINE','Discipline staff'),
  ('school','LIBRARIAN','Librarian'),
  ('school','CANTEEN','Canteen staff')
on conflict (scope,role_key) do update set display_name=excluded.display_name,is_active=true,updated_at=now();

insert into private.permission_catalog (scope,permission_key,description,is_sensitive) values
 ('platform','organizations.manage','Create and administer organizations',false),
 ('platform','schools.read','Read global school directory metadata',false),
 ('platform','schools.create','Create a school and its initial manager membership',false),
 ('platform','schools.manage','Manage global school registry and organization links',false),
 ('platform','roles.assign','Assign platform roles and appoint organization managers using an exact organization membership',true),
 ('platform','roles.read','Read platform role assignment history',true),
 ('platform','audit.read','Read platform security audit records',true),
 ('organization','organizations.read','Read the actor organization profile',false),
 ('organization','organizations.manage','Manage the actor organization profile',false),
 ('organization','schools.read','Read registry metadata for schools in the organization',false),
 ('organization','schools.create','Create a school in the actor organization',false),
 ('organization','schools.manage','Manage school registry metadata in the actor organization',false),
 ('organization','roles.assign','Assign organization roles',true),
 ('organization','roles.read','Read organization role assignment history',true),
 ('school','schools.read','Read school profile and non-sensitive configuration',false),
 ('school','schools.manage','Manage school profile, settings and academic calendar',false),
 ('school','students.read','Read standard student roster data',true),
 ('school','students.create','Register a student using a trusted provisioning workflow',true),
 ('school','students.update','Update student records and lifecycle status',true),
 ('school','students.archive','Withdraw, transfer or graduate students',true),
 ('school','students.read_sensitive','Read protected student identity and profile fields',true),
 ('school','students.read_self','Read own student profile only',true),
 ('school','guardians.manage','Invite, verify, approve and revoke guardian links',true),
 ('school','documents.manage','Register and manage student document metadata',true),
 ('school','staff.read','Read school staff directory',true),
 ('school','staff.manage','Create and manage school staff records and categories',true),
 ('school','staff.invite','Invite and link a staff Auth account',true),
 ('school','academics.read','Read academic structure, subjects and terms',false),
 ('school','academics.manage','Manage academic years, terms, classes, subjects and assignments',false),
 ('school','academics.assessments.manage','Create and manage exams, grades and report workflows',true),
 ('school','attendance.read','Read attendance records within authorized class scope',true),
 ('school','attendance.read_self','Read own attendance records only',true),
 ('school','attendance.record','Record student attendance within authorized class scope',true),
 ('school','attendance.correct','Correct attendance with reason and immutable audit history',true),
 ('school','attendance.staff.read','Read staff attendance within authorized scope',true),
 ('school','attendance.staff.record','Record staff attendance',true),
 ('school','cards.read','Read card assignment metadata in authorized scope',true),
 ('school','cards.read_self','Read own card assignment only',true),
 ('school','cards.issue','Issue a student or staff card',true),
 ('school','cards.manage','Activate, suspend, replace or revoke cards',true),
 ('school','reports.read','Read standard school reports',true),
 ('school','reports.read_sensitive','Read sensitive student report content',true),
 ('school','reports.manage','Create, update and publish reports',true),
 ('school','finance.read','Read school finance data',true),
 ('school','finance.read_self','Read own or authorized child finance data only',true),
 ('school','finance.manage','Manage fee structures, invoices and payments',true),
 ('school','finance.refund','Approve or process refunds and reversals',true),
 ('school','health.read_summary','Read limited clinic operational summaries',true),
 ('school','health.read_sensitive','Read identifiable health and medical records',true),
 ('school','health.manage','Create and update identifiable health records',true),
 ('school','discipline.read','Read standard discipline information in authorized scope',true),
 ('school','discipline.read_sensitive','Read detailed discipline case records',true),
 ('school','discipline.manage','Create and update discipline cases',true),
 ('school','gate.read','Read gate, access and visitor information',true),
 ('school','gate.manage','Manage gate devices, zones, overrides and visitor records',true),
 ('school','library.read','Read library catalog and own loans',false),
 ('school','library.manage','Manage catalog, copies, loans and reservations',true),
 ('school','canteen.read','Read canteen products and public menu',false),
 ('school','canteen.manage','Manage products, inventory and canteen operations',true),
 ('school','canteen.transactions.read','Read canteen transaction reports in authorized scope',true),
 ('school','materials.read','Read learning materials in authorized class scope',false),
 ('school','materials.manage','Upload and manage learning materials in authorized class scope',true),
 ('school','notifications.manage','Send school notifications',true),
 ('school','roles.read','Read scoped role assignments',true),
 ('school','roles.assign','Assign and revoke delegable school roles',true),
 ('guardian','students.read','Read linked student profile fields permitted by relationship',true),
 ('guardian','attendance.read','Read linked student attendance',true),
 ('guardian','reports.read','Read linked student reports',true),
 ('guardian','finance.read','Read linked student finance details',true),
 ('guardian','health.read','Read linked student health details',true),
 ('guardian','discipline.read','Read linked student discipline details',true),
 ('guardian','documents.read','Read linked student documents',true)
on conflict (scope,permission_key) do update set description=excluded.description,is_sensitive=excluded.is_sensitive;

-- The two legacy administrative school roles were accepted by ADMIN-gated
-- routes. Their permissions are explicit school-scope grants; they gain no
-- platform or organization permissions from this seed.
insert into private.role_permissions (scope,role_key,permission_key)
select 'school',r.role_key,p.permission_key
from (values ('ADMIN'),('SCHOOL_MANAGER')) as r(role_key)
cross join private.permission_catalog p where p.scope='school'
on conflict do nothing;

-- Domain role grants follow route-level evidence with sensitive data split out.
insert into private.role_permissions (scope,role_key,permission_key) values
 ('platform','PLATFORM_ADMIN','organizations.manage'),('platform','PLATFORM_ADMIN','schools.read'),
 ('platform','PLATFORM_ADMIN','schools.create'),('platform','PLATFORM_ADMIN','schools.manage'),
 ('platform','PLATFORM_ADMIN','roles.assign'),('platform','PLATFORM_ADMIN','roles.read'),('platform','PLATFORM_ADMIN','audit.read'),
 ('organization','ORGANIZATION_MANAGER','organizations.read'),('organization','ORGANIZATION_MANAGER','organizations.manage'),
 ('organization','ORGANIZATION_MANAGER','schools.read'),('organization','ORGANIZATION_MANAGER','schools.create'),
 ('organization','ORGANIZATION_MANAGER','schools.manage'),('organization','ORGANIZATION_MANAGER','roles.assign'),('organization','ORGANIZATION_MANAGER','roles.read'),
 ('school','TEACHER','schools.read'),('school','TEACHER','students.read'),('school','TEACHER','students.create'),
 ('school','TEACHER','students.update'),('school','TEACHER','students.read_sensitive'),('school','TEACHER','staff.read'),
 ('school','TEACHER','academics.read'),('school','TEACHER','academics.assessments.manage'),('school','TEACHER','attendance.read'),
 ('school','TEACHER','attendance.record'),('school','TEACHER','attendance.staff.read'),('school','TEACHER','cards.read'),
 ('school','TEACHER','cards.issue'),('school','TEACHER','reports.read'),('school','TEACHER','reports.manage'),
 ('school','TEACHER','discipline.read'),('school','TEACHER','discipline.manage'),('school','TEACHER','gate.read'),
 ('school','TEACHER','library.read'),('school','TEACHER','library.manage'),('school','TEACHER','materials.read'),
 ('school','TEACHER','materials.manage'),('school','TEACHER','canteen.read'),('school','TEACHER','canteen.transactions.read'),
 ('school','TEACHER','health.read_summary'),('school','TEACHER','reports.read_sensitive'),
 ('school','STUDENT','students.read_self'),('school','STUDENT','attendance.read_self'),('school','STUDENT','reports.read'),
 ('school','STUDENT','reports.read_sensitive'),('school','STUDENT','cards.read_self'),('school','STUDENT','finance.read_self'),
 ('school','STUDENT','academics.read'),('school','STUDENT','library.read'),('school','STUDENT','canteen.read'),('school','STUDENT','materials.read'),
 ('school','PARENT','reports.read'),('school','PARENT','finance.read_self'),
 ('school','PARENT','academics.read'),('school','PARENT','library.read'),('school','PARENT','canteen.read'),
 ('school','BURSAR','schools.read'),('school','BURSAR','students.read'),('school','BURSAR','staff.read'),
 ('school','BURSAR','attendance.read'),('school','BURSAR','attendance.record'),('school','BURSAR','cards.read'),
 ('school','BURSAR','finance.read'),('school','BURSAR','finance.manage'),('school','BURSAR','finance.refund'),
 ('school','BURSAR','reports.read'),('school','BURSAR','health.read_summary'),('school','BURSAR','discipline.read'),
 ('school','BURSAR','gate.read'),('school','BURSAR','library.read'),('school','BURSAR','library.manage'),
 ('school','BURSAR','canteen.read'),('school','BURSAR','canteen.transactions.read'),
 ('school','NURSE','schools.read'),('school','NURSE','students.read'),('school','NURSE','staff.read'),
 ('school','NURSE','attendance.read'),('school','NURSE','attendance.record'),('school','NURSE','attendance.staff.read'),
 ('school','NURSE','cards.read'),('school','NURSE','health.read_sensitive'),('school','NURSE','health.manage'),
 ('school','NURSE','reports.read'),('school','NURSE','gate.read'),('school','NURSE','library.read'),
 ('school','DISCIPLINE','schools.read'),('school','DISCIPLINE','students.read'),('school','DISCIPLINE','staff.read'),
 ('school','DISCIPLINE','attendance.read'),('school','DISCIPLINE','attendance.record'),('school','DISCIPLINE','cards.read'),
 ('school','DISCIPLINE','reports.read'),('school','DISCIPLINE','discipline.read'),('school','DISCIPLINE','discipline.read_sensitive'),
 ('school','DISCIPLINE','discipline.manage'),('school','DISCIPLINE','gate.read'),('school','DISCIPLINE','gate.manage'),
 ('school','DISCIPLINE','library.read'),('school','DISCIPLINE','health.read_summary'),
 ('school','LIBRARIAN','schools.read'),('school','LIBRARIAN','students.read'),('school','LIBRARIAN','staff.read'),
 ('school','LIBRARIAN','academics.read'),('school','LIBRARIAN','cards.read'),('school','LIBRARIAN','reports.read'),
 ('school','LIBRARIAN','library.read'),('school','LIBRARIAN','library.manage'),('school','LIBRARIAN','gate.read'),
 ('school','CANTEEN','schools.read'),('school','CANTEEN','cards.read'),('school','CANTEEN','canteen.read'),
 ('school','CANTEEN','canteen.manage'),('school','CANTEEN','canteen.transactions.read'),('school','CANTEEN','library.read')
on conflict do nothing;

-- Guardian category grants are relationship-scoped, never role-only. The
-- role assignment itself cannot substitute for an active link plus grant row.
grant usage on schema private to authenticated;
grant select on table private.role_definitions,private.permission_catalog,private.role_permissions,private.delegable_roles to authenticated;
create policy role_definitions_read_authenticated on private.role_definitions for select to authenticated using (is_active);
create policy permission_catalog_read_authenticated on private.permission_catalog for select to authenticated using (true);
create policy role_permissions_read_authenticated on private.role_permissions for select to authenticated using (true);
create policy delegable_roles_read_authenticated on private.delegable_roles for select to authenticated using (true);

alter table public.platform_membership_roles add column assigned_reason text not null default 'legacy assignment'
  check (length(btrim(assigned_reason)) >= 3);
alter table public.platform_membership_roles add column revoked_reason text;
alter table public.platform_membership_roles add constraint platform_membership_roles_reason_state_check
  check ((status='active' and revoked_reason is null) or (status='revoked' and length(btrim(revoked_reason)) >= 3));
alter table public.organization_membership_roles add column assigned_reason text not null default 'legacy assignment'
  check (length(btrim(assigned_reason)) >= 3);
alter table public.organization_membership_roles add column revoked_reason text;
alter table public.organization_membership_roles add constraint organization_membership_roles_reason_state_check
  check ((status='active' and revoked_reason is null) or (status='revoked' and length(btrim(revoked_reason)) >= 3));
alter table public.school_membership_roles add column assigned_reason text not null default 'legacy assignment'
  check (length(btrim(assigned_reason)) >= 3);
alter table public.school_membership_roles add column revoked_reason text;
alter table public.school_membership_roles add constraint school_membership_roles_reason_state_check
  check ((status='active' and revoked_reason is null) or (status='revoked' and length(btrim(revoked_reason)) >= 3));

create or replace function private.has_school_permission(p_school_id uuid,p_permission_key text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.school_memberships sm
    join public.persons p on p.id=sm.person_id
    join public.school_membership_roles mr on mr.school_id=sm.school_id and mr.membership_id=sm.id and mr.person_id=sm.person_id
    join private.role_definitions rd on rd.scope='school' and rd.role_key=mr.role_key and rd.is_active
    join private.role_permissions rp on rp.scope=rd.scope and rp.role_key=rd.role_key and rp.permission_key=p_permission_key
    where sm.school_id=p_school_id and sm.status='active' and p.status='active'
      and p.auth_user_id=(select auth.uid()) and mr.status='active'
  );
$$;
create or replace function private.has_organization_permission(p_organization_id uuid,p_permission_key text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.organization_memberships om
    join public.persons p on p.id=om.person_id
    join public.organization_membership_roles mr on mr.organization_id=om.organization_id and mr.membership_id=om.id and mr.person_id=om.person_id
    join private.role_definitions rd on rd.scope='organization' and rd.role_key=mr.role_key and rd.is_active
    join private.role_permissions rp on rp.scope=rd.scope and rp.role_key=rd.role_key and rp.permission_key=p_permission_key
    where om.organization_id=p_organization_id and om.status='active' and p.status='active'
      and p.auth_user_id=(select auth.uid()) and mr.status='active'
  );
$$;
create or replace function private.has_platform_permission(p_permission_key text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.platform_memberships pm
    join public.persons p on p.id=pm.person_id
    join public.platform_membership_roles mr on mr.membership_id=pm.id and mr.person_id=pm.person_id
    join private.role_definitions rd on rd.scope='platform' and rd.role_key=mr.role_key and rd.is_active
    join private.role_permissions rp on rp.scope=rd.scope and rp.role_key=rd.role_key and rp.permission_key=p_permission_key
    where pm.status='active' and p.status='active' and p.auth_user_id=(select auth.uid()) and mr.status='active'
  );
$$;
revoke all on function private.has_school_permission(uuid,text),private.has_organization_permission(uuid,text),private.has_platform_permission(text) from public,anon,service_role;
grant execute on function private.has_school_permission(uuid,text),private.has_organization_permission(uuid,text),private.has_platform_permission(text) to authenticated;

create or replace function public.assign_scoped_role(p_scope text,p_scope_id uuid,p_target_membership_id uuid,p_role_key text,p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_person_id uuid; v_actor_membership_id uuid; v_actor_person_id uuid; v_target_person_id uuid; v_assignment_id uuid;
begin
  if (select auth.uid()) is null or length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'authenticated caller and assignment reason required' using errcode='42501';
  end if;
  select id into v_person_id from public.persons where auth_user_id=(select auth.uid()) and status='active';
  if v_person_id is null then raise exception 'active person identity required' using errcode='42501'; end if;
  if not exists(select 1 from private.role_definitions where scope=p_scope and role_key=p_role_key and is_active) then
    raise exception 'unknown or inactive role for requested scope' using errcode='22023';
  end if;

  if p_scope='platform' and p_scope_id is null then
    select id into v_actor_membership_id from public.platform_memberships where person_id=v_person_id and status='active' for update;
    select pm.person_id into v_target_person_id from public.platform_memberships pm join public.persons p on p.id=pm.person_id and p.status='active' where pm.id=p_target_membership_id and pm.status='active' for update of pm;
    v_actor_person_id:=v_person_id;
    if v_actor_membership_id is null or v_target_person_id is null then raise exception 'active platform memberships required' using errcode='42501'; end if;
    perform 1 from public.platform_membership_roles where membership_id=v_actor_membership_id and status='active' for share;
    if v_target_person_id=v_person_id or not private.has_platform_permission('roles.assign') or not exists (
      select 1 from public.platform_membership_roles ar join private.delegable_roles d on d.scope='platform' and d.delegator_role_key=ar.role_key
      where ar.membership_id=v_actor_membership_id and ar.person_id=v_person_id and ar.status='active' and d.delegate_role_key=p_role_key
    ) then raise exception 'not authorized to assign this platform role' using errcode='42501'; end if;
    insert into public.platform_membership_roles(membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason)
      values(p_target_membership_id,v_target_person_id,p_role_key,v_actor_membership_id,v_actor_person_id,btrim(p_reason)) returning id into v_assignment_id;
  elsif p_scope='organization' and p_scope_id is not null then
    select id into v_actor_membership_id from public.organization_memberships where organization_id=p_scope_id and person_id=v_person_id and status='active' for update;
    select om.person_id into v_target_person_id from public.organization_memberships om join public.persons p on p.id=om.person_id and p.status='active' where om.organization_id=p_scope_id and om.id=p_target_membership_id and om.status='active' for update of om;
    v_actor_person_id:=v_person_id;
    if v_actor_membership_id is null or v_target_person_id is null then raise exception 'active memberships in requested organization required' using errcode='42501'; end if;
    perform 1 from public.organization_membership_roles where organization_id=p_scope_id and membership_id=v_actor_membership_id and status='active' for share;
    if v_target_person_id=v_person_id or not (
      (private.has_platform_permission('roles.assign') and p_role_key='ORGANIZATION_MANAGER')
      or (private.has_organization_permission(p_scope_id,'roles.assign') and exists (
        select 1 from public.organization_membership_roles ar join private.delegable_roles d on d.scope='organization' and d.delegator_role_key=ar.role_key
        where ar.organization_id=p_scope_id and ar.membership_id=v_actor_membership_id and ar.person_id=v_person_id and ar.status='active' and d.delegate_role_key=p_role_key
      ))
    ) then raise exception 'not authorized to assign this organization role' using errcode='42501'; end if;
    insert into public.organization_membership_roles(organization_id,membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason)
      values(p_scope_id,p_target_membership_id,v_target_person_id,p_role_key,v_actor_membership_id,v_actor_person_id,btrim(p_reason)) returning id into v_assignment_id;
  elsif p_scope='school' and p_scope_id is not null then
    select id into v_actor_membership_id from public.school_memberships where school_id=p_scope_id and person_id=v_person_id and status='active' for update;
    select sm.person_id into v_target_person_id from public.school_memberships sm join public.persons p on p.id=sm.person_id and p.status='active' where sm.school_id=p_scope_id and sm.id=p_target_membership_id and sm.status='active' for update of sm;
    v_actor_person_id:=v_person_id;
    if v_actor_membership_id is null or v_target_person_id is null then raise exception 'active memberships in requested school required' using errcode='42501'; end if;
    perform 1 from public.school_membership_roles where school_id=p_scope_id and membership_id=v_actor_membership_id and status='active' for share;
    if v_target_person_id=v_person_id or not private.has_school_permission(p_scope_id,'roles.assign') or not exists (
      select 1 from public.school_membership_roles ar join private.delegable_roles d on d.scope='school' and d.delegator_role_key=ar.role_key
      where ar.school_id=p_scope_id and ar.membership_id=v_actor_membership_id and ar.person_id=v_person_id and ar.status='active' and d.delegate_role_key=p_role_key
    ) then raise exception 'not authorized to assign this school role' using errcode='42501'; end if;
    insert into public.school_membership_roles(school_id,membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason)
      values(p_scope_id,p_target_membership_id,v_target_person_id,p_role_key,v_actor_membership_id,v_actor_person_id,btrim(p_reason)) returning id into v_assignment_id;
  else
    raise exception 'scope and tenant context do not match' using errcode='22023';
  end if;
  return v_assignment_id;
end;
$$;
alter function public.assign_scoped_role(text,uuid,uuid,text,text) owner to postgres;
revoke all on function public.assign_scoped_role(text,uuid,uuid,text,text) from public,anon,service_role;
grant execute on function public.assign_scoped_role(text,uuid,uuid,text,text) to authenticated;

create or replace function public.revoke_scoped_role(p_scope text,p_scope_id uuid,p_assignment_id uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_person_id uuid; v_actor_membership_id uuid; v_actor_person_id uuid; v_target_person_id uuid;
begin
  if (select auth.uid()) is null or length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'authenticated caller and revocation reason required' using errcode='42501';
  end if;
  select id into v_person_id from public.persons where auth_user_id=(select auth.uid()) and status='active';
  if v_person_id is null then raise exception 'active person identity required' using errcode='42501'; end if;
  if p_scope='platform' and p_scope_id is null then
    select a.id,a.person_id into v_actor_membership_id,v_actor_person_id from public.platform_memberships a where a.person_id=v_person_id and a.status='active' for update;
    if v_actor_membership_id is null then raise exception 'active platform membership required' using errcode='42501'; end if;
    perform 1 from public.platform_membership_roles where membership_id=v_actor_membership_id and status='active' for share;
    update public.platform_membership_roles target set status='revoked',revoked_at=now(),revoked_by_membership_id=v_actor_membership_id,revoked_by_person_id=v_actor_person_id,revoked_reason=btrim(p_reason)
    where target.id=p_assignment_id and target.status='active' and target.person_id<>v_person_id
      and private.has_platform_permission('roles.assign')
      and exists(select 1 from public.platform_membership_roles ar join private.delegable_roles d on d.scope='platform' and d.delegator_role_key=ar.role_key where ar.membership_id=v_actor_membership_id and ar.status='active' and d.delegate_role_key=target.role_key);
  elsif p_scope='organization' and p_scope_id is not null then
    select id into v_actor_membership_id from public.organization_memberships where organization_id=p_scope_id and person_id=v_person_id and status='active' for update;
    if v_actor_membership_id is null then raise exception 'active organization membership required' using errcode='42501'; end if;
    v_actor_person_id:=v_person_id;
    perform 1 from public.organization_membership_roles where organization_id=p_scope_id and membership_id=v_actor_membership_id and status='active' for share;
    update public.organization_membership_roles target set status='revoked',revoked_at=now(),revoked_by_membership_id=v_actor_membership_id,revoked_by_person_id=v_person_id,revoked_reason=btrim(p_reason)
    where target.id=p_assignment_id and target.organization_id=p_scope_id and target.status='active' and target.person_id<>v_person_id
      and ((private.has_platform_permission('roles.assign') and target.role_key='ORGANIZATION_MANAGER')
        or (private.has_organization_permission(p_scope_id,'roles.assign') and exists(select 1 from public.organization_membership_roles ar join private.delegable_roles d on d.scope='organization' and d.delegator_role_key=ar.role_key where ar.organization_id=p_scope_id and ar.membership_id=v_actor_membership_id and ar.status='active' and d.delegate_role_key=target.role_key)));
  elsif p_scope='school' and p_scope_id is not null then
    select id into v_actor_membership_id from public.school_memberships where school_id=p_scope_id and person_id=v_person_id and status='active' for update;
    if v_actor_membership_id is null then raise exception 'active school membership required' using errcode='42501'; end if;
    v_actor_person_id:=v_person_id;
    perform 1 from public.school_membership_roles where school_id=p_scope_id and membership_id=v_actor_membership_id and status='active' for share;
    update public.school_membership_roles target set status='revoked',revoked_at=now(),revoked_by_membership_id=v_actor_membership_id,revoked_by_person_id=v_person_id,revoked_reason=btrim(p_reason)
    where target.id=p_assignment_id and target.school_id=p_scope_id and target.status='active' and target.person_id<>v_person_id
      and private.has_school_permission(p_scope_id,'roles.assign')
      and exists(select 1 from public.school_membership_roles ar join private.delegable_roles d on d.scope='school' and d.delegator_role_key=ar.role_key where ar.school_id=p_scope_id and ar.membership_id=v_actor_membership_id and ar.status='active' and d.delegate_role_key=target.role_key);
  else
    raise exception 'scope and tenant context do not match' using errcode='22023';
  end if;
  if not found then raise exception 'role assignment not found or caller is not authorized to revoke it' using errcode='42501'; end if;
end;
$$;
alter function public.revoke_scoped_role(text,uuid,uuid,text) owner to postgres;
revoke all on function public.revoke_scoped_role(text,uuid,uuid,text) from public,anon,service_role;
grant execute on function public.revoke_scoped_role(text,uuid,uuid,text) to authenticated;

create or replace function public.list_scoped_role_assignments(p_scope text,p_scope_id uuid)
returns table(scope text,scope_id uuid,assignment_id uuid,membership_id uuid,person_id uuid,role_key text,status text,
  assigned_by_person_id uuid,assigned_at timestamptz,assigned_reason text,revoked_by_person_id uuid,revoked_at timestamptz,revoked_reason text)
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'authenticated caller required' using errcode='42501'; end if;
  if p_scope='platform' and p_scope_id is null and private.has_platform_permission('roles.read') then
    return query select 'platform'::text,null::uuid,a.id,a.membership_id,a.person_id,a.role_key,a.status,a.assigned_by_person_id,a.assigned_at,a.assigned_reason,a.revoked_by_person_id,a.revoked_at,a.revoked_reason from public.platform_membership_roles a order by a.assigned_at desc;
  elsif p_scope='organization' and p_scope_id is not null and private.has_organization_permission(p_scope_id,'roles.read') then
    return query select 'organization'::text,p_scope_id,a.id,a.membership_id,a.person_id,a.role_key,a.status,a.assigned_by_person_id,a.assigned_at,a.assigned_reason,a.revoked_by_person_id,a.revoked_at,a.revoked_reason from public.organization_membership_roles a where a.organization_id=p_scope_id order by a.assigned_at desc;
  elsif p_scope='school' and p_scope_id is not null and private.has_school_permission(p_scope_id,'roles.read') then
    return query select 'school'::text,p_scope_id,a.id,a.membership_id,a.person_id,a.role_key,a.status,a.assigned_by_person_id,a.assigned_at,a.assigned_reason,a.revoked_by_person_id,a.revoked_at,a.revoked_reason from public.school_membership_roles a where a.school_id=p_scope_id order by a.assigned_at desc;
  else
    raise exception 'not authorized to read role assignments in this scope' using errcode='42501';
  end if;
end;
$$;
alter function public.list_scoped_role_assignments(text,uuid) owner to postgres;
revoke all on function public.list_scoped_role_assignments(text,uuid) from public,anon,service_role;
grant execute on function public.list_scoped_role_assignments(text,uuid) to authenticated;

-- Only manager roles delegate. School Admin cannot promote another person to
-- Admin/School Manager; organization/platform powers remain in their scope.
insert into private.delegable_roles (scope,delegator_role_key,delegate_role_key)
select 'school','SCHOOL_MANAGER',role_key from private.role_definitions where scope='school'
on conflict do nothing;
insert into private.delegable_roles (scope,delegator_role_key,delegate_role_key) values
 ('school','ADMIN','TEACHER'),('school','ADMIN','STUDENT'),('school','ADMIN','PARENT'),('school','ADMIN','BURSAR'),
 ('school','ADMIN','NURSE'),('school','ADMIN','DISCIPLINE'),('school','ADMIN','LIBRARIAN'),('school','ADMIN','CANTEEN'),
 ('organization','ORGANIZATION_MANAGER','ORGANIZATION_MANAGER'),
 ('platform','PLATFORM_ADMIN','PLATFORM_ADMIN')
on conflict do nothing;

-- Raw authenticated selects on student_records are intentionally not widened:
-- sensitive columns share that table, so standard roster access must use a
-- reviewed safe projection/RPC in the student workflow migration.
