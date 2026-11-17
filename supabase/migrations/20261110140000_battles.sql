create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  category text not null check (char_length(btrim(category)) between 1 and 50),
  custom_category text,
  duration_days integer not null check (duration_days between 1 and 7),
  created_at timestamptz not null default now(),
  ends_at timestamptz not null,
  constraint battles_custom_category_required check (
	category <> 'Other' or char_length(btrim(coalesce(custom_category, ''))) between 1 and 200
  )
);

create table if not exists public.battle_entries (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  artwork_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists battles_created_at_idx on public.battles (created_at desc);
create index if not exists battle_entries_battle_id_idx on public.battle_entries (battle_id, created_at);

alter table public.battles enable row level security;
alter table public.battle_entries enable row level security;
revoke all on public.battles from anon, authenticated;
revoke all on public.battle_entries from anon, authenticated;

create policy "Authenticated users can view battles"
  on public.battles for select
  to authenticated
  using (true);

create policy "Users can create their own battles"
  on public.battles for insert
  to authenticated
  with check (auth.uid() = owner_id);

grant select on public.battles to authenticated;
grant insert (owner_id, title, category, custom_category, duration_days, ends_at) on public.battles to authenticated;

create policy "Authenticated users can view battle entries"
  on public.battle_entries for select
  to authenticated
  using (true);

create policy "Users can create their own battle entries"
  on public.battle_entries for insert
  to authenticated
  with check (auth.uid() = creator_id);

grant select on public.battle_entries to authenticated;
grant insert (battle_id, creator_id, artwork_url) on public.battle_entries to authenticated;

insert into storage.buckets (id, name, public)
values ('battle-artwork', 'battle-artwork', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users can upload battle artwork" on storage.objects;
create policy "Authenticated users can upload battle artwork"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'battle-artwork' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Anyone can view battle artwork" on storage.objects;
create policy "Anyone can view battle artwork"
  on storage.objects for select
  to public
  using (bucket_id = 'battle-artwork');
