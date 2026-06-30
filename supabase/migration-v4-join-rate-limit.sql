-- ============================================================
-- Veralis — Migration v4: Rate-limit invite code guessing
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Track when each user last attempted to join a team.
-- The join-team Edge Function enforces a minimum gap between attempts.
alter table public.profiles
  add column if not exists last_join_attempt timestamptz;
