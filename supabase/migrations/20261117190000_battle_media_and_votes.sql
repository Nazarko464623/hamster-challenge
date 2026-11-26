alter table public.battle_entries
  add column if not exists media_type text not null default 'image'
  check (media_type in ('image', 'video'));

grant insert (battle_id, creator_id, artwork_url, media_type)
  on public.battle_entries to authenticated;

create table if not exists public.battle_entry_votes (
  entry_id uuid not null references public.battle_entries (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, voter_id)
);

create index if not exists battle_entry_votes_entry_id_idx
  on public.battle_entry_votes (entry_id);

alter table public.battle_entry_votes enable row level security;
revoke all on public.battle_entry_votes from anon, authenticated;

drop policy if exists "Authenticated users can view battle entry votes" on public.battle_entry_votes;
create policy "Authenticated users can view battle entry votes"
  on public.battle_entry_votes for select
  to authenticated
  using (true);

drop policy if exists "Players can vote on other entries in live battles" on public.battle_entry_votes;
create policy "Players can vote on other entries in live battles"
  on public.battle_entry_votes for insert
  to authenticated
  with check (
    auth.uid() = voter_id
    and exists (
      select 1
      from public.battle_entries as entry
      join public.battles as battle on battle.id = entry.battle_id
      where entry.id = battle_entry_votes.entry_id
        and entry.creator_id <> auth.uid()
        and battle.ends_at > now()
    )
  );

drop policy if exists "Players can remove their own votes" on public.battle_entry_votes;
create policy "Players can remove their own votes"
  on public.battle_entry_votes for delete
  to authenticated
  using (auth.uid() = voter_id);

grant select on public.battle_entry_votes to authenticated;
grant insert (entry_id, voter_id) on public.battle_entry_votes to authenticated;
grant delete on public.battle_entry_votes to authenticated;
