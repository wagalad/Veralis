-- ============================================================
-- Veralis — Canonical Database Schema + Row Level Security
-- This file reflects the CURRENT live state (schema + all migrations).
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================


-- ============================================================
-- 1. PROFILES
--    One row per user. Created automatically on sign-up via trigger.
-- ============================================================
create table public.profiles (
  id                 uuid references auth.users(id) on delete cascade primary key,
  display_name       text check (display_name is null or char_length(display_name) <= 100),
  last_join_attempt  timestamptz,
  updated_at         timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Trigger: auto-create a profile row whenever a new user signs up.
-- Pulls display_name from Google/Apple OAuth metadata if available.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 2. TEAMS
--    Represents a VEX team (e.g. "16858A").
--    Only members of a team can read its row (invite_code is sensitive).
--    All writes go through Edge Functions using the service role.
-- ============================================================
create table public.teams (
  id           uuid default gen_random_uuid() primary key,
  team_number  text not null unique check (char_length(team_number) <= 12),
  team_name    text check (team_name is null or char_length(team_name) <= 100),
  invite_code  text not null unique,
  created_at   timestamptz default now()
);

alter table public.teams enable row level security;

-- Only members of a team can see that team's row (protects invite_code).
create policy "teams: members can read own teams"
  on public.teams for select
  using (
    exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = teams.id
        and team_memberships.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies — all writes go through Edge Functions.


-- ============================================================
-- 3. TEAM_MEMBERSHIPS
--    Join table: which users belong to which team, and at what role.
--    All writes (join, leave, promote, remove) go through Edge Functions.
-- ============================================================
create table public.team_memberships (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  team_id    uuid references public.teams(id) on delete cascade not null,
  role       text not null default 'member' check (role in ('admin', 'member')),
  joined_at  timestamptz default now(),
  unique (user_id, team_id)
);

alter table public.team_memberships enable row level security;

-- A user can only see their own membership rows.
create policy "team_memberships: read own"
  on public.team_memberships for select
  using (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies — all writes go through Edge Functions.

create index team_memberships_user_id_idx on public.team_memberships(user_id);
create index team_memberships_team_id_idx on public.team_memberships(team_id);


-- ============================================================
-- 4. SCOUTING_ENTRIES
--    Core table. Each row is one robot scouted by one team.
--    CRITICAL RLS: a user may only read/write entries belonging to
--    a team they are a member of. Cross-team data is invisible.
-- ============================================================
create table public.scouting_entries (
  id                   uuid default gen_random_uuid() primary key,
  team_id              uuid references public.teams(id) on delete cascade not null,
  scouted_team_number  text not null check (char_length(scouted_team_number) <= 12),
  drivetrain           text check (drivetrain in ('tank', 'mecanum', 'xdrive', 'other')),
  intake               text check (intake in ('strong', 'okay', 'weak', 'none')),
  scoring              text check (scoring in ('fast', 'average', 'slow', 'cant_tell')),
  autonomous           text check (autonomous in ('strong', 'works', 'weak_none', 'didnt_see')),
  reliability          int  check (reliability between 1 and 5),
  note                 text check (note is null or char_length(note) <= 200),
  photo_url            text check (photo_url is null or char_length(photo_url) <= 500),
  created_by           uuid references auth.users(id) not null,
  created_at           timestamptz default now()
);

alter table public.scouting_entries enable row level security;

create policy "scouting_entries: team members can read"
  on public.scouting_entries for select
  using (
    exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  );

create policy "scouting_entries: team members can insert"
  on public.scouting_entries for insert
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  );

create policy "scouting_entries: team members can update"
  on public.scouting_entries for update
  using (
    exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  );

create index scouting_entries_team_id_idx     on public.scouting_entries(team_id);
create index scouting_entries_created_by_idx  on public.scouting_entries(created_by);
create index scouting_entries_created_at_idx  on public.scouting_entries(created_at desc);
