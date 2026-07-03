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

  const body = await req.json()
  const { team_id, target_user_id, action } = body

  if (!team_id || !target_user_id || !action) {
    return json({ error: 'team_id, target_user_id, and action are required' }, 400)
  }
  if (!['promote', 'remove'].includes(action)) {
    return json({ error: 'action must be "promote" or "remove"' }, 400)
  }

  // Verify caller is an admin of this team
  const { data: callerMembership } = await admin
    .from('team_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('team_id', team_id)
    .maybeSingle()

  if (!callerMembership) return json({ error: 'You are not a member of this team.' }, 403)
  if (callerMembership.role !== 'admin') return json({ error: 'Only admins can manage members.' }, 403)

  // Get target membership
  const { data: targetMembership } = await admin
    .from('team_memberships')
    .select('role')
    .eq('user_id', target_user_id)
    .eq('team_id', team_id)
    .maybeSingle()

  if (!targetMembership) return json({ error: 'User is not a member of this team.' }, 404)

  if (action === 'promote') {
    if (targetMembership.role === 'admin') {
      return json({ error: 'User is already an admin.' }, 400)
    }
    const { error } = await admin
      .from('team_memberships')
      .update({ role: 'admin' })
      .eq('user_id', target_user_id)
      .eq('team_id', team_id)
    if (error) return json({ error: error.message }, 500)
    return json({ success: true })
  }

  // action === 'remove'
  if (targetMembership.role === 'admin') {
    // Block removing the last admin — the team would be unmanageable
    const { count } = await admin
      .from('team_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team_id)
      .eq('role', 'admin')

    if ((count ?? 0) <= 1) {
      return json({
        error: "Can't remove the last admin. Promote another member to admin first.",
      }, 400)
    }
  }

  const { error } = await admin
    .from('team_memberships')
    .delete()
    .eq('user_id', target_user_id)
    .eq('team_id', team_id)

  if (error) return json({ error: error.message }, 500)
  return json({ success: true })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
