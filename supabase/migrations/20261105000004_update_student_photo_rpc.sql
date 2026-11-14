-- RPC called by the Next.js upload-photo API route (service_role) to persist
-- a profile photo URL after the file is uploaded to Supabase Storage.
-- Runs as postgres (security definer) to bypass FORCE ROW LEVEL SECURITY on
-- student_records, which blocks direct DML from the service_role client.
create or replace function public.update_student_photo(
  p_school_id  uuid,
  p_student_id uuid,
  p_photo_url  text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(btrim(coalesce(p_photo_url, ''))) = 0 then
    raise exception 'photo url is required' using errcode = '22023';
  end if;

  update public.student_records
     set profile_photo_path = p_photo_url,
         updated_at          = now()
   where id        = p_student_id
     and school_id = p_school_id;

  if not found then
    raise exception 'student not found' using errcode = 'P0002';
  end if;
end;
$$;

alter function public.update_student_photo(uuid, uuid, text) owner to postgres;
revoke all on function public.update_student_photo(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.update_student_photo(uuid, uuid, text) to service_role;
