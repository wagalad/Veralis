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

  if (await mfaBlocked(admin, jwt, user.id)) {
    return json({ error: 'Two-factor verification is required for this action.' }, 403)
  }

  // Rate limit: enforce a minimum 10-second gap between create attempts per user.
  // Atomic conditional UPDATE — only succeeds if the cooldown has expired or was never set.
  const COOLDOWN_MS = 10_000
  const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString()
  const { data: allowed, error: cooldownErr } = await admin
    .from('profiles')
    .update({ last_create_attempt: new Date().toISOString() })
    .eq('id', user.id)
    .or(`last_create_attempt.is.null,last_create_attempt.lt.${cutoff}`)
    .select('id')
    .maybeSingle()

  if (cooldownErr) return json({ error: cooldownErr.message }, 500)
  if (!allowed) return json({ error: 'Too many attempts. Please wait 10 seconds before trying again.' }, 429)

  const { team_number, team_name } = await req.json()
  if (!team_number?.trim()) return json({ error: 'team_number is required' }, 400)

  const normalized = team_number.trim().toUpperCase()
  if (normalized.length > 12) return json({ error: 'team_number must be 12 characters or fewer.' }, 400)
  const trimmedName = team_name?.trim() || null
  if (trimmedName && trimmedName.length > 100) return json({ error: 'team_name must be 100 characters or fewer.' }, 400)

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
    .insert({ team_number: normalized, team_name: trimmedName, invite_code })
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
