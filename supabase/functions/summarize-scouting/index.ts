import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Tunables ──────────────────────────────────────────────────────────────────
// Below MIN_ENTRIES we never call the model — the raw reports are already shown
// on the card and one data point isn't a trend. Rate limit is a per-team cost
// backstop; only actual AI generations count against it (cache hits + the
// "not enough" short-circuit are free). Adjust freely — all in one place.
const MIN_ENTRIES = 2
const RATE_LIMIT = 100          // AI generations …
const RATE_WINDOW = '24 hours'  // … per team per this window

// ── Model — swap here (one line) to change providers/models ───────────────────
const MODEL = 'gemini-2.5-flash-lite'

const SYSTEM_PROMPT = `You are a VEX Robotics scouting assistant. You are given scouting reports that ONE team recorded about ANOTHER team's competition robot. Write a very short, plain-English brief of what these reports say about that robot.

Strict rules:
- Use ONLY the information in the reports below. Do NOT invent, infer, speculate, embellish, or add anything not explicitly stated.
- Base it on the actual attributes present: drivetrain, intake, scoring speed, autonomous, reliability, and written notes.
- If several reports exist, aggregate them. If they disagree on something, say it is inconsistent (e.g. "inconsistent autonomous") rather than picking one.
- Do NOT mention match records, rankings, awards, or skills scores — they are not in the reports.
- If the reports contain too little information to say anything meaningful, respond with exactly: "Not enough scouting on this team yet."
- Output 1-2 sentences, roughly 35 words max. Plain text only: no preamble, no markdown, no bullet points, no surrounding quotes.`

// Human-readable labels for the coded scouting fields (mirrors the frontend).
const DRIVETRAIN: Record<string, string> = { tank: 'Tank', mecanum: 'Mecanum', xdrive: 'X-drive', other: 'Other/unsure' }
const INTAKE: Record<string, string> = { strong: 'Strong', okay: 'Okay', weak: 'Weak', none: 'None/unsure' }
const SCORING: Record<string, string> = { fast: 'Fast', average: 'Average', slow: 'Slow', cant_tell: "Couldn't tell" }
const AUTO: Record<string, string> = { strong: 'Strong', works: 'Works', weak_none: 'Weak/none', didnt_see: "Didn't see" }

function aalOf(jwt: string): string {
  try { return JSON.parse(atob(jwt.split('.')[1])).aal ?? 'aal1' } catch { return 'aal1' }
}

// Blocks a request when the user has 2FA enabled but the session is only AAL1.
async function mfaBlocked(admin: any, jwt: string, userId: string): Promise<boolean> {
  if (aalOf(jwt) === 'aal2') return false
  const { data } = await admin.auth.admin.mfa.listFactors({ userId })
  return (data?.factors ?? []).some((f: { status: string }) => f.status === 'verified')
}

interface Entry {
  id: string
  drivetrain: string | null
  intake: string | null
  scoring: string | null
  autonomous: string | null
  reliability: number | null
  note: string | null
  created_at: string
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// A stable fingerprint of the scouting content. Changes iff a report is added,
// edited, or removed — which is exactly when the summary should be regenerated.
async function hashEntries(entries: Entry[]): Promise<string> {
  const canonical = [...entries]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e) => [e.id, e.drivetrain, e.intake, e.scoring, e.autonomous, e.reliability, e.note])
  return sha256(JSON.stringify(canonical))
}

// Render the reports as labeled plain text for the model.
function renderReports(entries: Entry[], robot: string): string {
  const lines = entries.map((e, i) => {
    const parts = [
      DRIVETRAIN[e.drivetrain ?? ''] && `drivetrain: ${DRIVETRAIN[e.drivetrain!]}`,
      INTAKE[e.intake ?? ''] && `intake: ${INTAKE[e.intake!]}`,
      SCORING[e.scoring ?? ''] && `scoring: ${SCORING[e.scoring!]}`,
      AUTO[e.autonomous ?? ''] && `autonomous: ${AUTO[e.autonomous!]}`,
      e.reliability ? `reliability: ${e.reliability}/5` : null,
      e.note ? `note: "${e.note}"` : null,
    ].filter(Boolean)
    return `Report ${i + 1}: ${parts.length ? parts.join(', ') : '(no details recorded)'}`
  })
  return `Scouting reports on robot ${robot} (${entries.length} total):\n${lines.join('\n')}`
}

// The ONLY place the model is called. Returns the summary text, or throws.
async function generateSummary(reportsText: string): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('not-configured')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: reportsText }] }],
        // Low temperature keeps it factual and close to the data.
        generationConfig: { temperature: 0.2, topP: 0.9, maxOutputTokens: 200 },
      }),
    },
  )

  if (!res.ok) {
    console.error('gemini error', res.status, await res.text().catch(() => ''))
    throw new Error('model-failed')
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!text) {
    console.error('gemini empty response', JSON.stringify(data).slice(0, 500))
    throw new Error('model-empty')
  }
  return text
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

  let body: { team_id?: string; scouted_team_number?: string }
  try { body = await req.json() } catch { return json({ error: 'JSON body required.' }, 400) }

  const teamId = body.team_id
  const robot = body.scouted_team_number?.trim().toUpperCase()
  if (!teamId || !robot) return json({ error: 'team_id and scouted_team_number are required.' }, 400)

  // Team-scoping: never trust the client-supplied team_id. Confirm the caller is
  // actually a member of it before touching that team's scouting pool.
  const { data: membership } = await admin
    .from('team_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('team_id', teamId)
    .maybeSingle()

  if (!membership) return json({ error: 'You are not a member of this team.' }, 403)

  // Read ONLY this team's reports on this robot. Cap the count fed to the model.
  const { data: entries, error: entriesErr } = await admin
    .from('scouting_entries')
    .select('id, drivetrain, intake, scoring, autonomous, reliability, note, created_at')
    .eq('team_id', teamId)
    .eq('scouted_team_number', robot)
    .order('created_at', { ascending: false })
    .limit(50)

  if (entriesErr) return json({ error: 'Something went wrong. Please try again.' }, 500)

  const rows = (entries ?? []) as Entry[]
  const entryCount = rows.length

  // Too little data → deterministic answer, no model call, no quota spent.
  if (entryCount < MIN_ENTRIES) {
    return json({
      summary: 'Not enough scouting on this team yet.',
      entry_count: entryCount,
      enough: false,
      cached: false,
    })
  }

  const sourceHash = await hashEntries(rows)

  // Cache hit: same underlying data AND same model → return without calling AI.
  const { data: cached } = await admin
    .from('scouting_summaries')
    .select('summary, entry_count, generated_at, source_hash, model')
    .eq('team_id', teamId)
    .eq('scouted_team_number', robot)
    .maybeSingle()

  if (cached && cached.source_hash === sourceHash && cached.model === MODEL) {
    return json({
      summary: cached.summary,
      entry_count: cached.entry_count,
      enough: true,
      cached: true,
      generated_at: cached.generated_at,
    })
  }

  // Cache miss → this is a real generation. Charge the per-team quota first.
  const { data: allowed, error: rlErr } = await admin.rpc('consume_summary_quota', {
    p_team_id: teamId,
    p_limit: RATE_LIMIT,
    p_window: RATE_WINDOW,
  })
  if (rlErr) return json({ error: 'Something went wrong. Please try again.' }, 500)
  if (allowed === false) {
    return json({ error: 'Your team has generated a lot of summaries today. Try again later.' }, 429)
  }

  let summary: string
  try {
    summary = await generateSummary(renderReports(rows, robot))
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'not-configured') {
      return json({ error: 'AI summaries are not configured on the server.' }, 503)
    }
    return json({ error: 'Could not generate a summary right now. Please try again.' }, 502)
  }

  // Upsert the fresh summary into the cache.
  const generatedAt = new Date().toISOString()
  const { error: upsertErr } = await admin
    .from('scouting_summaries')
    .upsert({
      team_id: teamId,
      scouted_team_number: robot,
      summary,
      source_hash: sourceHash,
      entry_count: entryCount,
      model: MODEL,
      generated_at: generatedAt,
    }, { onConflict: 'team_id,scouted_team_number' })

  // A failed cache write shouldn't fail the request — the user still gets their
  // summary; we just don't persist it (it'll regenerate next time).
  if (upsertErr) console.error('summary upsert failed', upsertErr)

  return json({
    summary,
    entry_count: entryCount,
    enough: true,
    cached: false,
    generated_at: generatedAt,
  })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
