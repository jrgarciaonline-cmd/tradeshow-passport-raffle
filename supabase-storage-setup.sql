-- Run in Supabase SQL Editor after supabase-setup.sql
-- Creates a public bucket for event maps, home images, raffle images, and booth logos.
-- Booth logos are stored under: {eventId}/booth-logos/{boothId}-{timestamp}.{ext}
--
-- Plan 2B: public read; only authorized admins may upload or overwrite files.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-assets',
  'event-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read event assets" on storage.objects;
create policy "Public read event assets"
on storage.objects
for select
to public
using (bucket_id = 'event-assets');

drop policy if exists "Public upload event assets" on storage.objects;
drop policy if exists "Admin upload event assets" on storage.objects;
create policy "Admin upload event assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-assets'
  and public.is_authorized_admin(auth.jwt() ->> 'email')
);

drop policy if exists "Public update event assets" on storage.objects;
drop policy if exists "Admin update event assets" on storage.objects;
create policy "Admin update event assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'event-assets'
  and public.is_authorized_admin(auth.jwt() ->> 'email')
)
with check (
  bucket_id = 'event-assets'
  and public.is_authorized_admin(auth.jwt() ->> 'email')
);
