# Admin Login Setup

Admin login now uses Supabase Auth plus an `admin_users` allowlist table.

## 1. Run the SQL

In Supabase, open **SQL Editor** and run the contents of:

```text
supabase-setup.sql
```

This creates the `admin_users` table and row-level-security policies.

## 2. Create the first Supabase Auth user

In Supabase:

```text
Authentication -> Users -> Add user
```

Create the first admin with an email and password.

## 3. Bootstrap the first super admin

In Supabase SQL Editor, run this with the same email:

```sql
insert into public.admin_users (email, name, role)
values ('you@example.com', 'Your Name', 'super_admin')
on conflict (email) do update
set name = excluded.name,
    role = excluded.role;
```

## 4. Log in

Use the Supabase Auth email and password on the app admin login.

## 5. Enable admin invites

In Vercel, add this server-side environment variable:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Use the Supabase service role key from:

```text
Supabase -> Project Settings -> API -> service_role key
```

Never expose this key with a `VITE_` prefix.

Also add this server-side environment variable so invite links always point to
production, even if someone sends an invite while testing locally:

```text
ADMIN_INVITE_REDIRECT_URL
```

Use:

```text
https://tradeshow-passport-raffle.vercel.app/admin
```

Redeploy after saving the variable.

## 6. Configure Supabase invite redirects

In Supabase, open:

```text
Authentication -> URL Configuration
```

Set **Site URL** to your production app URL:

```text
https://tradeshow-passport-raffle.vercel.app
```

Add this to **Redirect URLs**:

```text
https://tradeshow-passport-raffle.vercel.app/admin
```

If you invite admins from preview deployments, also add the exact preview
`/admin` URL. Supabase invite links will fail if the redirect URL is not
allowlisted.

## 7. Add more admins from the dashboard

After logging in as a `super_admin`, open:

```text
/admin -> Admin Users
```

From there you can invite additional admins. The app sends a Supabase Auth
invite email and authorizes the email in `admin_users`.

The same Admin Users table also includes **Send Reset**, which sends a Supabase
password reset email to an authorized admin. Password reset links use
`ADMIN_INVITE_REDIRECT_URL`, so keep that environment variable pointed at the
production `/admin` URL.
