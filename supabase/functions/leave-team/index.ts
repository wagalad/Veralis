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

  // Verify caller is actually a member of this team
  const { data: callerMembership } = await admin
    .from('team_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('team_id', team_id)
    .maybeSingle()

  if (!callerMembership) return json({ error: 'You are not a member of this team.' }, 403)

  let promoted = false

  if (callerMembership.role === 'admin') {
    // Check whether any OTHER admin exists after this person leaves
    const { count: otherAdminCount } = await admin
      .from('team_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team_id)
      .eq('role', 'admin')
      .neq('user_id', user.id)

    if ((otherAdminCount ?? 0) === 0) {
      // No other admins — promote the longest-standing member (earliest joined_at)
      const { data: nextMember } = await admin
        .from('team_memberships')
        .select('user_id')
        .eq('team_id', team_id)
        .eq('role', 'member')
        .neq('user_id', user.id)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (nextMember) {
        const { error: promoteErr } = await admin
          .from('team_memberships')
          .update({ role: 'admin' })
          .eq('user_id', nextMember.user_id)
          .eq('team_id', team_id)

        if (promoteErr) return json({ error: promoteErr.message }, 500)
        promoted = true
      }
      // If no other members at all, leave proceeds normally (team becomes empty)
    }
  }

  // Remove the caller's membership
  const { error: deleteErr } = await admin
    .from('team_memberships')
    .delete()
    .eq('user_id', user.id)
    .eq('team_id', team_id)

  if (deleteErr) return json({ error: deleteErr.message }, 500)

  return json({ success: true, promoted })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
