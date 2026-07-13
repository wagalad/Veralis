-- ============================================================
-- Veralis — Migration v20: AI rules assistant (RAG knowledge base)
-- Run in: Supabase Dashboard → SQL Editor (or applied via Management API).
-- ============================================================
--
-- Backs the rules-assistant Edge Function. Stores OUR OWN paraphrased rules
-- knowledge base (not VEX's manual text) as embedded chunks, and provides a
-- pgvector similarity search + a per-user rate-limit quota. Everything here is
-- service-role only — clients reach it exclusively through the Edge Function.

-- pgvector for embedding similarity search.
create extension if not exists vector;

-- The knowledge base: one row per paraphrased rule entry. `content` is our own
-- plain-language text; `embedding` is its text-embedding-3-small vector (1536-d).
create table if not exists public.rules_chunks (
  id          uuid         primary key default gen_random_uuid(),
  section     text         not null,
  rule_no     text         not null,        -- our own topic slug (e.g. GOALS-PROTECTED)
  title       text         not null,
  content     text         not null,
  embedding   vector(1536) not null,
  token_count int          not null default 0,
  created_at  timestamptz  not null default now()
);

alter table public.rules_chunks enable row level security;
-- No policies on purpose: ONLY the rules-assistant Edge Function (service role)
-- reads this table. Clients get answers through the function response, never the
-- source chunks. RLS-on + no-policy = invisible to anon/authenticated.

-- Per-user rolling-window usage counter — a cost backstop on model calls.
create table if not exists public.assistant_rate_limits (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  count        int         not null default 0
);

alter table public.assistant_rate_limits enable row level security;
-- Service-role only, no client policies (same rationale as above).

-- Atomically increment (and window-reset) a user's assistant quota, returning
-- whether the request is still within the limit. Single-statement upsert avoids
-- the TOCTOU race of a separate SELECT + UPDATE. Mirrors consume_summary_quota.
create or replace function public.consume_assistant_quota(
  p_user_id uuid,
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
  insert into assistant_rate_limits (user_id, window_start, count)
  values (p_user_id, now(), 1)
  on conflict (user_id) do update
    set window_start = case when assistant_rate_limits.window_start < now() - p_window
                            then now() else assistant_rate_limits.window_start end,
        count        = case when assistant_rate_limits.window_start < now() - p_window
                            then 1 else assistant_rate_limits.count + 1 end
  returning count into new_count;
  return new_count <= p_limit;
end $$;

revoke all on function public.consume_assistant_quota(uuid, int, interval) from public, anon, authenticated;
grant execute on function public.consume_assistant_quota(uuid, int, interval) to service_role;

-- Top-k cosine similarity search over the knowledge base. Returns the closest
-- entries to a query embedding. (The KB is tiny, so a sequential scan is fine;
-- add an ivfflat/hnsw index later only if it ever grows large.)
create or replace function public.match_rules_chunks(
  query_embedding vector(1536),
  match_count     int
) returns table (
  rule_no    text,
  section    text,
  title      text,
  content    text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    rc.rule_no,
    rc.section,
    rc.title,
    rc.content,
    1 - (rc.embedding <=> query_embedding) as similarity
  from rules_chunks rc
  order by rc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

revoke all on function public.match_rules_chunks(vector, int) from public, anon, authenticated;
grant execute on function public.match_rules_chunks(vector, int) to service_role;
