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
