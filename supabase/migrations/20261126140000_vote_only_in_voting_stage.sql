-- SCRUM-34: votes are accepted only in the Voting stage of a battle.
--
-- Format agreed in SCRUM-42: first half of the battle is for entries, second half for voting.
-- 20261117190000_battle_media_and_votes.sql allowed votes for the whole battle (ends_at > now()),
-- so early entries could collect votes longer than late ones, and the "Voting" status meant nothing.
-- Removing a vote is also limited to the Voting stage, so results cannot change after the end.
--
-- Run in the Supabase SQL Editor after 20261117170000_battle_statuses.sql and
-- 20261117190000_battle_media_and_votes.sql. Safe to run more than once.

drop policy if exists "Players can vote on other entries in live battles" on public.battle_entry_votes;
drop policy if exists "Players can vote on other entries during voting" on public.battle_entry_votes;
create policy "Players can vote on other entries during voting"
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
        and public.battle_status(battle.created_at, battle.ends_at) = 'active'
    )
  );

drop policy if exists "Players can remove their own votes" on public.battle_entry_votes;
create policy "Players can remove their own votes"
  on public.battle_entry_votes for delete
  to authenticated
  using (
    auth.uid() = voter_id
    and exists (
      select 1
      from public.battle_entries as entry
      join public.battles as battle on battle.id = entry.battle_id
      where entry.id = battle_entry_votes.entry_id
        and public.battle_status(battle.created_at, battle.ends_at) = 'active'
    )
  );
