# Data & Security Remediation Plans

Three plans ordered by effort. Plan 2 depends on some items from Plan 1; Plan 3 is the long-term architecture.

---

## Plan 1 — Quick wins: booth logos + `.gitignore`

**Goal:** Reduce JSON payload size and sync risk; stop accidental secret commits.  
**Effort:** ~0.5–1 day  
**Risk:** Low — mirrors the existing map/home image upload path.

### 1A. Upload booth logos to Supabase Storage

**Today:** Booth logos are base64 `data:` URLs stored inline in `passport_state.data.booths[]`. Settings images already use `uploadEventAsset()`.

**Target:** Store logos at URLs like `{eventId}/booth-logos/{boothId}-{timestamp}.jpg`, same as `mapSrc` / `homeImageSrc`.

| Step | Work |
|------|------|
| 1 | Extend `uploadEventAsset()` in `src/services/assetStorage.js` to accept optional `accessToken` (admin JWT when available). |
| 2 | Add `uploadBoothLogo({ eventId, boothId, dataUrl, accessToken })` — path `{eventId}/booth-logos/{boothId}-…`. |
| 3 | Update `AdminPanel.jsx` and `AdminDashboard.jsx`: on logo file pick, compress via `readOptimizedImageFile()` (same as settings), upload, set draft `logoDataUrl` to the public URL. |
| 4 | Update `saveBooth()` in `usePassportStore.js`: if `logoDataUrl` is still a `data:` URL at save time, upload before patching (covers edge cases). |
| 5 | Display: no change — components already use `booth.logoDataUrl` as `src`. |
| 6 | Merge logic: `pickSyncedAssetUrl()` in `passportRepository.js` already handles remote URLs; confirm booth logos behave like map assets. |

**Migration for existing events:**

- **Lazy:** On admin edit/save of a booth with a `data:` logo, upload and replace.
- **Optional script:** One-off admin utility or SQL + script to walk `passport_state` rows and upload embedded logos (only if many events already have base64 logos).

**Acceptance criteria:**

- New booth saves store HTTPS URLs, not base64.
- `passport_state` row size drops materially for multi-booth events.
- Logos still load on attendee map/scanner after sync.

### 1B. Tighten `.gitignore`

**Today:** `.gitignore` has `*.local` but not `.env`. Git status shows an untracked `.env`.

| Add to `.gitignore` | Why |
|---------------------|-----|
| `.env` | Local secrets |
| `.env.*` | `.env.production`, etc. |
| `!.env.example` | Keep a safe template (restore if deleted) |
| `.vercel` | Vercel link metadata |

**Follow-up (manual, ~15 min):**

1. Confirm `.env` was never committed: `git log --all -- .env`
2. If it was, rotate Supabase keys and any Vercel secrets.
3. Restore `.env.example` with placeholder vars only (no real values).
4. Document required vars in `README.md` or `ADMIN_LOGIN_SETUP.md`.

**Acceptance criteria:**

- `git status` no longer suggests committing `.env`.
- `.env.example` documents all `VITE_*` and server vars without secrets.

---

## Plan 2 — Low-effort, high-impact security

**Goal:** Close the easiest holes without a full schema rewrite.  
**Effort:** ~2–4 days  
**Prerequisite:** Plan 1B (`.gitignore`) first.

These items give the most risk reduction per hour. **Do not lock down `passport_state` writes until Plan 2C is in place**, or attendee scans and registration will break.

### 2A. Immediate hygiene (same day)

| Item | Action | Impact |
|------|--------|--------|
| Secret leak prevention | Plan 1B + git history audit | Prevents service role / anon key in repo |
| Key rotation | Rotate Supabase anon key after policy changes; confirm service role never in client bundle | Limits exposure from old builds |
| Security headers | Add to `vercel.json`: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, basic `Content-Security-Policy` | Reduces XSS / clickjacking surface |
| Admin token handling | Short term: don’t persist `refreshToken` in `localStorage` if session can be re-established; or document XSS as accepted risk until Plan 3 | Limits admin session theft window |

### 2B. Lock down Storage (half day – 1 day)

**Problem:** Anyone can upload/overwrite files in `event-assets`.

**Fix:**

1. Update `supabase-storage-setup.sql`:
   - Keep public `SELECT` on `event-assets`.
   - Replace public `INSERT`/`UPDATE` with authenticated + admin check, e.g. `public.is_authorized_admin(auth.jwt() ->> 'email')`.

2. Update `uploadEventAsset()` to accept and send admin `accessToken` when the caller is admin.

3. Thread token from admin UI:
   - `AdminPanel` / `AdminDashboard` → `getActiveAdminSession()` → pass token into upload calls.

4. Attendee-facing reads stay public URLs — no auth change for map/logo display.

**Acceptance criteria:**

- Anonymous `curl` upload to `event-assets` fails.
- Logged-in admin upload succeeds in web and mobile admin flows.

### 2C. Thin write proxy for shared state (1–2 days)

**Problem:** Open anon write on `passport_state` is the dominant risk; fixing it needs *some* server path before RLS can tighten.

**Minimal approach:** Supabase Edge Functions (or extend existing Vercel API routes) as a write gateway.

| Operation | Who | Validation |
|-----------|-----|------------|
| `register_attendee` | Public | Dedupe email; rate limit; no admin fields |
| `record_scan` | Public (or attendee token later) | Valid booth + QR; append to `attendeeProgress` only |
| `submit_entry` | Public | Attendee exists; scan count met; not already entered |
| `admin_patch` | Admin JWT | `is_authorized_admin`; allow booths/settings/entries/winners |

**Client changes:**

- `saveSharedPatch()` routes through the proxy instead of direct PostgREST when configured.
- Keep direct **read** via anon SELECT temporarily (or redact in Plan 3).

**RLS change (after proxy deployed):**

```sql
-- Drop open insert/update policies on passport_state
-- Keep SELECT for now (or split reads in Plan 3)
-- Deny anon INSERT/UPDATE entirely
```

**Acceptance criteria:**

- Direct anon POST/PATCH to `passport_state` returns 403.
- App scans, registration, raffle entry, and admin edits still work via proxy.
- Basic rate limiting on public endpoints (IP or Supabase built-in where available).

### 2D. Harden existing Vercel admin APIs (half day)

For `api/invite-admin.js` and `api/reset-admin-password.js`:

- Request body size limit (~10 KB).
- Simple rate limit (e.g. Upstash/Vercel KV, or Supabase rate limits).
- Structured log line per invite/reset (email hash, timestamp, outcome — no passwords).

**Acceptance criteria:**

- Invite/reset spam is throttled.
- Failed auth attempts are visible in logs.

### Plan 2 rollout order

```
1. .gitignore + secret audit          (Plan 1B)
2. Storage RLS + admin JWT uploads    (2B)
3. Edge Function / API write proxy    (2C)
4. Tighten passport_state RLS         (2C, same deploy window)
5. Rotate anon key + redeploy         (2A)
6. Security headers + API rate limits (2A, 2D)
```

**What Plan 2 does *not* fix yet:** attendee impersonation, read-side PII exposure, RMW races, server-proven QR scans. Those move to Plan 3.

---

## Plan 3 — Remaining concerns (production-grade)

**Goal:** Trustworthy raffle, protected PII, scalable multi-admin events.  
**Effort:** ~2–4 weeks  
**Prerequisite:** Plan 2C proxy in place so the app doesn’t depend on open anon writes.

### 3A. Normalized schema

Replace the monolithic JSON blob with tables:

| Table | Purpose |
|-------|---------|
| `events` | id, name, status, created_at |
| `booths` | event_id, name, qr_code, map coords, logo_url, … |
| `event_settings` | event_id, required_scan_count, instructions, map_url, … |
| `attendees` | event_id, name, email, phone, role, terms_accepted_at |
| `scans` | attendee_id, booth_id, scanned_at (unique per pair) |
| `entries` | attendee_id, chances, submitted_at |
| `winners` | entry_id, drawn_at, … |

**Benefits:**

- RLS per table and per row.
- No full-document rewrite on each scan.
- Smaller payloads; fewer lost-update races.

**Migration:**

1. Add tables alongside existing `passport_state`.
2. Dual-write from Edge Functions during transition.
3. Backfill from JSON rows.
4. Switch client reads to new tables / views.
5. Deprecate `passport_state` writes, then reads.

### 3B. Real attendee authentication

Replace email+phone match with one of:

| Option | Pros | Cons |
|--------|------|------|
| Supabase Auth magic link | Built-in, RLS via `auth.uid()` | Email deliverability at venue |
| SMS OTP (Twilio + Edge Function) | Good for phone-first users | Cost + setup |
| Event-day PIN + email | Simple on flaky Wi‑Fi | Weaker than OTP |

Session becomes a server-issued JWT; `attendeeProgress` updates scoped to `auth.uid()`.

### 3C. Scan integrity

QR codes should not be the sole secret (they’re visible in booth JSON today).

| Approach | Description |
|----------|-------------|
| **Signed booth tokens** | QR encodes `{boothId, eventId, sig}`; server verifies HMAC before recording scan |
| **One-time codes** | Booth displays rotating code; harder for remote cheating |
| **Staff verify mode** | Admin confirms scan at booth (fallback) |

Implement in Edge Function `record_scan`: verify signature, enforce one scan per attendee per booth, log timestamp.

### 3D. RLS matrix (target state)

| Role | events/booths/settings | attendees | scans | entries/winners |
|------|------------------------|-----------|-------|-----------------|
| anon | Read public fields only | — | — | — |
| attendee | Read booths/settings | Read/update own row | Insert/read own | Insert/read own entry |
| admin | Full CRUD | Read all (event scope) | Read all | Full CRUD |
| service role | Edge Functions only | — | — | — |

Public reads should expose booth list + map, **not** full attendee/entry dumps.

### 3E. Concurrency & offline

| Issue | Fix |
|-------|-----|
| RMW on JSON blob | Gone after normalization; scans are single-row inserts |
| Offline scans | Queue `{ boothId, signedToken, timestamp }` locally; replay via `record_scan` with idempotency key |
| Admin edit conflicts | Optimistic locking on `events.updated_at` or booth-level PATCH |

### 3F. Compliance & ops

- Privacy policy aligned with stored fields (name, email, phone, role).
- Retention: auto-archive events; delete attendee PII N days post-event.
- Admin audit log table: who changed settings, picked winners, manual entries.
- Export/delete endpoints for GDPR/CCPA requests.
- Restore `.env.example`; run periodic secret scanning in CI.

### 3G. Client architecture (post-Plan 3)

```
Attendee app
  → read: Supabase REST (RLS-scoped views)
  → write: Edge Functions (scan, register, enter)

Admin app
  → auth: Supabase Auth (existing)
  → write: Edge Functions with admin JWT
  → assets: Storage with admin JWT (Plan 2B)

Local device
  → session JWT + offline scan queue only (cloud-first unchanged)
```

Deprecate `saveSharedPatch()` read-modify-write once tables + functions exist.

### Plan 3 phased rollout

```
Phase A (week 1): Schema + Edge Functions + dual-write
Phase B (week 2): Attendee auth + scan signing + tighten reads
Phase C (week 3): Client migration off passport_state JSON
Phase D (week 4): Audit logging, retention, load testing at event scale
```

---

## Comparison

| | Plan 1 | Plan 2 | Plan 3 |
|---|--------|--------|--------|
| **Effort** | ~1 day | ~2–4 days | ~2–4 weeks |
| **Fixes logo bloat** | ✅ | — | ✅ |
| **Fixes secret commits** | ✅ | ✅ | ✅ |
| **Fixes open DB writes** | — | ✅ (with proxy) | ✅ (full RLS) |
| **Fixes open storage** | — | ✅ | ✅ |
| **Fixes raffle integrity** | — | Partial | ✅ |
| **Fixes PII exposure** | — | Partial | ✅ |
| **Fixes races / offline** | Partial (smaller payloads) | — | ✅ |
| **Safe for public PII raffle** | ❌ | ⚠️ Better, not enough | ✅ |

---

## Recommended sequence

1. **This week:** Plan 1 (logos + `.gitignore`).
2. **Before next public event:** Plan 2 through storage lockdown + write proxy + RLS tighten + key rotation.
3. **Before treating as compliance-ready:** Plan 3 schema + attendee auth + scan signing.

I can implement Plan 1 in the repo next, or draft the Edge Function signatures and SQL for Plan 2C if you want to move faster on security.