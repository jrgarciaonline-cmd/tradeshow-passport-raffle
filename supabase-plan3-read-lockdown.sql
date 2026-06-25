-- Plan 3 Phase C: Lock down passport_state reads (run ONLY after VITE_NORMALIZED_READS=true is live).
-- Prerequisite checklist:
-- 1. supabase-plan3-schema.sql + rls + views applied
-- 2. Backfill complete; NORMALIZED_DUAL_WRITE=true
-- 3. VITE_NORMALIZED_READS=true deployed and verified (map, booths, admin dashboard)
-- 4. Attendee magic link auth tested if enabled

drop policy if exists "Allow public passport state reads" on public.passport_state;

create policy "Admins read passport state"
on public.passport_state
for select
to authenticated
using (public.is_authorized_admin(auth.jwt() ->> 'email'));

-- Service role (Vercel API) continues to read/write passport_state during migration.
