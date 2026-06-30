-- ============================================================
-- Veralis — Migration v5: Length constraints on text fields
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Prevent unbounded payloads in user-supplied text fields.
-- These match the maxLength attributes enforced in the frontend UI.

alter table public.scouting_entries
  add constraint note_max_length
    check (note is null or char_length(note) <= 200);

alter table public.teams
  add constraint team_name_max_length
    check (team_name is null or char_length(team_name) <= 100);

alter table public.teams
  add constraint team_number_max_length
    check (char_length(team_number) <= 12);

alter table public.profiles
  add constraint display_name_max_length
    check (display_name is null or char_length(display_name) <= 100);
