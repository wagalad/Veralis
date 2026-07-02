-- ============================================================
-- Veralis — Migration v10: Drop the date-of-birth age gate (Path A finalized)
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Path A relies on the Terms ("must be 13+") and a privacy-policy "Children"
-- clause rather than an active age screen, so date_of_birth is no longer used.
-- After this, the schema matches the original pre-COPPA state.
-- ============================================================

drop trigger if exists profiles_dob_immutable on public.profiles;
drop function if exists public.enforce_dob_immutable();
alter table public.profiles drop column if exists date_of_birth;
