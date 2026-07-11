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
  id                    uuid references auth.users(id) on delete cascade primary key,
  display_name          text check (display_name is null or char_length(display_name) <= 100),
  last_join_attempt     timestamptz,
  last_create_attempt   timestamptz,
  last_recovery_attempt timestamptz,
  updated_at            timestamptz default now()
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

-- MFA enforcement helper: true if the session satisfies the user's 2FA
-- requirement. Users with a verified TOTP factor must be at AAL2; users without
-- 2FA are always allowed (they can't reach AAL2). Used in the RLS policies below.
create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid()
        and f.status = 'verified'
    );
$$;

grant execute on function public.mfa_satisfied() to authenticated, anon;


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
    public.mfa_satisfied()
    and exists (
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
  unique (user_id, team_id),
  -- Second FK on user_id to public.profiles so PostgREST can embed
  -- profiles(display_name) in the get-team-members Edge Function. Without
  -- this, the embed fails with PGRST200 and the member list can't load.
  constraint team_memberships_user_id_profiles_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade
);

alter table public.team_memberships enable row level security;

-- A user can only see their own membership rows.
create policy "team_memberships: read own"
  on public.team_memberships for select
  using (public.mfa_satisfied() and auth.uid() = user_id);

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
  created_at           timestamptz default now(),
  edited_by            uuid references auth.users(id),
  edited_at            timestamptz
);

alter table public.scouting_entries enable row level security;

create policy "scouting_entries: team members can read"
  on public.scouting_entries for select
  using (
    public.mfa_satisfied()
    and exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  );

create policy "scouting_entries: team members can insert"
  on public.scouting_entries for insert
  with check (
    public.mfa_satisfied()
    and auth.uid() = created_by
    and exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  );

-- Any team member may edit their team's entries (collaborative pool). USING
-- restricts edits to entries whose team the caller belongs to, and the matching
-- WITH CHECK prevents moving a row into another team. Cross-team isolation and
-- the MFA gate are preserved. created_by is held immutable by a trigger (below)
-- so authorship can't be reassigned. See migration-v17 (author-only) then v18.
create policy "scouting_entries: team members can update"
  on public.scouting_entries for update
  using (
    public.mfa_satisfied()
    and exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  )
  with check (
    public.mfa_satisfied()
    and exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  );

-- On every edit: keep created_by immutable (authorship can't be reassigned when
-- a teammate edits someone else's report) and stamp who edited it and when.
-- edited_by/edited_at are set server-side here so a client can't forge them.
-- See migration-v18 (pin created_by) and migration-v19 (edit attribution).
create or replace function public.scouting_entries_touch_edit()
returns trigger
language plpgsql
as $$
begin
  new.created_by := old.created_by;  -- authorship is immutable
  new.edited_by  := auth.uid();      -- who edited (server-set, unspoofable)
  new.edited_at  := now();           -- when
  return new;
end;
$$;

drop trigger if exists scouting_entries_touch_edit on public.scouting_entries;
create trigger scouting_entries_touch_edit
  before update on public.scouting_entries
  for each row execute function public.scouting_entries_touch_edit();

create index scouting_entries_team_id_idx     on public.scouting_entries(team_id);
create index scouting_entries_created_by_idx  on public.scouting_entries(created_by);
create index scouting_entries_created_at_idx  on public.scouting_entries(created_at desc);


-- ============================================================
-- 5. MFA_RECOVERY_CODES
--    One-time backup codes for 2FA (stored only as SHA-256 hashes).
--    All access via the mfa-recovery Edge Function (service role) — no client policies.
-- ============================================================
create table public.mfa_recovery_codes (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  code_hash   text not null,
  used_at     timestamptz,
  created_at  timestamptz default now()
);

create index mfa_recovery_codes_user_idx on public.mfa_recovery_codes(user_id);

alter table public.mfa_recovery_codes enable row level security;
-- No policies: only the service role (Edge Function) may read/write.


-- ============================================================
-- 6. PLATFORM_ADMINS
--    App-operator (super-admin) allowlist for the global admin view.
--    A user_id here may read cross-team aggregate data via the service-role
--    admin-panel Edge Function only (which also requires an AAL2 / 2FA session).
--    Does not change per-team RLS. No client policies — service role only.
-- ============================================================
create table public.platform_admins (
  user_id     uuid references auth.users(id) on delete cascade primary key,
  created_at  timestamptz default now() not null
);

alter table public.platform_admins enable row level security;
-- No policies: only the service role (Edge Function) may read/write.

-- Authoritative 2FA status for the operator overview (auth.mfa_factors isn't
-- exposed to PostgREST). Service-role only.
create or replace function public.verified_factor_user_ids()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(distinct user_id), '[]'::jsonb)
  from auth.mfa_factors
  where status = 'verified';
$$;

revoke execute on function public.verified_factor_user_ids() from public, anon, authenticated;
grant execute on function public.verified_factor_user_ids() to service_role;
