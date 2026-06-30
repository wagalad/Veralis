-- ============================================================
-- Veralis — Migration v6: Remaining scouting_entries constraints
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- scouted_team_number was previously unconstrained.
-- Matches the maxLength={12} now enforced on the Scout.jsx team-edit input.
alter table public.scouting_entries
  add constraint scouted_team_number_max_length
    check (char_length(scouted_team_number) <= 12);

-- photo_url comes from Supabase Storage in the normal flow,
-- but the offline sync path reads entries from localStorage before inserting.
-- Cap at 500 chars to prevent a tampered entry from inserting an oversized value.
alter table public.scouting_entries
  add constraint photo_url_max_length
    check (photo_url is null or char_length(photo_url) <= 500);
