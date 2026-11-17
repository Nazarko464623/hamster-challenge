-- SCRUM-34: battle statuses (open, active, ended).
--
-- open   - first half of the battle: players join and submit entries
-- active - second half: entries are closed, players vote
-- ended  - after ends_at: voting is closed, the winner is decided
--
-- The status is worked out from created_at and ends_at, so nothing has to update it on a timer.
-- Run this file in the Supabase SQL Editor after 20261110140000_battles.sql.

create or replace function public.battle_status(
  battle_created_at timestamptz,
  battle_ends_at timestamptz,
  at_time timestamptz default now()
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when at_time >= battle_ends_at then 'ended'
    when at_time >= battle_created_at + (battle_ends_at - battle_created_at) / 2 then 'active'
    else 'open'
  end;
$$;

comment on function public.battle_status(timestamptz, timestamptz, timestamptz) is
  'Battle stage at a given time: open (entries), active (voting) or ended.';

grant execute on function public.battle_status(timestamptz, timestamptz, timestamptz) to authenticated;

-- Lets the app read the status straight from a query: select id, status from battles_with_status
create or replace view public.battles_with_status
with (security_invoker = true)
as
  select b.*, public.battle_status(b.created_at, b.ends_at) as status
  from public.battles b;

grant select on public.battles_with_status to authenticated;

-- Entries can only be added while the battle is open.
drop policy if exists "Users can create their own battle entries" on public.battle_entries;
create policy "Users can create their own battle entries"
  on public.battle_entries for insert
  to authenticated
  with check (
    auth.uid() = creator_id
    and exists (
      select 1
      from public.battles b
      where b.id = battle_id
        and public.battle_status(b.created_at, b.ends_at) = 'open'
    )
  );
