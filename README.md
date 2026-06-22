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
