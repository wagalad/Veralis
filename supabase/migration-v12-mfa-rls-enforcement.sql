-- ============================================================
-- Veralis — Migration v12: Enforce 2FA at the database (RLS) level
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Users who have a verified TOTP factor must be at assurance level AAL2 (i.e.
-- they've entered their 2FA code) to read/write team data — even via the API
-- directly. Users WITHOUT 2FA are unaffected (they can never reach AAL2).
-- This is Supabase's documented MFA-enforcement pattern.
-- ============================================================

-- Helper: true if the session satisfies the user's MFA requirement.
-- SECURITY DEFINER so it can read auth.mfa_factors (the authenticated role can't).
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


-- ── teams: read ─────────────────────────────────────────────────────────────
drop policy if exists "teams: members can read own teams" on public.teams;
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

-- ── team_memberships: read own ──────────────────────────────────────────────
drop policy if exists "team_memberships: read own" on public.team_memberships;
create policy "team_memberships: read own"
  on public.team_memberships for select
  using (public.mfa_satisfied() and auth.uid() = user_id);

-- ── scouting_entries: read / insert / update ────────────────────────────────
drop policy if exists "scouting_entries: team members can read" on public.scouting_entries;
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

drop policy if exists "scouting_entries: team members can insert" on public.scouting_entries;
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

drop policy if exists "scouting_entries: team members can update" on public.scouting_entries;
create policy "scouting_entries: team members can update"
  on public.scouting_entries for update
  using (
    public.mfa_satisfied()
    and exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  );
