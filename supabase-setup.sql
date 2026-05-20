create table if not exists public.passport_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.passport_state enable row level security;

drop policy if exists "Allow public passport state reads" on public.passport_state;
create policy "Allow public passport state reads"
on public.passport_state
for select
to anon
using (true);

drop policy if exists "Allow public passport state inserts" on public.passport_state;
create policy "Allow public passport state inserts"
on public.passport_state
for insert
to anon
with check (true);

drop policy if exists "Allow public passport state updates" on public.passport_state;
create policy "Allow public passport state updates"
on public.passport_state
for update
to anon
using (true)
with check (true);

create table if not exists public.admin_users (
  email text primary key,
  name text,
  role text not null default 'admin' check (role in ('admin', 'super_admin')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_authorized_admin(user_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(user_email)
  );
$$;

create or replace function public.is_authorized_super_admin(user_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(user_email)
      and role = 'super_admin'
  );
$$;

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users
for select
to authenticated
using (public.is_authorized_admin(auth.jwt() ->> 'email'));

drop policy if exists "Super admins can add admin users" on public.admin_users;
create policy "Super admins can add admin users"
on public.admin_users
for insert
to authenticated
with check (public.is_authorized_super_admin(auth.jwt() ->> 'email'));

drop policy if exists "Super admins can update admin users" on public.admin_users;
create policy "Super admins can update admin users"
on public.admin_users
for update
to authenticated
using (public.is_authorized_super_admin(auth.jwt() ->> 'email'))
with check (public.is_authorized_super_admin(auth.jwt() ->> 'email'));

drop policy if exists "Super admins can delete admin users" on public.admin_users;
create policy "Super admins can delete admin users"
on public.admin_users
for delete
to authenticated
using (public.is_authorized_super_admin(auth.jwt() ->> 'email'));

-- After creating your first Supabase Auth user, bootstrap the first admin:
-- insert into public.admin_users (email, name, role)
-- values ('you@example.com', 'Your Name', 'super_admin')
-- on conflict (email) do update set name = excluded.name, role = excluded.role;
