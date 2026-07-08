-- migration-v15: platform_admins (operator super-admin allowlist)
--
-- Adds an app-operator allowlist for the global admin view (see the admin-panel
-- Edge Function). A user_id present in this table is a platform operator and may
-- read cross-team aggregate data (all teams, all users, usage stats) through the
-- service-role admin-panel function only.
--
-- This does NOT change any existing RLS: normal per-team scouting isolation is
-- untouched. All operator reads happen inside the service-role Edge Function,
-- which first verifies (a) the caller's session is AAL2 (2FA) and (b) the caller
-- is in this table. Clients can never read/write this table directly.
--
-- Seed AFTER applying: insert the operator's auth.users.id, e.g.
--   insert into public.platform_admins (user_id) values ('<uuid>');
--
-- Applied live to the DB via the Management API on 2026-07-08.

create table public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
-- No policies: only the service role (Edge Function) may read/write.

-- Authoritative 2FA status for the operator overview. auth.mfa_factors is not
-- exposed to PostgREST and admin.listUsers() does not reliably include each
-- user's factors, so the admin-panel function reads verified-factor user_ids
-- through this SECURITY DEFINER helper. Restricted to the service role.
create or replace function public.verified_factor_user_ids()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(distinct user_id), '[]'::jsonb)
  from auth.mfa_factors
  where status = 'verified';
$$;

revoke execute on function public.verified_factor_user_ids() from public, anon, authenticated;
grant execute on function public.verified_factor_user_ids() to service_role;

notify pgrst, 'reload schema';
