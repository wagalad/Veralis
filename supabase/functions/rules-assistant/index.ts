import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Tunables (all in one place) ───────────────────────────────────────────────
const RATE_LIMIT = 40           // model calls …
const RATE_WINDOW = '1 hour'    // … per user per this window
const MATCH_COUNT = 6           // KB entries retrieved per question
const MAX_HISTORY = 6           // prior messages kept for context
const MAX_QUESTION = 1000       // chars
// Cosine similarity below which we treat the KB as having nothing relevant and
// cleanly defer to the manual — no chat-model call, no quota spent. Tunable.
const MIN_SIMILARITY = 0.28

// ── Models — swap here (one line each) to change providers/models ─────────────
const MODEL = 'gpt-5-nano'
const EMBED_MODEL = 'text-embedding-3-small'

const SYSTEM_PROMPT = `You are the Veralis rules assistant for the VEX V5RC game "Override" (2026–2027). You help teams understand the game, robot, and tournament rules.

Strict rules:
- Answer ONLY from the reference entries provided in this conversation. They are plain-language summaries of the rules.
- If the reference entries do not contain the answer, say you're not sure and tell the user to check the official Game Manual — do NOT guess, infer, or invent rules, point values, numbers, or rule codes.
- Only answer questions about the VEX V5RC Override game, robots, or tournaments. For anything off-topic, politely say you can only help with Override rules.
- Keep answers concise and plain-language (usually 2–5 sentences). No markdown headers.
- You are NOT official. For precise rulings, edge cases, or disputes, tell the user the official Game Manual and the VEX Q&A are authoritative, and the head referee's call is final at an event.
- Never present a rule code that does not appear in the reference entries.`

function aalOf(jwt: string): string {
  try { return JSON.parse(atob(jwt.split('.')[1])).aal ?? 'aal1' } catch { return 'aal1' }
}

// Blocks a request when the user has 2FA enabled but the session is only AAL1.
async function mfaBlocked(admin: any, jwt: string, userId: string): Promise<boolean> {
  if (aalOf(jwt) === 'aal2') return false
  const { data } = await admin.auth.admin.mfa.listFactors({ userId })
  return (data?.factors ?? []).some((f: { status: string }) => f.status === 'verified')
}

interface Chunk { rule_no: string; section: string; title: string; content: string; similarity: number }

// Embed the question with OpenAI. Returns a 1536-d vector.
async function embedQuestion(apiKey: string, text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  })
  if (!res.ok) {
    console.error('embedding error', res.status, await res.text().catch(() => ''))
    throw new Error('model-failed')
  }
  const data = await res.json()
  const vec = data?.data?.[0]?.embedding
  if (!Array.isArray(vec)) throw new Error('model-empty')
  return vec
}

// The ONLY chat-model call. Given the retrieved KB context + conversation, ask
// the model for an answer. Isolated so the model/provider is a one-line swap.
// NOTE: if gpt-5-nano ever rejects chat/completions, point this at the Responses
// API instead — the rest of the function is unaffected.
async function generate(
  apiKey: string,
  context: string,
  history: { role: string; content: string }[],
  question: string,
): Promise<string> {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `Reference entries (answer only from these):\n\n${context}` },
    ...history,
    { role: 'user', content: question },
  ]

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, messages, max_completion_tokens: 500 }),
  })

  if (!res.ok) {
    console.error('openai error', res.status, await res.text().catch(() => ''))
    throw new Error('model-failed')
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content?.trim()
  if (!text) {
    console.error('openai empty response', JSON.stringify(data).slice(0, 500))
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

  let body: { question?: string; history?: { role: string; content: string }[] }
  try { body = await req.json() } catch { return json({ error: 'JSON body required.' }, 400) }

  const question = body.question?.trim()
  if (!question) return json({ error: 'A question is required.' }, 400)
  if (question.length > MAX_QUESTION) return json({ error: 'That question is too long.' }, 400)

  // Only user/assistant turns, last MAX_HISTORY, as plain {role, content}.
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) }))

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return json({ error: 'The rules assistant is not configured on the server.' }, 503)

  // Retrieve first — the embedding call is ~free. This lets us gate on relevance
  // BEFORE spending the user's quota or making the (pricier) chat-model call.
  let chunks: Chunk[]
  try {
    const vec = await embedQuestion(apiKey, question)
    const { data: matched, error: matchErr } = await admin.rpc('match_rules_chunks', {
      query_embedding: `[${vec.join(',')}]`,
      match_count: MATCH_COUNT,
    })
    if (matchErr) throw new Error('retrieval-failed')
    chunks = (matched ?? []) as Chunk[]
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'model-failed' || msg === 'model-empty') {
      return json({ error: 'Could not reach the assistant right now. Please try again.' }, 502)
    }
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }

  // Confidence gate: if nothing in the KB is close to the question, defer to the
  // manual instead of stretching weak context into a possibly-wrong answer. No
  // model call, no quota spent — cheap and safe.
  const topSimilarity = chunks[0]?.similarity ?? 0
  if (topSimilarity < MIN_SIMILARITY) {
    return json({
      answer: "I don't have that one in my rules notes. For this, check the official Game Manual and the VEX Q&A — they're the authoritative source for rulings.",
      citations: [],
      deferred: true,
    })
  }

  // Relevant match found → this becomes a real model call, so charge quota now.
  const { data: allowed, error: rlErr } = await admin.rpc('consume_assistant_quota', {
    p_user_id: user.id, p_limit: RATE_LIMIT, p_window: RATE_WINDOW,
  })
  if (rlErr) return json({ error: 'Something went wrong. Please try again.' }, 500)
  if (allowed === false) {
    return json({ error: "You've asked a lot of questions recently. Try again a bit later." }, 429)
  }

  const context = chunks.map(c => `[${c.rule_no}] ${c.title} (${c.section}): ${c.content}`).join('\n\n')

  let answer: string
  try {
    answer = await generate(apiKey, context, history, question)
  } catch {
    return json({ error: 'Could not generate an answer right now. Please try again.' }, 502)
  }

  // Only cite entries that actually cleared the relevance bar.
  const citations = chunks
    .filter(c => (c.similarity ?? 0) >= MIN_SIMILARITY)
    .map(c => ({ rule_no: c.rule_no, title: c.title }))

  return json({ answer, citations })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
