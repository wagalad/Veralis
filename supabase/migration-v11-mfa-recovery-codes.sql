-- ============================================================
-- Veralis — Migration v11: 2FA recovery codes
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Backup codes for users who lose their authenticator. Codes are generated
-- server-side, shown to the user once, and stored ONLY as SHA-256 hashes.
-- Consuming a valid code removes the user's TOTP factor (recovery = disable 2FA,
-- then re-enroll). All access is via the mfa-recovery Edge Function (service
-- role) — the table has no client policies.
-- ============================================================

create table public.mfa_recovery_codes (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  code_hash   text not null,           -- SHA-256 hex of the normalized code
  used_at     timestamptz,             -- null = still usable (single-use)
  created_at  timestamptz default now()
);

create index mfa_recovery_codes_user_idx on public.mfa_recovery_codes(user_id);

alter table public.mfa_recovery_codes enable row level security;
-- No policies: only the service role (Edge Function) may read/write.

-- Anti-brute-force cooldown for recovery-code consumption attempts.
alter table public.profiles
  add column if not exists last_recovery_attempt timestamptz;
