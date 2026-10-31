-- Trusted student lifecycle operations. Direct table writes remain revoked;
-- transactional RPCs derive human actors from auth.uid(). Auth Admin account
-- creation is performed only by the provision-student Edge Function.

alter table public.school_operation_audit drop constraint school_operation_audit_entity_type_check;
alter table public.school_operation_audit add constraint school_operation_audit_entity_type_check
  check (entity_type in ('school','settings','academic_year','academic_term','education_level','class_section','student','student_enrollment','student_placement','guardian_relationship','student_document','staff','teacher_assignment','attendance','card'));

alter table public.guardian_relationships add column guardian_school_membership_id uuid;
alter table public.guardian_relationships add constraint guardian_relationship_guardian_school_member_fkey
  foreign key (school_id,guardian_school_membership_id,guardian_person_id)
  references public.school_memberships(school_id,id,person_id) on delete restrict;
alter table public.guardian_relationships add constraint guardian_relationship_active_membership_check
  check (status <> 'active' or guardian_school_membership_id is not null);
alter table public.guardian_link_requests add column guardian_school_membership_id uuid;
alter table public.guardian_link_requests add constraint guardian_request_guardian_school_member_fkey
  foreign key (school_id,guardian_school_membership_id,guardian_person_id)
  references public.school_memberships(school_id,id,person_id) on delete restrict;
alter table public.guardian_link_requests add constraint guardian_request_activated_membership_check
  check (status <> 'activated' or (guardian_school_membership_id is not null and guardian_person_id is not null and guardian_auth_user_id is not null and relationship_id is not null and activated_at is not null));

create or replace function private.require_teacher_student_access(p_school_id uuid,p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.teacher_assignments ta
    join public.student_class_placements cp on cp.school_id=ta.school_id and cp.class_section_id=ta.class_section_id and cp.academic_year_id=ta.academic_year_id and cp.status='active'
    join public.student_enrollments se on se.id=cp.enrollment_id and se.school_id=cp.school_id and se.academic_year_id=cp.academic_year_id and se.status='enrolled'
    join public.staff_records sr on sr.id=ta.staff_record_id and sr.school_id=ta.school_id and sr.employment_status='active'
    join public.persons p on p.id=sr.person_id and p.auth_user_id=(select auth.uid()) and p.status='active'
    where ta.school_id=p_school_id and se.student_id=p_student_id and ta.status='active'
      and private.has_school_permission(p_school_id,'students.read')
  );
$$;
alter function private.require_teacher_student_access(uuid,uuid) owner to postgres;
revoke all on function private.require_teacher_student_access(uuid,uuid) from public,anon,service_role;
grant execute on function private.require_teacher_student_access(uuid,uuid) to authenticated;

-- Only the trusted Edge Function can invoke this. It first verifies the
-- caller JWT and students.create permission, creates an Auth user with the
-- Auth Admin API, and then passes that newly created UUID here. No Auth Admin
-- operation occurs in PostgreSQL.
create function public.register_student_from_edge(
  p_actor_auth_user_id uuid,p_student_auth_user_id uuid,p_school_id uuid,
  p_admission_number text,p_legal_name text,p_date_of_birth date,p_gender text,
  p_nationality text,p_contact_type text,p_contact_value text,p_contact_normalized text,
  p_academic_year_id uuid,p_class_section_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_person_id uuid; v_membership_id uuid; v_student_id uuid; v_enrollment_id uuid; v_placement_id uuid;
begin
  if p_actor_auth_user_id is null or p_student_auth_user_id is null or p_actor_auth_user_id=p_student_auth_user_id
     or length(btrim(coalesce(p_admission_number,'')))=0 or length(btrim(coalesce(p_legal_name,'')))=0
     or p_contact_type is null or p_contact_type not in ('email','phone') or length(btrim(coalesce(p_contact_value,'')))=0
     or length(btrim(coalesce(p_contact_normalized,'')))=0 then
    raise exception 'valid caller, student account, admission number, legal name and contact required' using errcode='22023';
  end if;
  if not exists(select 1 from auth.users u where u.id=p_student_auth_user_id) then raise exception 'student Auth user was not provisioned' using errcode='23503'; end if;
  if not exists(select 1 from auth.users u where u.id=p_actor_auth_user_id) then raise exception 'actor Auth user not found' using errcode='42501'; end if;
  select sm.id,sm.person_id into v_actor from public.school_memberships sm join public.persons p on p.id=sm.person_id
    where sm.school_id=p_school_id and sm.status='active' and p.status='active' and p.auth_user_id=p_actor_auth_user_id;
  if v_actor.id is null or not private.has_school_permission_for_user(p_actor_auth_user_id,p_school_id,'students.create') then
    raise exception 'active school actor with students.create required' using errcode='42501';
  end if;
  if exists(select 1 from public.persons where auth_user_id=p_student_auth_user_id) then raise exception 'Auth identity already linked to a person' using errcode='23505'; end if;
  insert into public.persons(auth_user_id,status) values(p_student_auth_user_id,'active') returning id into v_person_id;
  insert into private.person_private_identity(person_id,legal_name,date_of_birth,nationality)
    values(v_person_id,btrim(p_legal_name),p_date_of_birth,nullif(btrim(p_nationality),''));
  insert into private.person_contact_points(person_id,contact_type,contact_value,normalized_value,is_primary)
    values(v_person_id,p_contact_type,btrim(p_contact_value),btrim(p_contact_normalized),true);
  insert into public.school_memberships(school_id,person_id,status)
    values(p_school_id,v_person_id,'invited') returning id into v_membership_id;
  insert into public.school_membership_roles(school_id,membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason)
    values(p_school_id,v_membership_id,v_person_id,'STUDENT',v_actor.id,v_actor.person_id,'student account provisioned through authorized student registration');
  insert into public.student_records(school_id,person_id,auth_user_id,school_membership_id,admission_number,date_of_birth,gender,nationality,status,created_by_membership_id,created_by_person_id)
    values(p_school_id,v_person_id,p_student_auth_user_id,btrim(p_admission_number),p_date_of_birth,nullif(btrim(p_gender),''),nullif(btrim(p_nationality),''),'pending',v_actor.id,v_actor.person_id)
    returning id into v_student_id;
  if (p_academic_year_id is null) <> (p_class_section_id is null) then raise exception 'academic year and class must be supplied together' using errcode='22023'; end if;
  if p_academic_year_id is not null then
    if not exists(select 1 from public.academic_years where id=p_academic_year_id and school_id=p_school_id and status='active')
       or not exists(select 1 from public.class_sections where id=p_class_section_id and school_id=p_school_id and academic_year_id=p_academic_year_id and status='active') then
      raise exception 'active year and matching class required' using errcode='23503';
    end if;
    insert into public.student_enrollments(school_id,student_id,academic_year_id,status,created_by_membership_id,created_by_person_id)
      values(p_school_id,v_student_id,p_academic_year_id,'enrolled',v_actor.id,v_actor.person_id) returning id into v_enrollment_id;
    insert into public.student_class_placements(school_id,academic_year_id,enrollment_id,class_section_id,assigned_by_membership_id,assigned_by_person_id)
      values(p_school_id,p_academic_year_id,v_enrollment_id,p_class_section_id,v_actor.id,v_actor.person_id) returning id into v_placement_id;
    perform private.write_school_audit(p_school_id,'student_enrollment',v_enrollment_id,'student_enrolled','school',v_actor.person_id,null,null,null,v_actor.id,jsonb_build_object('student_id',v_student_id,'placement_id',v_placement_id));
  end if;
  perform private.write_school_audit(p_school_id,'student',v_student_id,'student_registered','school',v_actor.person_id,null,null,null,v_actor.id,jsonb_build_object('admission_number',btrim(p_admission_number)));
  return v_student_id;
end;
$$;
alter function public.register_student_from_edge(uuid,uuid,uuid,text,text,date,text,text,text,text,text,uuid,uuid) owner to postgres;
revoke all on function public.register_student_from_edge(uuid,uuid,uuid,text,text,date,text,text,text,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.register_student_from_edge(uuid,uuid,uuid,text,text,date,text,text,text,text,text,uuid,uuid) to service_role;

create function public.can_register_students(p_school_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select (select auth.uid()) is not null and private.has_school_permission(p_school_id,'students.create')
    and exists(select 1 from public.school_memberships sm join public.persons p on p.id=sm.person_id
      where sm.school_id=p_school_id and sm.status='active' and p.status='active' and p.auth_user_id=(select auth.uid()));
$$;
revoke all on function public.can_register_students(uuid) from public,anon,service_role;
grant execute on function public.can_register_students(uuid) to authenticated;

create function public.activate_student_account()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_school_id uuid; v_student_id uuid; v_person_id uuid; v_membership_id uuid; v_contact_id uuid;
begin
  v_uid:=(select auth.uid());
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  select sr.school_id,sr.id,sr.person_id,sr.school_membership_id into v_school_id,v_student_id,v_person_id,v_membership_id
    from public.student_records sr join public.persons p on p.id=sr.person_id and p.auth_user_id=sr.auth_user_id
    where sr.auth_user_id=v_uid and sr.status='pending' for update of sr;
  if v_person_id is null then raise exception 'pending student account not found' using errcode='P0002'; end if;
  select cp.id into v_contact_id from private.person_contact_points cp join auth.users u on u.id=v_uid
    where cp.person_id=v_person_id and cp.verified_at is null and ((cp.contact_type='email' and lower(cp.normalized_value)=lower(u.email) and u.email_confirmed_at is not null)
      or (cp.contact_type='phone' and cp.normalized_value=u.phone and u.phone_confirmed_at is not null)) for update of cp;
  if v_contact_id is null then raise exception 'verify the invited email or phone before activation' using errcode='42501'; end if;
  update private.person_contact_points set verified_at=now(),updated_at=now() where id=v_contact_id;
  update public.school_memberships set status='active',started_at=now(),updated_at=now() where id=v_membership_id and status='invited';
  update public.student_records set status='active',updated_at=now() where auth_user_id=v_uid and school_id=v_school_id;
  perform private.write_school_audit(v_school_id,'student',v_student_id,'student_account_activated','school',v_person_id,null,null,null,v_membership_id,'{}'::jsonb);
  return v_school_id;
end;
$$;
alter function public.activate_student_account() owner to postgres;
revoke all on function public.activate_student_account() from public,anon,service_role;
grant execute on function public.activate_student_account() to authenticated;

create function private.has_school_permission_for_user(p_auth_user_id uuid,p_school_id uuid,p_permission_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.persons p join public.school_memberships sm on sm.person_id=p.id
    join public.school_membership_roles smr on smr.membership_id=sm.id and smr.school_id=sm.school_id
    join private.role_permissions rp on rp.scope='school' and rp.role_key=smr.role_key and rp.permission_key=p_permission_key
    where p.auth_user_id=p_auth_user_id and p.status='active' and sm.school_id=p_school_id and sm.status='active' and smr.status='active')
$$;
alter function private.has_school_permission_for_user(uuid,uuid,text) owner to postgres;
revoke all on function private.has_school_permission_for_user(uuid,uuid,text) from public,anon,authenticated,service_role;

create function public.update_student_profile(p_school_id uuid,p_student_id uuid,p_legal_name text default null,p_date_of_birth date default null,p_gender text default null,p_nationality text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_person_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'students.update');
  select person_id into v_person_id from public.student_records where id=p_student_id and school_id=p_school_id for update;
  if v_person_id is null then raise exception 'student not found in school' using errcode='P0002'; end if;
  if not (
    (private.has_school_permission(p_school_id,'students.read_sensitive') and not exists(
      select 1 from public.school_memberships sm join public.school_membership_roles smr on smr.school_id=sm.school_id and smr.membership_id=sm.id
      join public.persons p on p.id=sm.person_id where sm.school_id=p_school_id and sm.status='active' and smr.status='active'
        and smr.role_key='TEACHER' and p.auth_user_id=(select auth.uid())
    )) or private.require_teacher_student_access(p_school_id,p_student_id)
  ) then
    raise exception 'sensitive student update requires elevated permission or active class assignment' using errcode='42501';
  end if;
  if p_legal_name is not null then
    if length(btrim(p_legal_name))=0 then raise exception 'legal name cannot be blank' using errcode='22023'; end if;
    insert into private.person_private_identity(person_id,legal_name,date_of_birth,nationality) values(v_person_id,btrim(p_legal_name),p_date_of_birth,nullif(btrim(p_nationality),''))
    on conflict(person_id) do update set legal_name=excluded.legal_name,date_of_birth=coalesce(p_date_of_birth,private.person_private_identity.date_of_birth),nationality=coalesce(nullif(btrim(p_nationality),''),private.person_private_identity.nationality),updated_at=now();
  end if;
  update public.student_records set date_of_birth=coalesce(p_date_of_birth,date_of_birth),gender=coalesce(nullif(btrim(p_gender),''),gender),nationality=coalesce(nullif(btrim(p_nationality),''),nationality),updated_at=now() where id=p_student_id and school_id=p_school_id;
  perform private.write_school_audit(p_school_id,'student',p_student_id,'student_profile_updated','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('sensitive',true));
end;
$$;
alter function public.update_student_profile(uuid,uuid,text,date,text,text) owner to postgres;
revoke all on function public.update_student_profile(uuid,uuid,text,date,text,text) from public,anon,service_role;
grant execute on function public.update_student_profile(uuid,uuid,text,date,text,text) to authenticated;

create function public.place_student(p_school_id uuid,p_student_id uuid,p_academic_year_id uuid,p_class_section_id uuid,p_effective_date date default current_date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_enrollment_id uuid; v_old_id uuid; v_new_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'academics.manage');
  if not exists(select 1 from public.student_records where id=p_student_id and school_id=p_school_id and status='active') then raise exception 'active student not found in school' using errcode='P0002'; end if;
  if not exists(select 1 from public.academic_years where id=p_academic_year_id and school_id=p_school_id and status='active') then raise exception 'active academic year required' using errcode='23503'; end if;
  if not exists(select 1 from public.class_sections where id=p_class_section_id and school_id=p_school_id and academic_year_id=p_academic_year_id and status='active') then raise exception 'active class in requested year required' using errcode='23503'; end if;
  insert into public.student_enrollments(school_id,student_id,academic_year_id,status,created_by_membership_id,created_by_person_id)
  values(p_school_id,p_student_id,p_academic_year_id,'enrolled',v_actor.membership_id,v_actor.person_id)
  on conflict(school_id,student_id,academic_year_id) do update set status='enrolled',ended_at=null,updated_at=now() returning id into v_enrollment_id;
  select id into v_old_id from public.student_class_placements where school_id=p_school_id and enrollment_id=v_enrollment_id and status='active' for update;
  if v_old_id is not null then
    update public.student_class_placements set status='transferred',ends_on=p_effective_date where id=v_old_id;
  end if;
  insert into public.student_class_placements(school_id,academic_year_id,enrollment_id,class_section_id,starts_on,assigned_by_membership_id,assigned_by_person_id)
    values(p_school_id,p_academic_year_id,v_enrollment_id,p_class_section_id,p_effective_date,v_actor.membership_id,v_actor.person_id) returning id into v_new_id;
  perform private.write_school_audit(p_school_id,'student_placement',v_new_id,'student_placed','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('student_id',p_student_id,'old_placement_id',v_old_id,'class_section_id',p_class_section_id));
  return v_new_id;
end;
$$;
alter function public.place_student(uuid,uuid,uuid,uuid,date) owner to postgres;
revoke all on function public.place_student(uuid,uuid,uuid,uuid,date) from public,anon,service_role;
grant execute on function public.place_student(uuid,uuid,uuid,uuid,date) to authenticated;

create function public.change_student_status(p_school_id uuid,p_student_id uuid,p_new_status text,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_old_status text; v_membership_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'students.update');
  if p_new_status not in ('withdrawn','graduated','inactive','transferred') or length(btrim(coalesce(p_reason,'')))<3 then raise exception 'valid terminal lifecycle status and reason required' using errcode='22023'; end if;
  select status,school_membership_id into v_old_status,v_membership_id from public.student_records where id=p_student_id and school_id=p_school_id for update;
  if not found then raise exception 'student not found' using errcode='P0002'; end if;
  if v_old_status in ('withdrawn','graduated') and p_new_status='active' then raise exception 'terminal student status requires formal re-admission workflow' using errcode='23514'; end if;
  update public.student_records set status=p_new_status,updated_at=now() where id=p_student_id and school_id=p_school_id;
  if p_new_status in ('withdrawn','graduated','inactive') then
    update public.student_class_placements set status='ended',ends_on=current_date where school_id=p_school_id and enrollment_id in(select id from public.student_enrollments where school_id=p_school_id and student_id=p_student_id and status='enrolled');
    update public.student_enrollments set status=case when p_new_status='graduated' then 'graduated' when p_new_status='transferred' then 'transferred' else 'withdrawn' end,ended_at=now(),updated_at=now() where school_id=p_school_id and student_id=p_student_id and status='enrolled';
    update public.school_memberships set status='revoked',ended_at=now(),updated_at=now() where id=v_membership_id and status in ('active','suspended');
  end if;
  perform private.write_school_audit(p_school_id,'student',p_student_id,'student_status_changed','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('from',v_old_status,'to',p_new_status,'reason',btrim(p_reason)));
end;
$$;
alter function public.change_student_status(uuid,uuid,text,text) owner to postgres;
revoke all on function public.change_student_status(uuid,uuid,text,text) from public,anon,service_role;
grant execute on function public.change_student_status(uuid,uuid,text,text) to authenticated;

create function public.create_student_document(p_school_id uuid,p_student_id uuid,p_kind text,p_path text,p_filename text,p_content_type text,p_byte_size bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'documents.manage');
  if p_path !~ ('^' || p_school_id::text || '/' || p_student_id::text || '/[A-Za-z0-9._/-]+$') or p_path like '%..%' or length(btrim(coalesce(p_kind,'')))=0 or length(btrim(coalesce(p_filename,'')))=0 or p_byte_size<=0 then
    raise exception 'invalid school-scoped document metadata/path' using errcode='22023';
  end if;
  insert into public.student_documents(school_id,student_id,document_kind,storage_object_path,original_filename,content_type,byte_size,uploaded_by_membership_id,uploaded_by_person_id)
    values(p_school_id,p_student_id,btrim(p_kind),p_path,btrim(p_filename),p_content_type,p_byte_size,v_actor.membership_id,v_actor.person_id) returning id into v_id;
  perform private.write_school_audit(p_school_id,'student_document',v_id,'student_document_registered','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('student_id',p_student_id,'kind',p_kind));
  return v_id;
end;
$$;
alter function public.create_student_document(uuid,uuid,text,text,text,text,bigint) owner to postgres;
revoke all on function public.create_student_document(uuid,uuid,text,text,text,text,bigint) from public,anon,service_role;
grant execute on function public.create_student_document(uuid,uuid,text,text,text,text,bigint) to authenticated;

create function public.create_guardian_link_request(p_school_id uuid,p_student_id uuid,p_contact_hash bytea,p_token_hash bytea,p_relationship_type text,p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'guardians.manage');
  if octet_length(p_contact_hash)<>32 or octet_length(p_token_hash)<>32 or p_relationship_type not in ('parent','legal_guardian','caregiver','other') or p_expires_at<=now() or p_expires_at>now()+interval '14 days' then raise exception 'valid hashed contact, token and expiry required' using errcode='22023'; end if;
  insert into public.guardian_link_requests(school_id,student_id,relationship_type,invited_contact_hash,token_hash,expires_at,invited_by_membership_id,invited_by_person_id)
    values(p_school_id,p_student_id,p_relationship_type,p_contact_hash,p_token_hash,p_expires_at,v_actor.membership_id,v_actor.person_id) returning id into v_id;
  insert into public.guardian_link_audit(school_id,request_id,student_id,actor_membership_id,actor_person_id,event_type)
    values(p_school_id,v_id,p_student_id,v_actor.membership_id,v_actor.person_id,'invited');
  perform private.write_school_audit(p_school_id,'guardian_relationship',v_id,'guardian_invited','school',v_actor.person_id,null,null,null,v_actor.membership_id,'{}'::jsonb);
  return v_id;
end;
$$;
alter function public.create_guardian_link_request(uuid,uuid,bytea,bytea,text,timestamptz) owner to postgres;
revoke all on function public.create_guardian_link_request(uuid,uuid,bytea,bytea,text,timestamptz) from public,anon,service_role;
grant execute on function public.create_guardian_link_request(uuid,uuid,bytea,bytea,text,timestamptz) to authenticated;

-- Confirmation binds the verified Auth identity to an already existing person;
-- callers cannot choose arbitrary person ids. Relationship approval and
-- activation are separately authorized staff actions.
create function public.accept_guardian_link_request(p_request_id uuid,p_token_hash bytea)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_person_id uuid; v_req public.guardian_link_requests%rowtype;
begin
  v_uid:=(select auth.uid()); if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  select id into v_person_id from public.persons where auth_user_id=v_uid and status='active';
  if v_person_id is null then raise exception 'verified person identity required' using errcode='42501'; end if;
  select * into v_req from public.guardian_link_requests where id=p_request_id and token_hash=p_token_hash and status='invited' and expires_at>now() for update;
  if not found then raise exception 'request invalid or expired' using errcode='P0002'; end if;
  if not exists(select 1 from private.person_contact_points cp join auth.users u on u.id=v_uid where cp.person_id=v_person_id and cp.verified_at is not null and ((cp.contact_type='email' and lower(cp.normalized_value)=lower(u.email) and u.email_confirmed_at is not null) or (cp.contact_type='phone' and cp.normalized_value=u.phone and u.phone_confirmed_at is not null))) then
    raise exception 'Auth contact ownership must be verified and match the guardian person' using errcode='42501';
  end if;
  update public.guardian_link_requests set guardian_person_id=v_person_id,guardian_auth_user_id=v_uid,identity_verified_at=now(),status='identity_verified',updated_at=now() where id=p_request_id;
  insert into public.guardian_link_audit(school_id,request_id,student_id,actor_membership_id,actor_person_id,event_type)
    values(v_req.school_id,v_req.id,v_req.student_id,v_req.invited_by_membership_id,v_req.invited_by_person_id,'identity_verified');
end;
$$;
alter function public.accept_guardian_link_request(uuid,bytea) owner to postgres;
revoke all on function public.accept_guardian_link_request(uuid,bytea) from public,anon,service_role;
grant execute on function public.accept_guardian_link_request(uuid,bytea) to authenticated;

create function public.approve_guardian_link_request(p_request_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_req public.guardian_link_requests%rowtype; v_rel uuid; v_guardian_membership_id uuid;
begin
  select * into v_req from public.guardian_link_requests where id=p_request_id for update;
  if not found then raise exception 'request not found' using errcode='P0002'; end if;
  select * into v_actor from private.require_school_actor(v_req.school_id,'guardians.manage');
  if v_req.status<>'identity_verified' or v_req.guardian_person_id is null or v_req.guardian_auth_user_id is null or length(btrim(coalesce(p_reason,'')))<3 then raise exception 'identity-verified request and approval reason required' using errcode='23514'; end if;
  if exists(select 1 from public.school_memberships where person_id=v_req.guardian_person_id and status='active') then raise exception 'guardian already has an active school membership; resolve transfer first' using errcode='23505'; end if;
  insert into public.school_memberships(school_id,person_id,status,started_at) values(v_req.school_id,v_req.guardian_person_id,'active',now()) returning id into v_guardian_membership_id;
  insert into public.school_membership_roles(school_id,membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason)
    values(v_req.school_id,v_guardian_membership_id,v_req.guardian_person_id,'PARENT',v_actor.membership_id,v_actor.person_id,'guardian relationship approved by school');
  update public.guardian_link_requests set status='approved',relationship_verified_at=now(),relationship_verified_by_membership_id=v_actor.membership_id,relationship_verified_by_person_id=v_actor.person_id,approved_at=now(),approved_by_membership_id=v_actor.membership_id,approved_by_person_id=v_actor.person_id,updated_at=now() where id=p_request_id;
  insert into public.guardian_relationships(school_id,student_id,guardian_person_id,guardian_auth_user_id,guardian_school_membership_id,relationship_type,status,identity_verified_at,relationship_verified_at,relationship_verified_by_membership_id,relationship_verified_by_person_id,approved_at,approved_by_membership_id,approved_by_person_id,activated_at,created_by_membership_id,created_by_person_id)
  values(v_req.school_id,v_req.student_id,v_req.guardian_person_id,v_req.guardian_auth_user_id,v_guardian_membership_id,v_req.relationship_type,'active',v_req.identity_verified_at,now(),v_actor.membership_id,v_actor.person_id,now(),v_actor.membership_id,v_actor.person_id,now(),v_actor.membership_id,v_actor.person_id) returning id into v_rel;
  update public.guardian_link_requests set guardian_school_membership_id=v_guardian_membership_id,relationship_id=v_rel,status='activated',activated_at=now(),updated_at=now() where id=p_request_id;
  insert into public.guardian_link_audit(school_id,request_id,relationship_id,student_id,actor_membership_id,actor_person_id,event_type,event_data)
    values(v_req.school_id,v_req.id,v_rel,v_req.student_id,v_actor.membership_id,v_actor.person_id,'activated',jsonb_build_object('reason',btrim(p_reason)));
  perform private.write_school_audit(v_req.school_id,'guardian_relationship',v_rel,'guardian_relationship_activated','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('student_id',v_req.student_id));
  return v_rel;
end;
$$;
alter function public.approve_guardian_link_request(uuid,text) owner to postgres;
revoke all on function public.approve_guardian_link_request(uuid,text) from public,anon,service_role;
grant execute on function public.approve_guardian_link_request(uuid,text) to authenticated;

create function public.revoke_guardian_relationship(p_school_id uuid,p_relationship_id uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_student_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'guardians.manage');
  if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'revocation reason required' using errcode='22023'; end if;
  update public.guardian_relationships set status='revoked',revoked_at=now(),revoked_by_membership_id=v_actor.membership_id,revoked_by_person_id=v_actor.person_id,revocation_reason=btrim(p_reason),updated_at=now()
    where id=p_relationship_id and school_id=p_school_id and status='active' returning student_id into v_student_id;
  if v_student_id is null then raise exception 'active guardian relationship not found' using errcode='P0002'; end if;
  insert into public.guardian_link_audit(school_id,relationship_id,student_id,actor_membership_id,actor_person_id,event_type,event_data)
    values(p_school_id,p_relationship_id,v_student_id,v_actor.membership_id,v_actor.person_id,'revoked',jsonb_build_object('reason',btrim(p_reason)));
  perform private.write_school_audit(p_school_id,'guardian_relationship',p_relationship_id,'guardian_relationship_revoked','school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('student_id',v_student_id,'reason',btrim(p_reason)));
end;
$$;
alter function public.revoke_guardian_relationship(uuid,uuid,text) owner to postgres;
revoke all on function public.revoke_guardian_relationship(uuid,uuid,text) from public,anon,service_role;
grant execute on function public.revoke_guardian_relationship(uuid,uuid,text) to authenticated;

create function public.set_guardian_relationship_permission(p_school_id uuid,p_relationship_id uuid,p_permission_key text,p_grant boolean,p_expires_at timestamptz default null,p_reason text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_rel public.guardian_relationships%rowtype; v_id uuid;
begin
  select * into v_actor from private.require_school_actor(p_school_id,'guardians.manage');
  select * into v_rel from public.guardian_relationships where id=p_relationship_id and school_id=p_school_id and status='active' for update;
  if not found then raise exception 'active guardian relationship required' using errcode='P0002'; end if;
  if not exists(select 1 from private.permission_catalog where scope='guardian' and permission_key=p_permission_key) then raise exception 'unknown guardian permission' using errcode='22023'; end if;
  if p_grant then
    if p_expires_at is not null and p_expires_at<=now() then raise exception 'permission expiry must be in the future' using errcode='22023'; end if;
    update public.guardian_relationship_permissions set status='expired',expired_at=now()
      where school_id=p_school_id and guardian_relationship_id=p_relationship_id and permission_key=p_permission_key
        and status='active' and expires_at is not null and expires_at<=now();
    insert into public.guardian_relationship_permissions(school_id,guardian_relationship_id,student_id,guardian_person_id,guardian_auth_user_id,permission_key,status,granted_by_membership_id,granted_by_person_id,expires_at)
      values(p_school_id,p_relationship_id,v_rel.student_id,v_rel.guardian_person_id,v_rel.guardian_auth_user_id,p_permission_key,'active',v_actor.membership_id,v_actor.person_id,p_expires_at) returning id into v_id;
    insert into public.guardian_link_audit(school_id,relationship_id,student_id,actor_membership_id,actor_person_id,event_type,event_data)
      values(p_school_id,p_relationship_id,v_rel.student_id,v_actor.membership_id,v_actor.person_id,'permission_granted',jsonb_build_object('permission',p_permission_key,'expires_at',p_expires_at));
  else
    if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'permission revocation reason required' using errcode='22023'; end if;
    update public.guardian_relationship_permissions set status='revoked',revoked_at=now(),revoked_by_membership_id=v_actor.membership_id,revoked_by_person_id=v_actor.person_id
      where school_id=p_school_id and guardian_relationship_id=p_relationship_id and permission_key=p_permission_key and status='active' returning id into v_id;
    if v_id is null then raise exception 'active permission grant not found' using errcode='P0002'; end if;
    insert into public.guardian_link_audit(school_id,relationship_id,student_id,actor_membership_id,actor_person_id,event_type,event_data)
      values(p_school_id,p_relationship_id,v_rel.student_id,v_actor.membership_id,v_actor.person_id,'permission_revoked',jsonb_build_object('permission',p_permission_key,'reason',btrim(p_reason)));
  end if;
  perform private.write_school_audit(p_school_id,'guardian_relationship',p_relationship_id,case when p_grant then 'guardian_permission_granted' else 'guardian_permission_revoked' end,'school',v_actor.person_id,null,null,null,v_actor.membership_id,jsonb_build_object('permission',p_permission_key));
  return v_id;
end;
$$;
alter function public.set_guardian_relationship_permission(uuid,uuid,text,boolean,timestamptz,text) owner to postgres;
revoke all on function public.set_guardian_relationship_permission(uuid,uuid,text,boolean,timestamptz,text) from public,anon,service_role;
grant execute on function public.set_guardian_relationship_permission(uuid,uuid,text,boolean,timestamptz,text) to authenticated;

-- Guardian data access requires active verified relationship plus per-category
-- permission grant; stale/inactive links immediately fail this policy.
drop policy if exists guardian_relationships_select_guardian_self on public.guardian_relationships;
create policy guardian_relationships_select_guardian_self on public.guardian_relationships for select to authenticated
  using (guardian_auth_user_id=(select auth.uid()) and status in ('pending','active','suspended')
    and exists(select 1 from public.persons p where p.id=guardian_relationships.guardian_person_id and p.auth_user_id=(select auth.uid()) and p.status='active')
    and (status<>'active' or exists(select 1 from public.school_memberships sm where sm.school_id=guardian_relationships.school_id and sm.id=guardian_relationships.guardian_school_membership_id and sm.person_id=guardian_relationships.guardian_person_id and sm.status='active')));

drop policy if exists guardian_relationship_permissions_select_guardian_self on public.guardian_relationship_permissions;
create policy guardian_relationship_permissions_select_guardian_self on public.guardian_relationship_permissions for select to authenticated
  using (guardian_auth_user_id=(select auth.uid()) and status='active' and (expires_at is null or expires_at>now())
    and exists(select 1 from public.guardian_relationships gr join public.school_memberships gm on gm.school_id=gr.school_id and gm.id=gr.guardian_school_membership_id and gm.person_id=gr.guardian_person_id
      join public.persons gp on gp.id=gr.guardian_person_id where gr.school_id=guardian_relationship_permissions.school_id and gr.id=guardian_relationship_permissions.guardian_relationship_id
        and gr.student_id=guardian_relationship_permissions.student_id and gr.guardian_person_id=guardian_relationship_permissions.guardian_person_id
        and gr.guardian_auth_user_id=(select auth.uid()) and gp.auth_user_id=(select auth.uid()) and gp.status='active' and gm.status='active'
        and gr.status='active' and gr.identity_verified_at is not null and gr.relationship_verified_at is not null and gr.approved_at is not null
        and (gr.valid_until is null or gr.valid_until>now())));

create function public.get_guardian_student_profile(p_relationship_id uuid)
returns table(student_id uuid,school_id uuid,admission_number text,legal_name text,status text,admission_date date,class_section_id uuid)
language sql stable security definer set search_path = '' as $$
  select sr.id,sr.school_id,sr.admission_number,pi.legal_name,sr.status,sr.admission_date,cp.class_section_id
  from public.guardian_relationships gr join public.persons gp on gp.id=gr.guardian_person_id and gp.auth_user_id=(select auth.uid()) and gp.status='active'
  join public.school_memberships gm on gm.school_id=gr.school_id and gm.id=gr.guardian_school_membership_id and gm.person_id=gr.guardian_person_id and gm.status='active'
  join public.guardian_relationship_permissions gperm on gperm.school_id=gr.school_id and gperm.guardian_relationship_id=gr.id and gperm.student_id=gr.student_id and gperm.guardian_person_id=gr.guardian_person_id and gperm.guardian_auth_user_id=(select auth.uid()) and gperm.permission_key='students.read' and gperm.status='active' and (gperm.expires_at is null or gperm.expires_at>now())
  join public.student_records sr on sr.school_id=gr.school_id and sr.id=gr.student_id
  join private.person_private_identity pi on pi.person_id=sr.person_id
  left join public.student_enrollments se on se.school_id=sr.school_id and se.student_id=sr.id and se.status='enrolled'
  left join public.student_class_placements cp on cp.school_id=se.school_id and cp.enrollment_id=se.id and cp.status='active'
  where gr.id=p_relationship_id and gr.guardian_auth_user_id=(select auth.uid()) and gr.status='active'
    and gr.identity_verified_at is not null and gr.relationship_verified_at is not null and gr.approved_at is not null
    and (gr.valid_until is null or gr.valid_until>now());
$$;
alter function public.get_guardian_student_profile(uuid) owner to postgres;
revoke all on function public.get_guardian_student_profile(uuid) from public,anon,service_role;
grant execute on function public.get_guardian_student_profile(uuid) to authenticated;

create function public.list_student_roster(p_school_id uuid,p_class_section_id uuid default null)
returns table(student_id uuid,admission_number text,legal_name text,status text,admission_date date,class_section_id uuid)
language sql stable security definer set search_path = '' as $$
  select sr.id,sr.admission_number,pi.legal_name,sr.status,sr.admission_date,cp.class_section_id
  from public.student_records sr join private.person_private_identity pi on pi.person_id=sr.person_id
  left join public.student_enrollments se on se.school_id=sr.school_id and se.student_id=sr.id and se.status='enrolled'
  left join public.student_class_placements cp on cp.school_id=se.school_id and cp.enrollment_id=se.id and cp.status='active'
  where sr.school_id=p_school_id and sr.status not in ('archived')
    and (p_class_section_id is null or cp.class_section_id=p_class_section_id)
    and ((private.has_school_permission(p_school_id,'students.read_sensitive') and not exists(
      select 1 from public.school_memberships sm join public.school_membership_roles smr on smr.school_id=sm.school_id and smr.membership_id=sm.id
      join public.persons p on p.id=sm.person_id where sm.school_id=p_school_id and sm.status='active' and smr.status='active'
        and smr.role_key='TEACHER' and p.auth_user_id=(select auth.uid())
    )) or (private.has_school_permission(p_school_id,'students.read') and private.require_teacher_student_access(p_school_id,sr.id)
        and (p_class_section_id is null or exists(select 1 from public.teacher_assignments ta join public.staff_records st on st.id=ta.staff_record_id and st.school_id=ta.school_id join public.persons t on t.id=st.person_id where ta.school_id=p_school_id and ta.class_section_id=p_class_section_id and ta.status='active' and t.auth_user_id=(select auth.uid())))));
$$;
alter function public.list_student_roster(uuid,uuid) owner to postgres;
revoke all on function public.list_student_roster(uuid,uuid) from public,anon,service_role;
grant execute on function public.list_student_roster(uuid,uuid) to authenticated;

create policy student_enrollments_select_authorized_school on public.student_enrollments for select to authenticated
  using (private.has_school_permission(school_id,'students.read') and (private.has_school_permission(school_id,'academics.manage') or exists(select 1 from public.student_records sr where sr.id=student_enrollments.student_id and sr.school_id=student_enrollments.school_id and sr.auth_user_id=(select auth.uid()))));

create policy student_class_placements_select_authorized_school on public.student_class_placements for select to authenticated
  using (private.has_school_permission(school_id,'students.read') and (private.has_school_permission(school_id,'academics.manage') or exists(select 1 from public.student_enrollments e join public.student_records sr on sr.id=e.student_id and sr.school_id=e.school_id where e.id=student_class_placements.enrollment_id and sr.auth_user_id=(select auth.uid()))));

create policy student_documents_select_authorized on public.student_documents for select to authenticated
  using (exists(select 1 from public.student_records sr where sr.id=student_documents.student_id and sr.school_id=student_documents.school_id and sr.auth_user_id=(select auth.uid()))
    or (private.has_school_permission(school_id,'students.documents.read') and private.require_teacher_student_access(school_id,student_id))
    or private.has_school_permission(school_id,'students.documents.manage'));

grant select on public.student_enrollments,public.student_class_placements to authenticated;
-- No direct writes on lifecycle tables. Workflow functions are the only path.
