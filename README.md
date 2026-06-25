# Tradeshow Passport Raffle

A React + Vite PWA for tradeshow passport stamp collection and raffle entry.

## Environment variables

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Client | Supabase anon/public key |
| `VITE_CLOUD_FIRST` | Client | Set to `false` for local-only mode |
| `VITE_API_BASE_URL` | Client | Optional API host override for native builds |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel server | Admin invite/reset API routes |
| `ADMIN_INVITE_REDIRECT_URL` | Vercel server | Redirect target for invite/reset emails |
| `ADMIN_INVITE_DEEP_LINK_URL` | Vercel server | Optional native app deep link for invites |

See [ADMIN_LOGIN_SETUP.md](./ADMIN_LOGIN_SETUP.md) for admin auth setup and Supabase SQL migrations.

## Supabase Storage (booth logos and event images)

Booth logos, floor maps, and home/raffle images upload to the `event-assets` bucket. Run once per project:

1. Open **Supabase Dashboard → SQL Editor**
2. Run `supabase-setup.sql` (if not already done)
3. Run `supabase-storage-setup.sql`

Verify in **Storage → event-assets** that the bucket exists and is **public** (read-only for attendees).

Logo paths look like:

```text
{eventId}/booth-logos/{boothId}-{timestamp}.jpg
{eventId}/mapSrc/{timestamp}.jpg
```

### Migrating existing inline logos

If booths were saved before this change, logos may still be base64 inside `passport_state`. In admin (**Booths** section), use **Migrate logos to Storage** to upload them and replace inline data with public URLs.

### Troubleshooting uploads

- Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env`
- Confirm `event-assets` bucket exists (run `supabase-storage-setup.sql`)
- Check browser devtools → Network for failed `storage/v1/object/event-assets/...` requests
- Uploads require a signed-in admin JWT after Plan 2 storage lockdown

## Plan 2 security rollout (manual steps)

Deploy the code first, then apply Supabase SQL in this order:

1. **Secret hygiene** — confirm `.env` was never committed: `git log --all -- .env`. If it was, rotate Supabase keys in the dashboard.
2. **Storage lockdown** — run the updated `supabase-storage-setup.sql` in Supabase SQL Editor (admin-only upload/update).
3. **Deploy to Vercel** — ensure `SUPABASE_SERVICE_ROLE_KEY` is set for `/api/passport-write`.
4. **Verify the write proxy** — registration, scans, raffle entry, and admin booth/settings edits should all work.
5. **Lock passport_state writes** — run `supabase-passport-state-rls-lockdown.sql` only after step 4 passes.
6. **Rotate anon key** — Supabase Dashboard → Settings → API → rotate anon key, update Vercel env + local `.env`, redeploy.
7. **Smoke test** — anonymous `curl` upload to `event-assets` and direct `POST` to `passport_state` should fail (403).

To bypass the write proxy during local debugging only, set `VITE_DIRECT_SUPABASE_WRITES=true` in `.env`.
