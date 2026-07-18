import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VEX_BASE = 'https://events.vex.com/api/v2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── In-memory cache — shared across requests within the same warm isolate ────
// Effective during active scouting sessions; cold starts get a clean slate.

interface CacheEntry { data: unknown; exp: number }
const cache = new Map<string, CacheEntry>()

function cacheGet<T>(key: string): T | null {
  const e = cache.get(key)
  return e && Date.now() < e.exp ? (e.data as T) : null
}

function cacheSet(key: string, data: unknown, ttlS: number) {
  // Prune expired entries when cache grows large
  if (cache.size > 500) {
    const now = Date.now()
    for (const [k, v] of cache) if (v.exp < now) cache.delete(k)
  }
  cache.set(key, { data, exp: Date.now() + ttlS * 1000 })
}

// ── VEX API helpers ───────────────────────────────────────────────────────────

interface VexResponse {
  data?: unknown[]
  meta?: { last_page?: number }
  [k: string]: unknown
}

async function vexGet(path: string, token: string): Promise<VexResponse> {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${VEX_BASE}${path}${sep}per_page=250`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`VEX API ${res.status}: ${body || res.statusText}`)
  }
  return res.json()
}

// Transparently handles pagination and caches the flattened result.
async function vexFetchAll(
  path: string,
  token: string,
  cacheKey: string,
  ttlS: number,
): Promise<unknown[]> {
  const hit = cacheGet<unknown[]>(cacheKey)
  if (hit) return hit

  const first = await vexGet(path, token)
  const items: unknown[] = Array.isArray(first.data) ? [...first.data]
    : Array.isArray(first) ? [...(first as unknown[])]
    : []

  const lastPage = first.meta?.last_page ?? 1
  if (lastPage > 1) {
    // Fetch remaining pages in parallel; cap at 4 extra pages (1250 items max)
    const extra = Array.from({ length: Math.min(lastPage - 1, 4) }, (_, i) => i + 2)
    const rest = await Promise.all(
      extra.map(p => vexGet(`${path}${path.includes('?') ? '&' : '?'}page=${p}`, token))
    )
    for (const r of rest) if (Array.isArray(r.data)) items.push(...r.data)
  }

  cacheSet(cacheKey, items, ttlS)
  return items
}

// RobotEvents program ids (stable) for our program labels. Season ids change
// every year, so they are resolved dynamically below rather than hardcoded.
const PROGRAM_IDS: Record<string, number> = { VRC: 1, VEXU: 4, IQ: 41 }

// Resolve the current + previous season ids for a program (cached ~1 day).
// Fetches the program's seasons, keeps those already started, newest first —
// [0] = current, [1] = previous. Either may be null if it can't be determined.
async function resolveSeasons(
  program: string,
  token: string,
): Promise<{ current: number | null; previous: number | null }> {
  const pid = PROGRAM_IDS[program] ?? PROGRAM_IDS.VRC
  const key = `seasons:${pid}`
  const hit = cacheGet<{ current: number | null; previous: number | null }>(key)
  if (hit) return hit
  try {
    const res = await vexGet(`/seasons?program%5B%5D=${pid}`, token)
    const seasons = (Array.isArray(res.data) ? res.data : []) as { id: number; start?: string }[]
    const now = Date.now()
    const started = seasons
      .filter(s => { const t = Date.parse(s.start ?? ''); return isNaN(t) || t <= now })
      .sort((a, b) => (Date.parse(b.start ?? '') || 0) - (Date.parse(a.start ?? '') || 0))
    const out = { current: started[0]?.id ?? null, previous: started[1]?.id ?? null }
    if (out.current != null) cacheSet(key, out, 86400)
    return out
  } catch { return { current: null, previous: null } }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Require an authenticated Veralis user — prevents token abuse
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!jwt) return json({ error: 'Unauthorized' }, 401)

  // Anon key is sufficient — this function only validates the caller's token and
  // proxies public VEX data; it never touches app tables, so no service role needed.
  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )
  const { data: { user }, error: authErr } = await supa.auth.getUser(jwt)
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  const token = Deno.env.get('VEX_API_TOKEN')
  if (!token) return json({ error: 'VEX API token not configured on server.' }, 503)

  let body: Record<string, string>
  try { body = await req.json() } catch { return json({ error: 'JSON body required.' }, 400) }

  const { action } = body
  if (!action) return json({ error: 'action is required.' }, 400)

  class InputError extends Error {}

  // Validates that a value is a safe positive integer before interpolating into a URL path.
  // Rejects anything with slashes, dots, or other characters that could manipulate the path.
  function requireNumericId(val: string | undefined, name: string): string {
    if (!val || !/^\d+$/.test(val)) throw new InputError(`Invalid ${name}: must be a numeric ID.`)
    return val
  }

  try {
    // ── Team search ────────────────────────────────────────────────────────
    // Resolves a human team number ("16858A") → VEX internal ID + full record.
    if (action === 'team') {
      const { teamNumber, program = 'VRC' } = body
      if (!teamNumber) return json({ error: 'teamNumber is required.' }, 400)
      const num = teamNumber.trim().toUpperCase()
      const key = `team:${program}:${num}`

      const cached = cacheGet<unknown>(key)
      if (cached) return json({ team: cached, cached: true })

      const result = await vexGet(
        `/teams?number=${encodeURIComponent(num)}`,
        token,
      )
      const teams = Array.isArray(result.data) ? result.data : []
      if (!teams.length) return json({ error: `Team ${num} not found in ${program}.` }, 404)

      const team = teams[0]
      cacheSet(key, team, 600) // 10 min — registration data is stable
      return json({ team })
    }

    // ── Event team roster ──────────────────────────────────────────────────
    if (action === 'event_teams') {
      const eventId = requireNumericId(body.eventId, 'eventId')
      const teams = await vexFetchAll(
        `/events/${eventId}/teams`,
        token,
        `event_teams:${eventId}`,
        180, // 3 min — roster is stable once the event starts
      )
      return json({ teams })
    }

    // ── Event rankings ─────────────────────────────────────────────────────
    // Pass division for multi-division events (e.g. Worlds has many divisions).
    if (action === 'event_rankings') {
      const eventId  = requireNumericId(body.eventId, 'eventId')
      const division = body.division ? requireNumericId(body.division, 'division') : null
      const path = division
        ? `/events/${eventId}/divisions/${division}/rankings`
        : `/events/${eventId}/rankings`
      const rankings = await vexFetchAll(
        path,
        token,
        `event_rankings:${eventId}:${division ?? 'all'}`,
        30, // 30 s — updates after every match
      )
      return json({ rankings })
    }

    // ── Event skills leaderboard ───────────────────────────────────────────
    if (action === 'event_skills') {
      const eventId = requireNumericId(body.eventId, 'eventId')
      const skills = await vexFetchAll(
        `/events/${eventId}/skills`,
        token,
        `event_skills:${eventId}`,
        30, // 30 s — updates after each skills run
      )
      return json({ skills })
    }

    // ── Search teams by number or name ────────────────────────────────────
    // Detects automatically: queries starting with a digit → number lookup,
    // otherwise → name search. Pass type='number'|'name' to force either.
    if (action === 'search_teams') {
      const { query, program = 'VRC', type } = body
      if (!query?.trim()) return json({ error: 'query is required.' }, 400)
      const q = query.trim()
      const cacheKey = `search:${program}:${q.toLowerCase()}`

      const cached = cacheGet<unknown[]>(cacheKey)
      if (cached) return json({ teams: cached })

      const byNumber = type === 'number' || (type !== 'name' && /^\d/.test(q))
      const param = byNumber
        ? `number=${encodeURIComponent(q.toUpperCase())}`
        : `name=${encodeURIComponent(q)}`

      // Filter to the selected program (VRC/VEXU/IQ). Without this, a partial
      // number like "10B" returns matching teams from every program at once,
      // so the program toggle appears to do nothing.
      const pid = PROGRAM_IDS[program] ?? PROGRAM_IDS.VRC
      const result = await vexGet(`/teams?${param}&program%5B%5D=${pid}`, token)
      const teams = Array.isArray(result.data) ? result.data.slice(0, 20) : []

      cacheSet(cacheKey, teams, 120) // 2 min — search results
      return json({ teams })
    }

    // ── Team stats (skills + awards) by VEX internal id ───────────────────
    if (action === 'team_stats') {
      const teamId   = requireNumericId(body.teamId, 'teamId')
      const cacheKey = `team_stats:${teamId}`

      const cached = cacheGet<unknown>(cacheKey)
      if (cached) return json({ stats: cached })

      // Fetch all three in parallel; each degrades gracefully if it fails
      const [skillsRes, awardsRes, rankingsRes] = await Promise.allSettled([
        vexGet(`/teams/${teamId}/skills`, token),
        vexGet(`/teams/${teamId}/awards`, token),
        vexFetchAll(`/teams/${teamId}/rankings`, token, `team_rankings_raw:${teamId}`, 60),
      ])

      const stats = {
        skills: skillsRes.status === 'fulfilled' && Array.isArray(skillsRes.value.data)
          ? skillsRes.value.data : [],
        awards: awardsRes.status === 'fulfilled' && Array.isArray(awardsRes.value.data)
          ? awardsRes.value.data : [],
        rankings: rankingsRes.status === 'fulfilled' ? rankingsRes.value : [],
      }

      cacheSet(cacheKey, stats, 60) // 60 s — rankings update live during events
      return json({ stats })
    }

    // ── Events a team is registered for ───────────────────────────────────
    // The VEX API has NO event name-search parameter, so Live Event Mode lists
    // the team's own events (that's where the team actually has matches anyway).
    // Returned most-recent-first; the client filters to upcoming/current.
    if (action === 'team_events') {
      const teamId = requireNumericId(body.teamId, 'teamId')
      const raw = await vexFetchAll(
        `/teams/${teamId}/events`,
        token,
        `team_events:${teamId}`,
        300, // 5 min — a team's registration list is stable
      ) as { start?: string }[]
      const events = [...raw].sort(
        (a, b) => String(b.start ?? '').localeCompare(String(a.start ?? '')),
      )
      return json({ events })
    }

    // ── Team match schedule at a specific event ────────────────────────────
    if (action === 'team_matches') {
      const teamId  = requireNumericId(body.teamId, 'teamId')
      const eventId = requireNumericId(body.eventId, 'eventId')

      const matches = await vexFetchAll(
        `/teams/${teamId}/matches?event_id=${eventId}`,
        token,
        `team_matches:${teamId}:${eventId}`,
        30,
      )
      return json({ matches })
    }

    // ── A team's matches for a season (current | previous) for the rating ─────
    if (action === 'team_season_matches') {
      const teamId = requireNumericId(body.teamId, 'teamId')
      const program = body.program || 'VRC'
      const which = body.which === 'previous' ? 'previous' : 'current'
      const seasons = await resolveSeasons(program, token)
      const seasonId = which === 'previous' ? seasons.previous : seasons.current

      if (seasonId != null) {
        const matches = await vexFetchAll(
          `/teams/${teamId}/matches?season%5B%5D=${seasonId}`,
          token,
          `team_season_matches:${teamId}:${seasonId}`,
          300, // 5 min
        )
        return json({ matches })
      }

      // No previous season (e.g. a first-year team) → empty.
      if (which === 'previous') return json({ matches: [] })

      // Current-season lookup failed — fall back to the team's last-year matches.
      const all = await vexFetchAll(
        `/teams/${teamId}/matches`,
        token,
        `team_all_matches:${teamId}`,
        300,
      ) as { scheduled?: string; started?: string }[]
      const cutoff = Date.now() - 365 * 86400000
      const matches = all.filter(m => {
        const t = new Date(m.scheduled ?? m.started ?? 0).getTime()
        return !t || t >= cutoff
      })
      return json({ matches })
    }

    return json({ error: `Unknown action "${action}".` }, 400)
  } catch (err: unknown) {
    // InputError messages are safe validation text; anything else may carry
    // upstream/internal detail, so log it server-side and return a generic message.
    if (err instanceof InputError) return json({ error: err.message }, 400)
    console.error('vex-api error:', err)
    return json({ error: 'Upstream data service error. Please try again.' }, 502)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
