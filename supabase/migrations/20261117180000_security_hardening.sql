-- Security hardening: closes ways to bypass the app's checks by calling the Supabase API directly.
--
-- The anon key is public (it ships inside the app), so anyone can talk to the database with it.
-- Every rule that matters has to live here, in the database, not only in the app's code.
--
-- What this migration fixes:
--   1. Battles: the client could send any ends_at (a battle "for 7 days" that lasts 100 years
--      or has already ended). Dates are now set by the server from duration_days.
--   2. Battle entries: one player could submit unlimited entries to the same battle.
--   3. Battle entries: artwork_url could point to any website (tracking pixels, shock images).
--      It must now be a file this player uploaded to our battle-artwork bucket.
--   4. Storage: any file type and size could be uploaded to a public bucket (HTML or SVG pages
--      for phishing, huge files). Now only images up to 5 MB.
--   5. Storage: anyone, even without an account, could list every uploaded file.
--   6. Nicknames: any length, invisible characters and names like "admin" were accepted.
--   7. Spam: no limits on how fast messages, battles and entries can be created.
--
-- Run in the Supabase SQL Editor after 20261110140000_battles.sql. Safe to run more than once.
-- Existing rows are not changed or deleted; the rules apply to new data.

-- ---------------------------------------------------------------------------------------------
-- Helper: rate limit. Raises an error when the current user already created `max_count` rows
-- in `table_name` within `per_interval`.
-- ---------------------------------------------------------------------------------------------
create or replace function public.enforce_rate_limit(
  table_name text,
  user_column text,
  max_count integer,
  per_interval interval,
  friendly_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  if auth.uid() is null then
    return; -- SQL Editor / service role: no limit
  end if;

  execute format(
    'select count(*) from public.%I where %I = $1 and created_at > now() - $2',
    table_name,
    user_column
  )
  into recent_count
  using auth.uid(), per_interval;

  if recent_count >= max_count then
    raise exception 'too many %, please wait a little and try again.', friendly_action
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.enforce_rate_limit(text, text, integer, interval, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 1. Battles: server sets the dates, plus a rate limit
-- ---------------------------------------------------------------------------------------------
create or replace function public.prepare_new_battle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enforce_rate_limit('battles', 'owner_id', 5, interval '1 hour', 'battles created');

  new.created_at := now();
  new.ends_at := new.created_at + make_interval(days => new.duration_days);
  return new;
end;
$$;

drop trigger if exists prepare_new_battle on public.battles;
create trigger prepare_new_battle
  before insert on public.battles
  for each row execute function public.prepare_new_battle();

-- ---------------------------------------------------------------------------------------------
-- 2 + 3. Battle entries: one per player per battle, artwork must be the player's own upload
-- ---------------------------------------------------------------------------------------------
create or replace function public.check_new_battle_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  artwork_path text;
begin
  perform public.enforce_rate_limit('battle_entries', 'creator_id', 20, interval '1 hour', 'entries');

  if exists (
    select 1 from public.battle_entries e
    where e.battle_id = new.battle_id and e.creator_id = new.creator_id
  ) then
    raise exception 'you already have an entry in this battle.' using errcode = 'P0001';
  end if;

  -- Expected: https://<project>.supabase.co/storage/v1/object/public/battle-artwork/<user id>/<file>
  -- (http://localhost or 127.0.0.1 is allowed for a local Supabase).
  if new.artwork_url !~* (
    '^(https://[a-z0-9-]+\.supabase\.co|https?://(localhost|127\.0\.0\.1)(:[0-9]+)?)'
    || '/storage/v1/object/public/battle-artwork/'
    || new.creator_id::text
    || '/[A-Za-z0-9._/-]+$'
  ) then
    raise exception 'artwork must be a photo uploaded in the app.' using errcode = 'P0001';
  end if;

  artwork_path := substring(new.artwork_url from '/battle-artwork/(.+)$');

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'battle-artwork'
      and o.name = artwork_path
      and (o.owner_id = new.creator_id::text or o.owner = new.creator_id)
  ) then
    raise exception 'artwork must be a photo uploaded in the app.' using errcode = 'P0001';
  end if;

  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists check_new_battle_entry on public.battle_entries;
create trigger check_new_battle_entry
  before insert on public.battle_entries
  for each row execute function public.check_new_battle_entry();

-- ---------------------------------------------------------------------------------------------
-- 4 + 5. Storage: images only, up to 5 MB, no public listing of all files
-- ---------------------------------------------------------------------------------------------
update storage.buckets
set
  file_size_limit = 5 * 1024 * 1024,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/gif',
    -- some Android phones send photos without a type; such files are served as a download,
    -- never rendered as a page, so they cannot be used for phishing
    'application/octet-stream'
  ]
where id = 'battle-artwork';

-- The bucket is public: photos open by their link without any policy. This policy only
-- allowed *listing* every file to anyone, including people without an account.
drop policy if exists "Anyone can view battle artwork" on storage.objects;
drop policy if exists "Users can list their own battle artwork" on storage.objects;
create policy "Users can list their own battle artwork"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'battle-artwork' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------------------------
-- 6. Nicknames: trimmed, 2 to 24 visible characters, no reserved names
-- ---------------------------------------------------------------------------------------------
create or replace function public.is_reserved_nickname(nickname text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(nickname, '[^[:alnum:]]', '', 'g')) in (
    'admin', 'administrator', 'moderator', 'mod', 'support', 'system', 'root',
    'hamster', 'hamsterchallenge', 'official', 'staff'
  );
$$;

create or replace function public.clean_nickname(raw_nickname text, fallback text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  result text;
begin
  -- remove control and invisible characters (zero-width spaces, direction marks, BOM)
  result := regexp_replace(coalesce(raw_nickname, ''), '[[:cntrl:]​-‏‪-‮⁠-⁤﻿]', '', 'g');
  result := btrim(regexp_replace(result, '\s+', ' ', 'g'));
  result := left(result, 24);

  if char_length(result) < 2 or public.is_reserved_nickname(result) then
    result := left(btrim(coalesce(fallback, '')), 24);
  end if;

  -- the fallback (part of the email) is checked too: admin@... must not become "admin"
  if char_length(result) < 2 or public.is_reserved_nickname(result) then
    result := 'Player';
  end if;

  return result;
end;
$$;

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_nickname text;
begin
  profile_nickname := public.clean_nickname(
    new.raw_user_meta_data ->> 'nickname',
    split_part(coalesce(new.email, ''), '@', 1)
  );

  insert into public.profiles (id, nickname)
  values (new.id, profile_nickname)
  on conflict (id) do update set nickname = excluded.nickname;

  return new;
end;
$$;

alter table public.profiles drop constraint if exists profiles_nickname_length;
alter table public.profiles
  add constraint profiles_nickname_length check (char_length(nickname) between 1 and 32) not valid;

-- ---------------------------------------------------------------------------------------------
-- 7. Messages: no more than 20 per minute from one player
-- ---------------------------------------------------------------------------------------------
create or replace function public.check_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enforce_rate_limit('messages', 'sender_id', 20, interval '1 minute', 'messages');
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists check_new_message on public.messages;
create trigger check_new_message
  before insert on public.messages
  for each row execute function public.check_new_message();
