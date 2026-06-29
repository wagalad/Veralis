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

  if (memberErr) return json({ error: memberErr.message }, 500)

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
