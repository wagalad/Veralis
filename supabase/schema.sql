-- ============================================================
-- Veralis — Database Schema + Row Level Security
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================


-- ============================================================
-- 1. PROFILES
--    One row per user. Created automatically on sign-up via trigger.
-- ============================================================
create table public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  display_name  text,
  updated_at    timestamptz default now()
);

alter table public.profiles enable row level security;

-- A user can only read their own profile row.
create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

-- A user can only update their own profile row.
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

-- Allow insert only for the matching user (the trigger below fires as
-- security definer so it can bypass RLS, but this keeps manual inserts safe).
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
--    Any authenticated user can read — needed to look up and join a team.
-- ============================================================
create table public.teams (
  id           uuid default gen_random_uuid() primary key,
  team_number  text not null unique,  -- e.g. "16858A"
  team_name    text,
  created_at   timestamptz default now()
);

alter table public.teams enable row level security;

-- Any signed-in user can look up teams (to find their team and join it).
create policy "teams: authenticated users can read"
  on public.teams for select
  using (auth.uid() is not null);

-- Any signed-in user can create a team (someone has to create it first).
create policy "teams: authenticated users can insert"
  on public.teams for insert
  with check (auth.uid() is not null);


-- ============================================================
-- 3. TEAM_MEMBERSHIPS
--    Join table: which users belong to which team.
--    A user can belong to one or more teams (e.g. student on two event teams).
-- ============================================================
create table public.team_memberships (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  team_id    uuid references public.teams(id) on delete cascade not null,
  joined_at  timestamptz default now(),
  unique (user_id, team_id)  -- prevent duplicate memberships
);

alter table public.team_memberships enable row level security;

-- A user can only see their own membership rows.
-- They cannot enumerate who else is on a team (privacy).
create policy "team_memberships: read own"
  on public.team_memberships for select
  using (auth.uid() = user_id);

-- A user can join a team by inserting their own membership row.
create policy "team_memberships: insert own"
  on public.team_memberships for insert
  with check (auth.uid() = user_id);

-- A user can leave a team by deleting their own membership row.
create policy "team_memberships: delete own"
  on public.team_memberships for delete
  using (auth.uid() = user_id);

-- Indexes for fast membership lookups (used heavily in scouting RLS checks).
create index team_memberships_user_id_idx on public.team_memberships(user_id);
create index team_memberships_team_id_idx on public.team_memberships(team_id);


-- ============================================================
-- 4. SCOUTING_ENTRIES
--    The core table. Each row is one robot scouted by one team.
--
--    team_id      = the Veralis team that OWNS this entry (the scouter's team)
--    scouted_team_number = the robot being observed (e.g. "9181A")
--
--    CRITICAL RLS: a user may only read/write entries that belong to
--    a team they are a member of. Cross-team scouting data is invisible.
-- ============================================================
create table public.scouting_entries (
  id                   uuid default gen_random_uuid() primary key,
  team_id              uuid references public.teams(id) on delete cascade not null,
  scouted_team_number  text not null,
  drivetrain           text check (drivetrain in ('tank', 'mecanum', 'xdrive', 'other')),
  intake               text check (intake in ('strong', 'okay', 'weak', 'none')),
  scoring              text check (scoring in ('fast', 'average', 'slow', 'cant_tell')),
  autonomous           text check (autonomous in ('strong', 'works', 'weak_none', 'didnt_see')),
  reliability          int  check (reliability between 1 and 5),
  note                 text,
  photo_url            text,
  created_by           uuid references auth.users(id) not null,
  created_at           timestamptz default now()
);

alter table public.scouting_entries enable row level security;

-- SELECT: a user may read an entry only if they belong to the team that owns it.
-- This is the moat — other teams' scouting data is completely invisible.
create policy "scouting_entries: team members can read"
  on public.scouting_entries for select
  using (
    exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  );

-- INSERT: a user may create an entry only if they are a member of the owning
-- team AND they are recording themselves as the creator.
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

-- UPDATE: any member of the owning team may update an entry.
-- Last-write-wins is acceptable for v1 (per PRD).
create policy "scouting_entries: team members can update"
  on public.scouting_entries for update
  using (
    exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  );

-- Indexes for fast team-scoped queries.
create index scouting_entries_team_id_idx     on public.scouting_entries(team_id);
create index scouting_entries_created_by_idx  on public.scouting_entries(created_by);
create index scouting_entries_created_at_idx  on public.scouting_entries(created_at desc);
