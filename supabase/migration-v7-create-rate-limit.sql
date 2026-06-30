-- ============================================================
-- Veralis — Migration v7: Rate-limit team creation
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Track when each user last attempted to create a team.
-- The create-team Edge Function enforces a minimum gap between attempts.
alter table public.profiles
  add column if not exists last_create_attempt timestamptz;
