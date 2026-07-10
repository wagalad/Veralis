-- Migration v17 — Author-only edits to scouting entries
--
-- Enables the "edit your own scouting report" feature and hardens the UPDATE
-- path at the same time. Tightens the UPDATE policy on scouting_entries so that:
--   * only the team member who CREATED an entry can edit it
--     (created_by = auth.uid()) — a teammate can no longer alter someone
--     else's report;
--   * edits can never reassign authorship or move an entry to another team.
--     The previous policy had a USING clause but NO WITH CHECK, so Postgres fell
--     back to the USING expression and never validated the NEW row's values —
--     meaning created_by / team_id on the updated row went unchecked. This adds
--     an explicit WITH CHECK mirroring the USING clause to close that gap.
--
-- Cross-team isolation and the MFA gate (mfa_satisfied()) are preserved exactly.
-- Idempotent / safe to re-run.
--
-- Migrations are NOT auto-applied. Run this once against the live database
-- (Supabase Dashboard -> SQL Editor) before shipping the edit UI.

drop policy if exists "scouting_entries: team members can update" on public.scouting_entries;
drop policy if exists "scouting_entries: authors can update own entries" on public.scouting_entries;

create policy "scouting_entries: authors can update own entries"
  on public.scouting_entries for update
  using (
    public.mfa_satisfied()
    and auth.uid() = created_by
    and exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  )
  with check (
    public.mfa_satisfied()
    and auth.uid() = created_by
    and exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  );
