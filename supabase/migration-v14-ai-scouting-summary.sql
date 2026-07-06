-- ============================================================
-- Veralis — Migration v14: AI scouting summary ("SparkNotes")
-- Run in: Supabase Dashboard → SQL Editor (or applied via Management API).
-- ============================================================
--
-- Adds server-side caching + rate limiting for the summarize-scouting Edge
-- Function. The AI-generated brief is cached per (team_id, scouted_team_number)
-- and only regenerated when the underlying scouting data actually changes
-- (detected via source_hash), so we never call the model on a plain page view.

-- Cached summaries. One row per (owning team, robot they scouted).
create table if not exists public.scouting_summaries (
  team_id             uuid        not null references public.teams(id) on delete cascade,
  scouted_team_number text        not null,
  summary             text        not null,
  source_hash         text        not null,   -- SHA-256 of the underlying scouting fields
  entry_count         int         not null,
  model               text        not null,   -- which model produced it (for cache-busting on swap)
  generated_at        timestamptz not null default now(),
  primary key (team_id, scouted_team_number)
);

alter table public.scouting_summaries enable row level security;
-- No policies on purpose: ONLY the summarize-scouting Edge Function (service
-- role) reads/writes this table. Clients receive summaries through the function
-- response — never by querying this table directly. RLS-on + no-policy = the
-- table is invisible to anon/authenticated, which is exactly what we want.

-- Per-team rolling-window usage counter — a cost backstop against runaway
-- generation. Only consumed on an actual AI call (cache hits + "not enough
-- data" responses do not count against the quota).
create table if not exists public.summary_rate_limits (
  team_id      uuid        primary key references public.teams(id) on delete cascade,
  window_start timestamptz not null default now(),
  count        int         not null default 0
);

alter table public.summary_rate_limits enable row level security;
-- Same as above: service-role only, no client policies.

-- Atomically increment (and window-reset) a team's summary quota, returning
-- whether the request is still within the limit. Single-statement upsert avoids
-- the TOCTOU race of a separate SELECT + UPDATE.
create or replace function public.consume_summary_quota(
  p_team_id uuid,
  p_limit   int,
  p_window  interval
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into summary_rate_limits (team_id, window_start, count)
  values (p_team_id, now(), 1)
  on conflict (team_id) do update
    set window_start = case when summary_rate_limits.window_start < now() - p_window
                            then now() else summary_rate_limits.window_start end,
        count        = case when summary_rate_limits.window_start < now() - p_window
                            then 1 else summary_rate_limits.count + 1 end
  returning count into new_count;
  return new_count <= p_limit;
end $$;

-- Least privilege: only the Edge Function's service role may call it, so a
-- client can't burn another team's quota by invoking the RPC directly.
-- Supabase grants EXECUTE to anon/authenticated explicitly (not via PUBLIC), so
-- revoke from all three to leave only the service role able to call it.
revoke all on function public.consume_summary_quota(uuid, int, interval) from public, anon, authenticated;
grant execute on function public.consume_summary_quota(uuid, int, interval) to service_role;
