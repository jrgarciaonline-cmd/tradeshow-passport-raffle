-- Plan 3D: Public read views without PII or scan secrets.
-- Attendee apps should read these instead of passport_state once client migration is complete.

create or replace view public.public_event_booths
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
  map_x,
  map_y
from public.booths;

create or replace view public.public_event_settings
with (security_invoker = true)
as
select
  event_id,
  required_scan_count,
  instructions,
  map_src,
  home_image_src,
  raffle_complete_image_src,
  booth_categories,
  terms_text
from public.event_settings;

grant select on public.public_event_booths to anon, authenticated;
grant select on public.public_event_settings to anon, authenticated;

-- Tighten passport_state reads after client migration:
-- Run supabase-plan3-read-lockdown.sql (separate file — do NOT run until VITE_NORMALIZED_READS is live).
