import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  // Rate limit: enforce a minimum 10-second gap between join attempts per user.
  // This makes brute-forcing the ~852 billion code space impractical.
  const COOLDOWN_MS = 10_000
  const { data: profile } = await admin
    .from('profiles')
    .select('last_join_attempt')
    .eq('id', user.id)
    .maybeSingle()

  const lastAttempt = profile?.last_join_attempt ? new Date(profile.last_join_attempt).getTime() : 0
  const elapsed = Date.now() - lastAttempt
  if (elapsed < COOLDOWN_MS) {
    const retryAfter = Math.ceil((COOLDOWN_MS - elapsed) / 1000)
    return json({ error: `Too many attempts. Please wait ${retryAfter} second${retryAfter === 1 ? '' : 's'} before trying again.` }, 429)
  }

  // Record this attempt before doing anything else — applies on both success and failure.
  await admin
    .from('profiles')
    .update({ last_join_attempt: new Date().toISOString() })
    .eq('id', user.id)

  const { invite_code } = await req.json()
  if (!invite_code?.trim()) return json({ error: 'invite_code is required' }, 400)

  // Look up team by invite code (service role sees all teams)
  const { data: team } = await admin
    .from('teams')
    .select('id, team_number, team_name, invite_code')
    .eq('invite_code', invite_code.trim().toUpperCase())
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
