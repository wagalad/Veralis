-- ============================================================
-- Veralis — Migration v9: Revert the COPPA coach-enrollment flow (→ Path A)
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- We switched from "serve under-13 with coach consent" (v8) to "block under-13
-- signups" (Path A). This removes the coach/consent machinery from v8.
-- KEPT: profiles.date_of_birth + its immutability trigger — the neutral age
-- screen still uses date of birth to block under-13 users.
-- REMOVED: guardian_email, team_memberships.status (+ its RLS filters),
-- and the child_consents table.
-- ============================================================


-- ── 1. Revert RLS policies to not require membership status ──────────────────
drop policy if exists "teams: members can read own teams" on public.teams;
create policy "teams: members can read own teams"
  on public.teams for select
  using (
    exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = teams.id
        and team_memberships.user_id = auth.uid()
    )
  );

drop policy if exists "scouting_entries: team members can read" on public.scouting_entries;
create policy "scouting_entries: team members can read"
  on public.scouting_entries for select
  using (
    exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  );

drop policy if exists "scouting_entries: team members can insert" on public.scouting_entries;
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

drop policy if exists "scouting_entries: team members can update" on public.scouting_entries;
create policy "scouting_entries: team members can update"
  on public.scouting_entries for update
  using (
    exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  );


-- ── 2. Drop the coach/consent schema additions ──────────────────────────────
drop table if exists public.child_consents;
alter table public.team_memberships drop column if exists status;
alter table public.profiles drop column if exists guardian_email;
