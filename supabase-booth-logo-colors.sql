-- Add booth logo styling columns for normalized reads / dual-write.
-- Run in Supabase SQL editor, then re-backfill or re-save booths:
--   node scripts/backfill-normalized-schema.mjs

alter table public.booths
  add column if not exists logo_color text not null default '#007b70';

alter table public.booths
  add column if not exists logo_background_color text not null default '#ffffff';

-- CREATE OR REPLACE cannot insert columns before existing view columns (Postgres
-- matches by position). Drop and recreate instead.
drop view if exists public.public_event_booths;

create view public.public_event_booths
with (security_invoker = true)
as
select
  event_id,
  id,
  name,
  category,
  location,
  description,
  website_url,
  logo_url,
  color,
  logo_color,
  logo_background_color,
  map_x,
  map_y
from public.booths;

grant select on public.public_event_booths to anon, authenticated;
