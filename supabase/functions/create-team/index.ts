import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Unambiguous chars only (no 0/O, 1/I/L)
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Verify caller is authenticated
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!jwt) return json({ error: 'Unauthorized' }, 401)

  // Service role client — bypasses RLS for all writes
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Validate the caller's JWT to get their user ID
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt)
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  const { team_number, team_name } = await req.json()
  if (!team_number?.trim()) return json({ error: 'team_number is required' }, 400)

  const normalized = team_number.trim().toUpperCase()

  // Reject if team already exists
  const { data: existing } = await admin
    .from('teams')
    .select('id')
    .eq('team_number', normalized)
    .maybeSingle()

  if (existing) {
    return json({
      error: `Team ${normalized} already has a scouting pool in Veralis.`,
      duplicate: true,
      team_number: normalized,
    }, 409)
  }

  // Create team with invite code
  const invite_code = generateInviteCode()
  const { data: team, error: teamErr } = await admin
    .from('teams')
    .insert({ team_number: normalized, team_name: team_name?.trim() || null, invite_code })
    .select()
    .single()

  if (teamErr) return json({ error: teamErr.message }, 500)

  // Make creator an admin member
  const { error: memberErr } = await admin
    .from('team_memberships')
    .insert({ user_id: user.id, team_id: team.id, role: 'admin' })

  if (memberErr) return json({ error: memberErr.message }, 500)

  return json({ team })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
