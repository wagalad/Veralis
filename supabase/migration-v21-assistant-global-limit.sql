-- ============================================================
-- Veralis — Migration v21: global rate limit for the rules assistant
-- Run in: Supabase Dashboard → SQL Editor (or applied via Management API).
-- ============================================================
--
-- Adds a global circuit breaker on top of the existing per-user quota: it caps
-- the TOTAL number of model-generating requests across all users per window, so
-- no amount of accounts/bots can run up the OpenAI bill. Service-role only.

-- Single-row global counter (id is pinned to 1).
create table if not exists public.assistant_global_rate_limit (
  id           int         primary key default 1,
  window_start timestamptz not null default now(),
  count        int         not null default 0,
  constraint assistant_global_single_row check (id = 1)
);

alter table public.assistant_global_rate_limit enable row level security;
-- No policies: service-role (Edge Function) only.

-- Atomically increment (and window-reset) the global counter, returning whether
-- the request is still within the limit. Same TOCTOU-safe upsert as the per-user
-- and per-team quotas.
create or replace function public.consume_global_assistant_quota(
  p_limit  int,
  p_window interval
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into assistant_global_rate_limit (id, window_start, count)
  values (1, now(), 1)
  on conflict (id) do update
    set window_start = case when assistant_global_rate_limit.window_start < now() - p_window
                            then now() else assistant_global_rate_limit.window_start end,
        count        = case when assistant_global_rate_limit.window_start < now() - p_window
                            then 1 else assistant_global_rate_limit.count + 1 end
  returning count into new_count;
  return new_count <= p_limit;
end $$;

revoke all on function public.consume_global_assistant_quota(int, interval) from public, anon, authenticated;
grant execute on function public.consume_global_assistant_quota(int, interval) to service_role;
