-- Plan 3D: Row-level security for normalized tables.
-- Run after supabase-plan3-schema.sql.
-- Service role (Edge Functions / Vercel API) bypasses RLS.

alter table public.events enable row level security;
alter table public.booths enable row level security;
alter table public.event_settings enable row level security;
alter table public.attendees enable row level security;
alter table public.scans enable row level security;
alter table public.attendee_locations enable row level security;
alter table public.entries enable row level security;
alter table public.winners enable row level security;
alter table public.admin_audit_log enable row level security;

-- events: public read of non-archived; admin full CRUD
drop policy if exists "Public read active events" on public.events;
create policy "Public read active events"
on public.events for select to anon, authenticated
using (status in ('active', 'hidden'));

drop policy if exists "Admins manage events" on public.events;
create policy "Admins manage events"
on public.events for all to authenticated
using (public.is_authorized_admin(auth.jwt() ->> 'email'))
with check (public.is_authorized_admin(auth.jwt() ->> 'email'));

-- booths + settings: public read (no qr_code in public view — see supabase-plan3-views.sql)
drop policy if exists "Public read booths" on public.booths;
create policy "Public read booths"
on public.booths for select to anon, authenticated
using (true);

drop policy if exists "Admins manage booths" on public.booths;
create policy "Admins manage booths"
on public.booths for all to authenticated
using (public.is_authorized_admin(auth.jwt() ->> 'email'))
with check (public.is_authorized_admin(auth.jwt() ->> 'email'));

drop policy if exists "Public read event settings" on public.event_settings;
create policy "Public read event settings"
on public.event_settings for select to anon, authenticated
using (true);

drop policy if exists "Admins manage event settings" on public.event_settings;
create policy "Admins manage event settings"
on public.event_settings for all to authenticated
using (public.is_authorized_admin(auth.jwt() ->> 'email'))
with check (public.is_authorized_admin(auth.jwt() ->> 'email'));

-- attendees: own row via auth_user_id; admins read all in their events
drop policy if exists "Attendees read own row" on public.attendees;
create policy "Attendees read own row"
on public.attendees for select to authenticated
using (auth_user_id = auth.uid());

drop policy if exists "Attendees update own row" on public.attendees;
create policy "Attendees update own row"
on public.attendees for update to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists "Admins read attendees" on public.attendees;
create policy "Admins read attendees"
on public.attendees for select to authenticated
using (public.is_authorized_admin(auth.jwt() ->> 'email'));

drop policy if exists "Admins manage attendees" on public.attendees;
create policy "Admins manage attendees"
on public.attendees for all to authenticated
using (public.is_authorized_admin(auth.jwt() ->> 'email'))
with check (public.is_authorized_admin(auth.jwt() ->> 'email'));

-- scans: attendee insert/read own; admin read all
drop policy if exists "Attendees read own scans" on public.scans;
create policy "Attendees read own scans"
on public.scans for select to authenticated
using (
  attendee_id in (
    select id from public.attendees where auth_user_id = auth.uid()
  )
);

drop policy if exists "Attendees insert own scans" on public.scans;
create policy "Attendees insert own scans"
on public.scans for insert to authenticated
with check (
  attendee_id in (
    select id from public.attendees where auth_user_id = auth.uid()
  )
);

drop policy if exists "Admins read scans" on public.scans;
create policy "Admins read scans"
on public.scans for select to authenticated
using (public.is_authorized_admin(auth.jwt() ->> 'email'));

-- attendee_locations: same pattern as scans
drop policy if exists "Attendees manage own location" on public.attendee_locations;
create policy "Attendees manage own location"
on public.attendee_locations for all to authenticated
using (
  attendee_id in (
    select id from public.attendees where auth_user_id = auth.uid()
  )
)
with check (
  attendee_id in (
    select id from public.attendees where auth_user_id = auth.uid()
  )
);

drop policy if exists "Admins read attendee locations" on public.attendee_locations;
create policy "Admins read attendee locations"
on public.attendee_locations for select to authenticated
using (public.is_authorized_admin(auth.jwt() ->> 'email'));

-- entries: attendee insert/read own; admin full
drop policy if exists "Attendees read own entry" on public.entries;
create policy "Attendees read own entry"
on public.entries for select to authenticated
using (
  attendee_id in (
    select id from public.attendees where auth_user_id = auth.uid()
  )
);

drop policy if exists "Attendees insert own entry" on public.entries;
create policy "Attendees insert own entry"
on public.entries for insert to authenticated
with check (
  attendee_id in (
    select id from public.attendees where auth_user_id = auth.uid()
  )
);

drop policy if exists "Admins manage entries" on public.entries;
create policy "Admins manage entries"
on public.entries for all to authenticated
using (public.is_authorized_admin(auth.jwt() ->> 'email'))
with check (public.is_authorized_admin(auth.jwt() ->> 'email'));

-- winners: public none; admin full
drop policy if exists "Admins manage winners" on public.winners;
create policy "Admins manage winners"
on public.winners for all to authenticated
using (public.is_authorized_admin(auth.jwt() ->> 'email'))
with check (public.is_authorized_admin(auth.jwt() ->> 'email'));

-- audit log: admin read only; inserts via service role
drop policy if exists "Admins read audit log" on public.admin_audit_log;
create policy "Admins read audit log"
on public.admin_audit_log for select to authenticated
using (public.is_authorized_admin(auth.jwt() ->> 'email'));
