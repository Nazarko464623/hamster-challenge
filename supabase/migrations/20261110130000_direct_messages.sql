create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  created_at timestamptz not null default now()
);

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_nickname text;
begin
  profile_nickname := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'nickname'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Player'
  );

  insert into public.profiles (id, nickname)
  values (new.id, profile_nickname)
  on conflict (id) do update set nickname = excluded.nickname;

  return new;
end;
$$;

drop trigger if exists sync_profile_after_auth_user_change on auth.users;
create trigger sync_profile_after_auth_user_change
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth_user();

insert into public.profiles (id, nickname)
select
  users.id,
  coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'nickname'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'Player'
  )
from auth.users as users
on conflict (id) do update set nickname = excluded.nickname;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
drop policy if exists "Authenticated users can view player profiles" on public.profiles;
create policy "Authenticated users can view player profiles"
  on public.profiles for select
  to authenticated
  using (true);

grant select on public.profiles to authenticated;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_no_self_delivery check (sender_id <> recipient_id)
);

create index if not exists messages_sender_recipient_created_idx
  on public.messages (sender_id, recipient_id, created_at desc);
create index if not exists messages_recipient_sender_created_idx
  on public.messages (recipient_id, sender_id, created_at desc);

alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
drop policy if exists "Participants can view direct messages" on public.messages;
create policy "Participants can view direct messages"
  on public.messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Users can send direct messages" on public.messages;
create policy "Users can send direct messages"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and sender_id <> recipient_id
    and read_at is null
  );

drop policy if exists "Recipients can mark messages as read" on public.messages;
create policy "Recipients can mark messages as read"
  on public.messages for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id and read_at is not null);

grant select on public.messages to authenticated;
grant insert (sender_id, recipient_id, body) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Supabase realtime publication is missing.';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
