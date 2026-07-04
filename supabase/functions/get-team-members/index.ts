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

  const { team_id } = await req.json()
  if (!team_id) return json({ error: 'team_id is required' }, 400)

  // Verify caller is a member of this team before returning any data
  const { data: callerMembership } = await admin
    .from('team_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('team_id', team_id)
    .maybeSingle()

  if (!callerMembership) return json({ error: 'You are not a member of this team.' }, 403)

  // Get all memberships with profile data; admins sort first alphabetically
  const { data: memberships, error: memberErr } = await admin
    .from('team_memberships')
    .select('user_id, role, profiles(display_name)')
    .eq('team_id', team_id)
    .order('role')

  if (memberErr) return json({ error: 'Something went wrong. Please try again.' }, 500)

  // Enrich each member with their email from auth.admin
  const members = await Promise.all(
    (memberships ?? []).map(async (m) => {
      const { data: { user: authUser } } = await admin.auth.admin.getUserById(m.user_id)
      return {
        user_id: m.user_id,
        role: m.role,
        email: authUser?.email ?? null,
        display_name: (m.profiles as { display_name: string | null } | null)?.display_name ?? null,
      }
    })
  )

  return json({ members })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
