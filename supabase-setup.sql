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

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users current_admin
    where lower(current_admin.email) = lower(auth.jwt() ->> 'email')
  )
);

drop policy if exists "Super admins can add admin users" on public.admin_users;
create policy "Super admins can add admin users"
on public.admin_users
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users current_admin
    where lower(current_admin.email) = lower(auth.jwt() ->> 'email')
      and current_admin.role = 'super_admin'
  )
);

drop policy if exists "Super admins can update admin users" on public.admin_users;
create policy "Super admins can update admin users"
on public.admin_users
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_users current_admin
    where lower(current_admin.email) = lower(auth.jwt() ->> 'email')
      and current_admin.role = 'super_admin'
  )
)
with check (
  exists (
    select 1
    from public.admin_users current_admin
    where lower(current_admin.email) = lower(auth.jwt() ->> 'email')
      and current_admin.role = 'super_admin'
  )
);

drop policy if exists "Super admins can delete admin users" on public.admin_users;
create policy "Super admins can delete admin users"
on public.admin_users
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_users current_admin
    where lower(current_admin.email) = lower(auth.jwt() ->> 'email')
      and current_admin.role = 'super_admin'
  )
);

-- After creating your first Supabase Auth user, bootstrap the first admin:
-- insert into public.admin_users (email, name, role)
-- values ('you@example.com', 'Your Name', 'super_admin')
-- on conflict (email) do update set name = excluded.name, role = excluded.role;
