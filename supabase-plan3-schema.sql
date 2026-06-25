-- Plan 3A: Normalized schema (run alongside existing passport_state during migration).
-- Prerequisite: Plan 2C write proxy deployed and passport_state write RLS locked down.
--
-- Rollout order:
-- 1. Run this file
-- 2. Run supabase-plan3-rls.sql
-- 3. Run supabase-plan3-views.sql
-- 4. Backfill: node scripts/backfill-normalized-schema.mjs
-- 5. Enable NORMALIZED_DUAL_WRITE=true on Vercel
-- See PLAN3_SETUP.md for full checklist.

create table if not exists public.events (
  id text primary key,
  name text not null,
  status text not null default 'active' check (status in ('active', 'hidden', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booths (
  event_id text not null references public.events(id) on delete cascade,
  id text not null,
  name text not null default '',
  category text not null default '',
  location text not null default '',
  description text not null default '',
  website_url text not null default '',
  logo_url text not null default '',
  qr_code text not null default '',
  color text not null default '#6b7280',
  map_x numeric not null default 50,
  map_y numeric not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, id)
);

create table if not exists public.event_settings (
  event_id text primary key references public.events(id) on delete cascade,
  required_scan_count int not null default 1,
  instructions jsonb not null default '[]'::jsonb,
  map_src text not null default '',
  home_image_src text not null default '',
  raffle_complete_image_src text not null default '',
  booth_categories jsonb not null default '[]'::jsonb,
  terms_text text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.attendees (
  id uuid primary key,
  event_id text not null references public.events(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  phone text not null,
  role text not null,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, email)
);

create index if not exists attendees_event_id_idx on public.attendees(event_id);
create index if not exists attendees_auth_user_id_idx on public.attendees(auth_user_id);

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  booth_id text not null,
  scanned_at timestamptz not null default now(),
  idempotency_key text unique,
  unique (attendee_id, booth_id)
);

create index if not exists scans_event_id_idx on public.scans(event_id);
create index if not exists scans_attendee_id_idx on public.scans(attendee_id);

create table if not exists public.attendee_locations (
  attendee_id uuid primary key references public.attendees(id) on delete cascade,
  booth_id text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key,
  event_id text not null references public.events(id) on delete cascade,
  attendee_id uuid references public.attendees(id) on delete set null,
  name text not null,
  email text not null,
  phone text not null,
  role text not null,
  chances int not null default 1 check (chances between 1 and 99),
  is_manual boolean not null default false,
  submitted_at timestamptz not null default now(),
  unique (event_id, email)
);

create index if not exists entries_event_id_idx on public.entries(event_id);

create table if not exists public.winners (
  id uuid primary key,
  event_id text not null references public.events(id) on delete cascade,
  entry_id uuid references public.entries(id) on delete set null,
  attendee_id text not null default '',
  name text not null,
  email text not null,
  phone text not null,
  role text not null,
  chances int not null default 1,
  picked_at timestamptz not null default now()
);

create index if not exists winners_event_id_idx on public.winners(event_id);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  event_id text,
  admin_email_hash text not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_event_id_idx on public.admin_audit_log(event_id);
create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log(created_at desc);

-- Retention helper: archive events older than N days (run via scheduled job).
create or replace function public.archive_stale_events(retention_days int default 90)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int;
begin
  update public.events
  set status = 'archived',
      updated_at = now()
  where status = 'active'
    and created_at < now() - make_interval(days => retention_days);
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

-- GDPR helper: purge attendee PII for archived events past retention window.
create or replace function public.purge_attendee_pii(retention_days int default 30)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  purged_count int;
begin
  with stale_events as (
    select id
    from public.events
    where status = 'archived'
      and updated_at < now() - make_interval(days => retention_days)
  ),
  removed as (
    delete from public.attendees
    where event_id in (select id from stale_events)
    returning id
  )
  select count(*) into purged_count from removed;
  return purged_count;
end;
$$;
