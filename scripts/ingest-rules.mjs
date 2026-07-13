// Ingest the rules knowledge base into Supabase for the rules-assistant RAG.
//
// Reads data/rules-kb.md, splits it into per-rule chunks, embeds each with
// OpenAI text-embedding-3-small, and replaces the rules_chunks table contents.
// Idempotent: safe to re-run after editing the KB (delete-all then insert).
//
// Usage (from the repo root):
//   OPENAI_API_KEY=sk-... \
//   SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/ingest-rules.mjs
//
// The service-role key is required because rules_chunks is RLS-locked to the
// service role. Keep it out of the client — this script runs locally only.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const EMBED_MODEL = 'text-embedding-3-small'
const KB_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'rules-kb.md')

const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
for (const [k, v] of Object.entries({ OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) { console.error(`Missing env var: ${k}`); process.exit(1) }
}

// Parse "## CODE — Title" headers (real entries start at column 0; the indented
// example inside the top HTML comment is ignored). Everything up to the next
// header is that entry's body; a leading "section: X" line is metadata.
function parseKb(md) {
  const chunks = []
  const headerRe = /^##\s+(.+?)\s+—\s+(.+?)\s*$/
  const lines = md.split('\n')
  let cur = null
  for (const line of lines) {
    const m = line.match(headerRe)
    if (m) {
      if (cur) chunks.push(cur)
      cur = { rule_no: m[1].trim(), title: m[2].trim(), section: 'General', body: [] }
      continue
    }
    if (!cur) continue
    const sec = line.match(/^section:\s*(.+?)\s*$/)
    if (sec && cur.body.length === 0) { cur.section = sec[1].trim(); continue }
    cur.body.push(line)
  }
  if (cur) chunks.push(cur)
  return chunks.map(c => ({
    rule_no: c.rule_no,
    title: c.title,
    section: c.section,
    content: c.body.join('\n').trim(),
  })).filter(c => c.content.length > 0)
}

async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  })
  if (!res.ok) throw new Error(`Embedding failed (${res.status}): ${await res.text().catch(() => '')}`)
  const data = await res.json()
  return data.data[0].embedding // number[1536]
}

async function main() {
  const md = await readFile(KB_PATH, 'utf8')
  const chunks = parseKb(md)
  if (chunks.length === 0) { console.error('No entries parsed from the KB.'); process.exit(1) }
  console.log(`Parsed ${chunks.length} KB entries. Embedding with ${EMBED_MODEL}…`)

  const rows = []
  for (const c of chunks) {
    // Embed the title + content together so the vector reflects both.
    const vec = await embed(`${c.title}\n${c.content}`)
    rows.push({
      section: c.section,
      rule_no: c.rule_no,
      title: c.title,
      content: c.content,
      // pgvector accepts the "[a,b,c]" text form via PostgREST.
      embedding: `[${vec.join(',')}]`,
      token_count: Math.ceil(c.content.length / 4),
    })
    console.log(`  ✓ ${c.rule_no}`)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // Replace contents wholesale so re-runs stay idempotent.
  const del = await supabase.from('rules_chunks').delete().not('id', 'is', null)
  if (del.error) { console.error('Delete failed:', del.error.message); process.exit(1) }

  const ins = await supabase.from('rules_chunks').insert(rows)
  if (ins.error) { console.error('Insert failed:', ins.error.message); process.exit(1) }

  console.log(`Done — ${rows.length} chunks written to rules_chunks.`)
}

main().catch(err => { console.error(err); process.exit(1) })
