-- Plan 2C: run ONLY after the passport write proxy is deployed and verified.
-- The app must route writes through /api/passport-write before applying this.
--
-- Verification checklist:
-- 1. Deploy latest Vercel build with /api/passport-write
-- 2. Confirm attendee registration, scans, raffle entry, and admin edits work
-- 3. Confirm anonymous curl POST/PATCH to passport_state returns 403
-- 4. Rotate the Supabase anon key and redeploy

drop policy if exists "Allow public passport state inserts" on public.passport_state;
drop policy if exists "Allow public passport state updates" on public.passport_state;

-- Reads stay open for now (Plan 3 will tighten read-side PII exposure).
-- Writes are service-role only via the Vercel write proxy.
