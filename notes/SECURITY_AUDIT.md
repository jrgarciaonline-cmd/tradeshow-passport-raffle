# Security Audit — Trade Show Passport Raffle

**Scope:** Application source, Supabase SQL policies, Vercel API routes, client-side auth and data flow  
**Last reviewed:** June 2026  
**Overall posture:** Admin auth is reasonably structured; **event and attendee data are not protected at the database layer**, which is the dominant risk.

---

## Architecture

```
Browser (anon key in JS bundle)
    ├── Direct read/write → Supabase passport_state (open RLS)
    ├── Direct upload → Supabase Storage event-assets (open write)
    ├── Admin login → Supabase Auth + admin_users (RLS protected)
    └── POST /api/invite-admin, /api/reset-admin-password → Vercel (service role)
```

The Supabase **anon key is public by design** (embedded in the built JS). Security must come from **Row Level Security and server-side validation**. Today, most protections exist only in the React app — not enforceable against a motivated attacker with curl or browser devtools.

**Relevant files:**

| Area | Files |
|------|--------|
| Database policies | `supabase-setup.sql`, `supabase-storage-setup.sql` |
| Event data / sync | `src/services/passportRepository.js`, `src/services/usePassportStore.js` |
| Admin auth | `src/services/adminAuth.js`, `src/components/AdminDashboard.jsx` |
| Attendee auth | `src/components/AuthScreen.jsx` |
| Asset uploads | `src/services/assetStorage.js` |
| Server APIs | `api/invite-admin.js`, `api/reset-admin-password.js` |
| Deploy config | `vercel.json` |

---

## Critical Findings

### 1. `passport_state` is fully writable by anyone

**Location:** `supabase-setup.sql` — policies on `public.passport_state`

The table allows anonymous `SELECT`, `INSERT`, and `UPDATE` with `using (true)` / `with check (true)`.

**Impact:** Anyone can extract the anon key from the production site and:

- Read all attendee PII (name, email, phone, role)
- Read/export all raffle entries and winners
- Overwrite booths, settings, scan progress, entries, winners
- Wipe or sabotage a live event
- Add fake raffle entries or manipulate who “won”

**Proof concept for auditors:**

```bash
curl "https://YOUR_PROJECT.supabase.co/rest/v1/passport_state?select=data" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Remediation:**

- Replace open policies with role-based RLS or move writes behind authenticated APIs
- **Public read:** only non-sensitive fields (booth list, map, settings) — not full attendee/entry blobs
- **Attendee writes:** authenticated attendee can only update their own progress
- **Admin writes:** require Supabase Auth JWT with `admin_users` check
- **Raffle integrity:** server-validated scan logs and entry submission

---

### 2. Storage bucket allows anonymous upload and overwrite

**Location:** `supabase-storage-setup.sql` — policies on `storage.objects` for bucket `event-assets`

Policies allow `INSERT` and `UPDATE` to `public` for the `event-assets` bucket.

**Impact:** Storage abuse, cost inflation, malicious file hosting, overwriting event images.

**Remediation:** Restrict uploads to authenticated admins only; keep public read if images must be hot-linked.

---

### 3. All business rules are client-side only

**Location:** `src/services/usePassportStore.js` — `checkInByCode`, `submitEntry`, `saveBooth`, `saveSettings`, etc.

Scan check-in, raffle eligibility, and admin actions ultimately call `saveSharedPatch()` with the anon key. No server validates:

- That a QR scan actually occurred
- That required scan count was met before entry
- That the caller is an admin for booth/settings changes

QR codes are stored in the public `passport_state` JSON, so an attacker can read every booth code without scanning.

**Impact:** Raffle integrity cannot be trusted for compliance or disputes.

**Remediation:** Server-side scan logging (signed tokens, one-time codes, or admin-verified check-ins) and server-side entry creation.

---

## High Findings

### 4. Attendee authentication is weak

**Location:** `src/services/usePassportStore.js` — `signInAttendee`, `registerAttendee`

Sign-in is email + phone match against data stored in the public database. No password, OTP, or magic link. Session is a local flag (`session.attendeeId`), not a server-issued token.

**Impact:**

- PII is readable from Supabase directly (finding #1), so impersonation is trivial
- No server-side session binding

**Remediation:** Supabase Auth (or similar) for attendees, or server-issued session tokens with RLS scoped to `auth.uid()`.

---

### 5. Admin UI protection ≠ admin data protection

**Location:** `src/components/AdminDashboard.jsx`, `src/App.jsx`

`/admin` shows a login screen when `adminAuthenticated` is false, but the data layer does not require admin auth for writes. An attacker never needs to log in to change event data.

Admin auth for `admin_users` is correctly gated in `supabase-setup.sql` — but that protection applies to the admin roster table, not to `passport_state`.

---

### 6. Admin session tokens stored in localStorage

**Location:** `src/services/passportRepository.js` — `writeSessionSlice`

Admin `accessToken` and `refreshToken` are persisted in `localStorage` under `tradeshow-passport-session-v1`.

**Impact:** Any XSS vulnerability gives full admin session takeover until tokens expire.

**Remediation:** HttpOnly secure cookies for admin sessions (requires backend), or strict CSP; shorten token lifetime; avoid persisting refresh tokens in localStorage where possible.

---

### 7. PII stored in plaintext JSON without field-level access control

**Location:** `passport_state.data` JSON blob

Attendee records include name, email, phone, role, and terms acceptance timestamp — all readable via finding #1.

**Impact:** GDPR/CCPA exposure, breach notification obligations, no field-level access control.

**Remediation:** Normalize into tables with RLS, document data retention/deletion, align with privacy policy.

---

## Medium Findings

### 8. Hidden admin entry (logo triple-tap) is obscurity, not security

**Location:** `src/components/AuthScreen.jsx` — `handleLogoTap`

Anyone can navigate directly to `/admin`. The triple-tap only hides the UI affordance.

---

### 9. Invite/recovery tokens in URL

**Location:** `src/components/AdminDashboard.jsx` — `getInviteAccessToken`

Standard Supabase flow, but tokens can leak via browser history, analytics, or Referer headers if misconfigured.

**Remediation:** Ensure Supabase redirect URLs are exact; clear hash after processing; no third-party analytics on `/admin` during invite flow.

---

### 10. Read-modify-write race on shared state

**Location:** `src/services/passportRepository.js` — `saveSharedPatch`, `flushOfflineQueue`

Loads remote state, merges client patch, writes back — no versioning or conflict detection.

**Impact:** Concurrent admins or attendees can overwrite each other’s changes during busy events.

**Remediation:** Optimistic locking (`updated_at` check), or atomic Postgres functions per operation.

---

### 11. Vercel API routes lack hardening extras

**Location:** `api/invite-admin.js`, `api/reset-admin-password.js`

These correctly verify `super_admin` via JWT before using the service role key.

Missing:

- Rate limiting (invite/reset spam)
- Explicit request size limits
- Structured audit logging

---

### 12. `.env` not explicitly gitignored

**Location:** `.gitignore`

`.gitignore` includes `*.local` but not `.env` or `.env.production`. The service role key must never be committed or prefixed with `VITE_`.

**Remediation:** Add `.env`, `.env.production` to `.gitignore`; verify git history has no leaked keys.

---

## Low / Informational

| Item | Notes |
|------|--------|
| **npm audit** | 0 known vulnerabilities in current lockfile (June 2026) |
| **No `dangerouslySetInnerHTML`** | Reduces XSS surface |
| **Service role key** | Only referenced in Vercel API routes — correct |
| **Admin invite API** | Validates super_admin before invite/reset — correct |
| **HTTPS** | Provided by Vercel in production |
| **No CSP headers** | `vercel.json` has no Content-Security-Policy |
| **Service worker** | Caches same-origin assets; standard offline PWA pattern (`public/sw.js`) |
| **CSV export** | Admin-only in UI; data already extractable via finding #1 |

---

## What Is Done Well

1. **Admin allowlist** — Supabase Auth + `admin_users` table with RLS on that table
2. **Service role isolation** — not exposed to the browser
3. **Super-admin gating** on invite and password-reset APIs
4. **Image upload compression** — reduces accidental oversized payloads (`src/utils/imageUpload.js`)
5. **Cloud-first mode** — reduces stale localStorage as source of truth (but Supabase is still open)
6. **Minimal dependency tree** — small attack surface in npm packages

---

## Recommended Remediation Roadmap

### Phase 1 — Stop the bleeding (before or immediately after launch)

1. Lock down `passport_state` RLS (no anonymous write; split read scopes)
2. Lock down storage upload policies (admin-only)
3. Rotate Supabase anon key after policy fix (old key may be cached in builds)
4. Confirm service role key never appeared in git or client bundles
5. Add `.env` to `.gitignore`

### Phase 2 — Trustworthy raffle

6. Normalized tables: `attendees`, `scans`, `entries`, `winners`, `booths`, `events`
7. Server-side scan validation (Edge Functions or Postgres RPC)
8. Attendee auth with real credentials or magic links

### Phase 3 — Production hardening

9. Rate limiting on auth and admin APIs
10. CSP + security headers in `vercel.json`
11. Audit logging for admin actions
12. Data retention and export/delete process for compliance

---

## Suggested Tests for Audit Team

| Test | Expected today | Should be after fix |
|------|----------------|---------------------|
| Extract anon key from production JS | Possible | Still possible (by design) |
| Read full event JSON via REST API | **Succeeds** | Fails or returns redacted data |
| POST fake raffle entry via REST | **Succeeds** | Fails without auth |
| POST fake scan progress for another attendee | **Succeeds** | Fails |
| Upload file to `event-assets` without login | **Succeeds** | Fails |
| Access `/admin` without login | Login screen only | Same (UI) |
| Modify booths via REST without admin JWT | **Succeeds** | Fails |
| Call `/api/invite-admin` without super_admin token | Fails | Fails |
| Impersonate attendee with email+phone from leaked data | **Succeeds** | Fails without proper auth |

---

## Bottom Line

The app is acceptable for **demos and internal pilots**. For a **public raffle collecting PII on a production domain**, the open Supabase policies are the blocker: the database trusts every visitor as fully authorized to read and write all event data.

**Priority:** Fix RLS and move integrity-sensitive operations server-side before treating this as production-ready from a security standpoint.

---

## Related Documentation

- `ADMIN_LOGIN_SETUP.md` — Admin auth and invite configuration
- `.env.example` — Required environment variables
- `supabase-setup.sql` — Database schema and RLS (needs hardening)
- `supabase-storage-setup.sql` — Storage bucket policies (needs hardening)
