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

## 5. Add more admins from the dashboard

After logging in as a `super_admin`, open:

```text
/admin -> Admin Users
```

From there you can authorize additional admin emails.

Important: the person still needs a Supabase Auth user account with that same
email. The admin dashboard authorizes the email; Supabase Auth stores the
password.
