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
- Current policies allow anonymous upload (Plan 2 will restrict this to admins)
