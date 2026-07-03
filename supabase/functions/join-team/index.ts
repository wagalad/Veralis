import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function aalOf(jwt: string): string {
  try { return JSON.parse(atob(jwt.split('.')[1])).aal ?? 'aal1' } catch { return 'aal1' }
}

// Blocks a request when the user has 2FA enabled but the session is only AAL1
// (password) — enforces 2FA on this action even against direct API calls.
async function mfaBlocked(admin: any, jwt: string, userId: string): Promise<boolean> {
  if (aalOf(jwt) === 'aal2') return false
  const { data } = await admin.auth.admin.mfa.listFactors({ userId })
  return (data?.factors ?? []).some((f: { status: string }) => f.status === 'verified')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!jwt) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt)
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  if (await mfaBlocked(admin, jwt, user.id)) {
    return json({ error: 'Two-factor verification is required for this action.' }, 403)
  }

  // Rate limit: enforce a minimum 10-second gap between join attempts per user.
  // Atomic conditional UPDATE — only succeeds if the cooldown has expired or was never set.
  // This eliminates the TOCTOU race of a separate SELECT + UPDATE.
  const COOLDOWN_MS = 10_000
  const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString()
  const { data: allowed, error: cooldownErr } = await admin
    .from('profiles')
    .update({ last_join_attempt: new Date().toISOString() })
    .eq('id', user.id)
    .or(`last_join_attempt.is.null,last_join_attempt.lt.${cutoff}`)
    .select('id')
    .maybeSingle()

  if (cooldownErr) return json({ error: cooldownErr.message }, 500)
  if (!allowed) return json({ error: 'Too many attempts. Please wait 10 seconds before trying again.' }, 429)

  const { invite_code } = await req.json()
  if (!invite_code?.trim()) return json({ error: 'invite_code is required' }, 400)
  const code = invite_code.trim().toUpperCase()
  if (code.length > 8) return json({ error: 'Invalid invite code.' }, 404)

  // Look up team by invite code (service role sees all teams)
  const { data: team } = await admin
    .from('teams')
    .select('id, team_number, team_name, invite_code')
    .eq('invite_code', code)
    .maybeSingle()

  // Return the same generic error whether the code doesn't exist or is wrong —
  // don't leak whether a code "almost" matched.
  if (!team) return json({ error: 'Invalid invite code.' }, 404)

  // Check for existing membership
  const { data: existing } = await admin
    .from('team_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('team_id', team.id)
    .maybeSingle()

  if (existing) return json({ error: "You're already on this team." }, 409)

  // Create membership as regular member
  const { error: memberErr } = await admin
    .from('team_memberships')
    .insert({ user_id: user.id, team_id: team.id, role: 'member' })

  if (memberErr) return json({ error: memberErr.message }, 500)

  // Return team info without the invite code (member doesn't need it yet)
  return json({ team: { id: team.id, team_number: team.team_number, team_name: team.team_name } })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
