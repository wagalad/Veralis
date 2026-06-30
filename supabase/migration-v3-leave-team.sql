-- ============================================================
-- Veralis — Migration v3: Remove client-side team leave
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Drop the policy that let clients delete their own membership row directly.
-- Leaving a team is now handled exclusively by the leave-team Edge Function,
-- which auto-promotes the next member before removing the departing admin.
drop policy if exists "team_memberships: delete own" on public.team_memberships;
