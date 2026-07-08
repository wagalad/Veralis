import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Authenticator Assurance Level from the JWT. 'aal2' means the user completed a
// 2FA challenge this session.
function aalOf(jwt: string): string {
  try { return JSON.parse(atob(jwt.split('.')[1])).aal ?? 'aal1' } catch { return 'aal1' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!jwt) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── Gate 1: valid session ──────────────────────────────────────────────────
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt)
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  // ── Gate 2: operator identity (must be in platform_admins) ─────────────────
  // Checked before the AAL2 gate so a non-operator learns nothing about the
  // 2FA requirement — everyone who isn't an operator gets the same 403.
  const { data: adminRow } = await admin
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!adminRow) return json({ error: 'Not found.' }, 403)

  // ── Gate 3: 2FA hard-required (AAL2 this session) ──────────────────────────
  // Stricter than the rest of the app: operator access always requires a fresh
  // 2FA challenge, so a stolen password alone can never reach cross-team data.
  if (aalOf(jwt) !== 'aal2') {
    return json({ error: 'Two-factor verification is required for operator access.' }, 403)
  }

  let body: { action?: string; team_id?: string }
  try { body = await req.json() } catch { return json({ error: 'Invalid request.' }, 400) }
  const action = body.action

  try {
    switch (action) {
      case 'overview':     return json(await overview(admin))
      case 'list_teams':   return json(await listTeams(admin))
      case 'team_detail':  return json(await teamDetail(admin, body.team_id))
      case 'list_users':   return json(await listUsers(admin))
      default:             return json({ error: 'Unknown action.' }, 400)
    }
  } catch (_e) {
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})

// ── Actions ──────────────────────────────────────────────────────────────────

// Cheap exact-count of a table, optionally within the last N days on created_at.
async function count(admin: any, table: string, sinceDays?: number): Promise<number> {
  let q = admin.from(table).select('*', { count: 'exact', head: true })
  if (sinceDays != null) {
    const since = new Date(Date.now() - sinceDays * 86400_000).toISOString()
    q = q.gte('created_at', since)
  }
  const { count: n } = await q
  return n ?? 0
}

// Authoritative list of user_ids with a verified 2FA factor. Reads
// auth.mfa_factors via a service-role-only SECURITY DEFINER function, because
// admin.listUsers() does not reliably populate each user's `factors`.
async function verifiedFactorIds(admin: any): Promise<Set<string>> {
  const { data } = await admin.rpc('verified_factor_user_ids')
  return new Set<string>(Array.isArray(data) ? data : [])
}

async function overview(admin: any) {
  const [teams, users, entries, entries7d, twoFa] = await Promise.all([
    count(admin, 'teams'),
    count(admin, 'profiles'),
    count(admin, 'scouting_entries'),
    count(admin, 'scouting_entries', 7),
    verifiedFactorIds(admin),
  ])

  // AI-summary usage in the current rolling window (sum of per-team counters).
  const { data: rl } = await admin.from('summary_rate_limits').select('count')
  const aiSummariesUsed = (rl ?? []).reduce((s: number, r: { count: number }) => s + (r.count ?? 0), 0)

  return {
    teams,
    users,
    entries,
    entries_last_7d: entries7d,
    users_with_2fa: twoFa.size,
    ai_summaries_in_window: aiSummariesUsed,
  }
}

async function listTeams(admin: any) {
  const { data: teams } = await admin
    .from('teams')
    .select('id, team_number, team_name, created_at')
    .order('created_at', { ascending: false })

  // Member + entry counts per team. Team counts are small; do them in parallel.
  const enriched = await Promise.all((teams ?? []).map(async (t: any) => {
    const [{ count: members }, { count: entries }] = await Promise.all([
      admin.from('team_memberships').select('*', { count: 'exact', head: true }).eq('team_id', t.id),
      admin.from('scouting_entries').select('*', { count: 'exact', head: true }).eq('team_id', t.id),
    ])
    return { ...t, member_count: members ?? 0, entry_count: entries ?? 0 }
  }))

  return { teams: enriched }
}

async function teamDetail(admin: any, teamId?: string) {
  if (!teamId) return { error: 'team_id is required' }

  const { data: team } = await admin
    .from('teams')
    .select('id, team_number, team_name, created_at, invite_code')
    .eq('id', teamId)
    .maybeSingle()

  const { data: memberships } = await admin
    .from('team_memberships')
    .select('user_id, role, joined_at')
    .eq('team_id', teamId)
    .order('role')

  const userIds = (memberships ?? []).map((m: any) => m.user_id)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds)
  const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]))

  const members = await Promise.all((memberships ?? []).map(async (m: any) => {
    const { data } = await admin.auth.admin.getUserById(m.user_id)
    return {
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      display_name: nameById.get(m.user_id) ?? null,
      email: data?.user?.email ?? null,
    }
  }))

  const { data: entries } = await admin
    .from('scouting_entries')
    .select('id, scouted_team_number, reliability, note, created_at, created_by')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(25)

  return { team, members, recent_entries: entries ?? [] }
}

async function listUsers(admin: any) {
  // Auth users (source of truth for email, created_at, 2FA). Paginate.
  const authUsers: any[] = []
  let page = 1
  for (;;) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    const list = data?.users ?? []
    authUsers.push(...list)
    if (list.length < 1000) break
    page++
  }

  const ids = authUsers.map((u) => u.id)

  // Display names.
  const { data: profiles } = await admin.from('profiles').select('id, display_name').in('id', ids)
  const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]))

  // Authoritative 2FA status (see verifiedFactorIds).
  const twoFa = await verifiedFactorIds(admin)

  // Team memberships → which teams each user belongs to.
  const { data: memberships } = await admin
    .from('team_memberships')
    .select('user_id, role, team_id, teams(team_number)')
  const teamsByUser = new Map<string, { team_number: string; role: string }[]>()
  for (const m of memberships ?? []) {
    const arr = teamsByUser.get(m.user_id) ?? []
    arr.push({ team_number: m.teams?.team_number ?? '?', role: m.role })
    teamsByUser.set(m.user_id, arr)
  }

  const users = authUsers.map((u) => ({
    user_id: u.id,
    email: u.email ?? null,
    display_name: nameById.get(u.id) ?? null,
    created_at: u.created_at ?? null,
    has_2fa: twoFa.has(u.id),
    teams: teamsByUser.get(u.id) ?? [],
  }))

  // Newest first.
  users.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  return { users }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
