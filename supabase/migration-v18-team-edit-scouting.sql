-- Migration v18 — Any team member may edit the team's scouting entries
--
-- Product change: scouting is collaborative, so any member of a team can now
-- edit any scouting entry belonging to that team, not just the original author.
-- This relaxes the v17 author-only UPDATE policy back to team-scoped, while
-- KEEPING the hardening v17 introduced:
--   * WITH CHECK still pins edits to the caller's own team, so an entry can
--     never be moved into another team; and
--   * a BEFORE UPDATE trigger keeps created_by immutable, so authorship
--     ("scouted by …") stays truthful even when a teammate edits the report.
--     (RLS WITH CHECK can't reference the pre-update row, hence the trigger.)
--
-- Cross-team isolation and the MFA gate (mfa_satisfied()) are preserved exactly.
-- Idempotent / safe to re-run.
--
-- Migrations are NOT auto-applied. Run this once against the live database
-- (Supabase Dashboard -> SQL Editor).

drop policy if exists "scouting_entries: authors can update own entries" on public.scouting_entries;
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
  )
  with check (
    public.mfa_satisfied()
    and exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = scouting_entries.team_id
        and team_memberships.user_id = auth.uid()
    )
  );

-- Keep created_by immutable across edits so authorship can't be reassigned.
create or replace function public.scouting_entries_pin_created_by()
returns trigger
language plpgsql
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

drop trigger if exists scouting_entries_pin_created_by on public.scouting_entries;
create trigger scouting_entries_pin_created_by
  before update on public.scouting_entries
  for each row execute function public.scouting_entries_pin_created_by();
