-- Migration v16 — Eye-test scouting fields
--
-- Adds observational "how a robot PLAYS" fields to scouting_entries so scouts
-- capture judgments (threat, defense response, driver skill, stability, and an
-- actionable verdict) instead of only specs. All columns are NULLABLE — every
-- field is optional; a scout may not assess everything.
--
-- SECURITY: no change to the security model. RLS on scouting_entries is
-- row-level (scoped by team_id membership), so these new columns are covered by
-- the existing policies automatically. No policy changes are needed.
--
-- The note length cap stays at its existing 200-char server-side limit.
--
-- Migrations are NOT auto-applied. Run this once against the live database
-- (Supabase Dashboard -> SQL Editor) before testing the new form. This script
-- is idempotent and safe to re-run.

alter table public.scouting_entries
  add column if not exists threat_level  text,
  add column if not exists under_defense text,
  add column if not exists driver_skill  text,
  add column if not exists stability     text,
  add column if not exists how_to_play   text;

-- Value constraints, matching the existing enum-check style. NULL is allowed
-- because each field is optional. Drop-then-add keeps this re-runnable.
alter table public.scouting_entries drop constraint if exists scouting_entries_threat_level_check;
alter table public.scouting_entries add  constraint scouting_entries_threat_level_check
  check (threat_level is null or threat_level = any (array['low','medium','high','must_scout']));

alter table public.scouting_entries drop constraint if exists scouting_entries_under_defense_check;
alter table public.scouting_entries add  constraint scouting_entries_under_defense_check
  check (under_defense is null or under_defense = any (array['folds','handles','unstoppable','didnt_see']));

alter table public.scouting_entries drop constraint if exists scouting_entries_driver_skill_check;
alter table public.scouting_entries add  constraint scouting_entries_driver_skill_check
  check (driver_skill is null or driver_skill = any (array['struggles','decent','skilled','didnt_see']));

alter table public.scouting_entries drop constraint if exists scouting_entries_stability_check;
alter table public.scouting_entries add  constraint scouting_entries_stability_check
  check (stability is null or stability = any (array['tippy','solid','rock_solid']));

-- how_to_play is a free-text verdict (chip preset or a short custom phrase),
-- so it gets a length cap rather than an enum constraint.
alter table public.scouting_entries drop constraint if exists scouting_entries_how_to_play_max_length;
alter table public.scouting_entries add  constraint scouting_entries_how_to_play_max_length
  check (how_to_play is null or char_length(how_to_play) <= 80);
