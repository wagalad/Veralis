import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Unambiguous alphabet (no 0/O/1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_COUNT = 10

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  const c = Array.from(bytes, b => ALPHABET[b % ALPHABET.length])
  return `${c.slice(0, 5).join('')}-${c.slice(5).join('')}`
}

function normalize(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')
}

// Read the assurance level from the (already validated) access token.
function aalOf(jwt: string): string {
  try { return JSON.parse(atob(jwt.split('.')[1])).aal ?? '' } catch { return '' }
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

  const { action, code } = await req.json().catch(() => ({}))

  // ── Generate a fresh set of recovery codes (requires a fully verified 2FA
  //    session so that a password-only attacker can't mint backup codes). ──
  if (action === 'generate') {
    if (aalOf(jwt) !== 'aal2') {
      return json({ error: 'Complete two-factor verification before generating recovery codes.' }, 403)
    }
    await admin.from('mfa_recovery_codes').delete().eq('user_id', user.id)

    const codes = Array.from({ length: CODE_COUNT }, randomCode)
    const rows = await Promise.all(
      codes.map(async (c) => ({ user_id: user.id, code_hash: await sha256(normalize(c)) })),
    )
    const { error } = await admin.from('mfa_recovery_codes').insert(rows)
    if (error) return json({ error: error.message }, 500)

    // Plaintext returned exactly once — never stored or retrievable again.
    return json({ codes })
  }

  // ── Consume a recovery code: verify it, then remove the TOTP factor so the
  //    user (who has proven the password) can get back in and re-enroll. ──
  if (action === 'consume') {
    if (!code?.trim()) return json({ error: 'code is required' }, 400)

    // Atomic 5s cooldown between attempts (defense-in-depth on top of the
    // high entropy + single-use codes).
    const cutoff = new Date(Date.now() - 5_000).toISOString()
    const { data: allowed } = await admin
      .from('profiles')
      .update({ last_recovery_attempt: new Date().toISOString() })
      .eq('id', user.id)
      .or(`last_recovery_attempt.is.null,last_recovery_attempt.lt.${cutoff}`)
      .select('id')
      .maybeSingle()
    if (!allowed) return json({ error: 'Too many attempts. Please wait a few seconds and try again.' }, 429)

    const hash = await sha256(normalize(code))
    const { data: match } = await admin
      .from('mfa_recovery_codes')
      .select('id')
      .eq('user_id', user.id)
      .eq('code_hash', hash)
      .is('used_at', null)
      .maybeSingle()

    if (!match) return json({ error: 'Invalid or already-used recovery code.' }, 400)

    await admin.from('mfa_recovery_codes').update({ used_at: new Date().toISOString() }).eq('id', match.id)

    // Remove all of the user's TOTP factors → 2FA is now off for them.
    const { data: factorData } = await admin.auth.admin.mfa.listFactors({ userId: user.id })
    for (const f of factorData?.factors ?? []) {
      await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id })
    }
    // 2FA is off; remaining codes are moot — clear them.
    await admin.from('mfa_recovery_codes').delete().eq('user_id', user.id)

    return json({ success: true })
  }

  return json({ error: 'Unknown action.' }, 400)
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
