# Plan 3 Setup Guide

Production-grade security: normalized schema, attendee auth, signed scans, and PII-safe reads.

**Prerequisite:** Plan 2 complete — write proxy deployed, `supabase-passport-state-rls-lockdown.sql` applied, storage locked down.

Plan 3 is rolled out in four phases. Each phase has code (already in repo) and manual steps (you run in Supabase/Vercel).

---

## Phase A — Schema + dual-write (week 1)

### What the code does

- `supabase-plan3-schema.sql` — normalized tables alongside `passport_state`
- `api/_lib/normalizedWrite.js` — dual-writes when `NORMALIZED_DUAL_WRITE=true`
- `scripts/backfill-normalized-schema.mjs` — one-time migration from JSON blobs

### Your steps

1. **Supabase SQL Editor** — run in order:
   - `supabase-plan3-schema.sql`
   - `supabase-plan3-rls.sql`
   - `supabase-plan3-views.sql`

2. **Backfill existing data** (from project root, with `.env` containing service role key):
   ```bash
   node scripts/backfill-normalized-schema.mjs
   ```
   Optional single event: `node scripts/backfill-normalized-schema.mjs --event-id=your-event-id`

3. **Verify row counts** in Supabase Table Editor:
   - `events` matches your event index
   - `booths`, `attendees`, `scans`, `entries` match what you expect per event

4. **Deploy** latest code to Vercel (if not already).

5. **Enable dual-write** in Vercel environment variables:
   ```text
   NORMALIZED_DUAL_WRITE=true
   ```
   Redeploy. New writes will update both `passport_state` and normalized tables.

6. **Monitor** Vercel function logs for `Normalized dual-write failed` warnings for 24–48 hours.

---

## Phase B — Scan signing + tighten reads (week 2)

### What the code does

- `api/_lib/scanToken.js` — HMAC-signed booth tokens (`PASSPORT-SCAN:v1:…`)
- `api/record-scan.js` — dedicated scan endpoint with idempotency
- `api/sign-scan-token.js` — admin-only QR signing for printables
- `BoothQrGenerator` — uses signed tokens when `VITE_SIGNED_QR_CODES=true`

### Your steps

1. **Generate a signing secret** (keep server-side only):
   ```bash
   openssl rand -base64 32
   ```

2. **Vercel env vars:**
   ```text
   SCAN_SIGNING_SECRET=<your-secret>
   VITE_SIGNED_QR_CODES=true
   ```
   Redeploy.

3. **Re-print booth QR codes** in admin → Booths → QR Code Generator. Old plain-text codes still work until step 5.

4. **Smoke test:**
   - Admin generates signed QR for a test booth
   - Attendee scans → stamp appears
   - Check `scans` table for a new row (with dual-write enabled)

5. **Enforce signed scans** (only after all booths have new QRs at the venue):
   ```text
   SCAN_SIGNING_REQUIRED=true
   ```
   Redeploy. Unsigned/legacy codes will be rejected server-side.

6. **Tighten passport_state reads** (optional, after client reads from views — Phase C):
   - Uncomment the policy block at the bottom of `supabase-plan3-views.sql`
   - Run in SQL Editor
   - Confirm attendee map still loads from `public_event_booths` view

---

## Phase C — Attendee auth + client migration (week 3)

### What the code does

- `src/services/attendeeAuth.js` — magic link scaffolding (feature-flagged)
- RLS on `attendees` / `scans` / `entries` scoped to `auth_user_id`

### Your steps

1. **Supabase Auth email** — configure SMTP (or use Supabase built-in for testing):
   - Authentication → Email Templates
   - Authentication → URL Configuration → add your app URL to redirect allow list

2. **Enable magic link** (when ready to test):
   ```text
   VITE_ATTENDEE_MAGIC_LINK=true
   ```

3. **Wire sign-in UI** — replace email+phone match with magic link flow in the attendee auth screen (UI hook-up is the remaining client work for this phase).

4. **Link attendees to auth users** — on registration, set `attendees.auth_user_id` to `auth.uid()`. This requires a small API addition or Supabase trigger when you enable attendee auth.

5. **Switch reads** — update `passportRepository.loadShared()` to read from `public_event_booths` + `public_event_settings` views instead of full `passport_state` (reduces PII exposure).

6. **Deprecate JSON writes** — once all clients use normalized paths, stop writing `passport_state` except as archive.

---

## Phase D — Compliance & ops (week 4)

### What the code does

- `api/gdpr-request.js` — admin export/delete for attendee PII
- `api/_lib/auditLog.js` — structured logs + optional DB persistence
- `archive_stale_events()` / `purge_attendee_pii()` SQL functions

### Your steps

1. **Enable audit log persistence:**
   ```text
   AUDIT_LOG_TO_DB=true
   ```

2. **Privacy policy** — document stored fields: name, email, phone, role, scan timestamps, raffle entry.

3. **Retention schedule** — in Supabase, create a weekly cron (pg_cron or external):
   ```sql
   select public.archive_stale_events(90);
   select public.purge_attendee_pii(30);
   ```
   Adjust day counts for your compliance needs.

4. **GDPR endpoints** — call from admin tooling:
   ```bash
   # Export
   curl -X POST https://your-app.vercel.app/api/gdpr-request \
     -H "Authorization: Bearer <admin-jwt>" \
     -H "Content-Type: application/json" \
     -d '{"action":"export","eventId":"...","email":"attendee@example.com"}'

   # Delete
   curl -X POST ... -d '{"action":"delete","eventId":"...","email":"attendee@example.com"}'
   ```

5. **CI secret scanning** — add [gitleaks](https://github.com/gitleaks/gitleaks) or GitHub secret scanning to your repo.

6. **Load test** — simulate 200+ concurrent scans at required scan count before your next public event.

---

## Environment variable reference

| Variable | Where | Phase | Purpose |
|----------|-------|-------|---------|
| `NORMALIZED_DUAL_WRITE` | Vercel | A | Mirror writes to normalized tables |
| `SCAN_SIGNING_SECRET` | Vercel | B | HMAC secret for QR codes |
| `SCAN_SIGNING_REQUIRED` | Vercel | B | Reject unsigned scans |
| `VITE_SIGNED_QR_CODES` | Client | B | Admin generates signed QRs |
| `VITE_ATTENDEE_MAGIC_LINK` | Client | C | Attendee magic link auth |
| `AUDIT_LOG_TO_DB` | Vercel | D | Persist audit rows |

See `.env.example` for the full list including Plan 1–2 vars.

---

## Rollback

| Change | Rollback |
|--------|----------|
| Dual-write | Set `NORMALIZED_DUAL_WRITE=false`, redeploy |
| Signed scans | Set `SCAN_SIGNING_REQUIRED=false` and `VITE_SIGNED_QR_CODES=false` |
| Tightened reads | Re-run open SELECT policy from `supabase-setup.sql` |
| Normalized tables | Tables are additive; `passport_state` remains source of truth until Phase C completes |

---

## What is NOT done yet (expected)

These require Phase C client migration or operational setup:

- Attendee sign-in UI wired to magic links
- Client reads fully migrated off `passport_state`
- `passport_state` read lockdown (SQL is drafted, commented out)
- Scheduled retention cron job in Supabase
- Full load testing at event scale

The JSON blob remains the live source of truth until you complete Phase C.
