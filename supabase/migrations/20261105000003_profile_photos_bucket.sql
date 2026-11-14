-- Create public storage bucket for student/staff profile photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Allow anyone to read (bucket is public)
create policy "profile_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

-- Only service role may upload / replace / delete
create policy "profile_photos_service_write"
  on storage.objects for insert
  with check (auth.role() = 'service_role' and bucket_id = 'profile-photos');

create policy "profile_photos_service_update"
  on storage.objects for update
  using (auth.role() = 'service_role' and bucket_id = 'profile-photos');

create policy "profile_photos_service_delete"
  on storage.objects for delete
  using (auth.role() = 'service_role' and bucket_id = 'profile-photos');
