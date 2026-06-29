-- ============================================================
-- Veralis — Migration v2: Invite codes + role-based membership
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Add role to team_memberships
alter table public.team_memberships
  add column if not exists role text not null default 'member'
  check (role in ('admin', 'member'));

-- 2. Add invite_code to teams (short random code, NOT the VEX team number)
alter table public.teams
  add column if not exists invite_code text unique;

-- Fill existing rows with a random code before adding NOT NULL constraint
update public.teams
set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where invite_code is null;

alter table public.teams
  alter column invite_code set not null;

-- 3. Drop the old permissive policies that allowed direct client inserts.
--    All membership creation now goes through Edge Functions (service role).
drop policy if exists "team_memberships: insert own" on public.team_memberships;
drop policy if exists "teams: authenticated users can insert" on public.teams;

-- 4. Restrict teams reads: only members of a team can see that team's row
--    (this protects the invite_code — non-members can't query it at all).
drop policy if exists "teams: authenticated users can read" on public.teams;

create policy "teams: members can read own teams"
  on public.teams for select
  using (
    exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = teams.id
        and team_memberships.user_id = auth.uid()
    )
  );

-- 5. Existing admin rows: mark the earliest member of each team as admin
--    (best-effort for any rows created before this migration).
update public.team_memberships tm
set role = 'admin'
where tm.id = (
  select id from public.team_memberships
  where team_id = tm.team_id
  order by joined_at asc
  limit 1
);
