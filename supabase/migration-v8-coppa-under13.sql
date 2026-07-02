-- ============================================================
-- Veralis — Migration v8: COPPA support for under-13 users
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Model:
--   * Every user records a date of birth (neutral age screen).
--   * Users 13+ self-register and join teams normally (active immediately).
--   * Users under 13 self-register but ALL features are locked until an adult
--     team admin approves their join request. That approval is the COPPA
--     verifiable-consent event and is recorded in child_consents.
-- ============================================================


-- ── 1. Date of birth + optional guardian/coach email on profiles ────────────
alter table public.profiles
  add column if not exists date_of_birth date;

alter table public.profiles
  add column if not exists guardian_email text
    check (guardian_email is null or char_length(guardian_email) <= 254);


-- ── 2. Date of birth is immutable once set ──────────────────────────────────
--    Prevents a user from later editing their age to escape under-13 gating.
--    (null -> value is allowed; changing an existing value raises.)
create or replace function public.enforce_dob_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.date_of_birth is not null
     and new.date_of_birth is distinct from old.date_of_birth then
    raise exception 'date_of_birth cannot be changed once set';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_dob_immutable on public.profiles;
create trigger profiles_dob_immutable
  before update on public.profiles
  for each row execute function public.enforce_dob_immutable();


-- ── 3. Membership approval state ────────────────────────────────────────────
--    'active'  = full member (all 13+ joins, all creators, approved under-13s)
--    'pending' = under-13 awaiting adult approval; NO access to team data
alter table public.team_memberships
  add column if not exists status text not null default 'active'
    check (status in ('active', 'pending'));


-- ── 4. RLS: only ACTIVE memberships grant access to team data ────────────────
--    Critical: a pending under-13 member must not read or write ANY team data.
drop policy if exists "teams: members can read own teams" on public.teams;
create policy "teams: members can read own teams"
  on public.teams for select
  using (
    exists (
      select 1 from public.team_memberships
      where team_memberships.team_id = teams.id
        and team_memberships.user_id = auth.uid()
        and team_memberships.status = 'active'
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
        and team_memberships.status = 'active'
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
        and team_memberships.status = 'active'
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
        and team_memberships.status = 'active'
    )
  );


-- ── 5. Consent record (COPPA record-keeping) ────────────────────────────────
--    One row per (child, team): which adult consented and when.
--    All reads/writes go through Edge Functions (service role) — no client policies.
create table if not exists public.child_consents (
  id               uuid default gen_random_uuid() primary key,
  child_user_id    uuid references auth.users(id) on delete cascade not null,
  team_id          uuid references public.teams(id) on delete cascade not null,
  consented_by     uuid references auth.users(id) not null,
  consent_context  text not null default 'coach_approval',
  created_at       timestamptz default now(),
  unique (child_user_id, team_id)
);

alter table public.child_consents enable row level security;
-- No policies: only the service role (Edge Functions) may touch this table.
