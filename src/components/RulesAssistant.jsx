import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { supabase } from '../lib/supabase'
import { trackRulesAsked } from '../lib/analytics'

const SUGGESTIONS = [
  'How do I earn the Autonomous Win Point?',
  'Can I take a Pin out of the other team’s goal?',
  'How big can my robot expand during the match?',
  'How does owning yellow Pins work?',
]

// Chat UI for the AI rules assistant. Answers come from the rules-assistant Edge
// Function (server-side model call over our own paraphrased rules KB); this only
// renders them, clearly marked as AI-generated and non-authoritative.
export default function RulesAssistant({ manualUrl }) {
  const { user } = useAuth()
  const online = useOnlineStatus()
  const [messages, setMessages] = useState([]) // { role, content, citations? }
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function ask(question) {
    const q = question.trim()
    if (!q || loading) return
    setError(null)
    setInput('')

    // History = the conversation so far (before this question), roles + text only.
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(m => [...m, { role: 'user', content: q }])
    setLoading(true)
    trackRulesAsked()

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('rules-assistant', {
        body: { question: q, history },
      })

      // Surface the server's friendly message (rate limit / not configured / …).
      let serverMsg = data?.error
      if (fnErr?.context?.json) {
        try { serverMsg = (await fnErr.context.json())?.error ?? serverMsg } catch { /* ignore */ }
      }

      if (fnErr || !data?.answer) {
        setError(serverMsg || 'Couldn’t get an answer right now. Please try again.')
      } else {
        setMessages(m => [...m, { role: 'assistant', content: data.answer, citations: data.citations ?? [] }])
      }
    } catch {
      setError('Couldn’t reach the assistant. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Gates ──
  if (!user) {
    return (
      <div style={gateCard}>
        <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.5 }}>
          Sign in to ask the rules assistant about the game.
        </p>
      </div>
    )
  }

  const disabled = loading || !online

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header note */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          fontSize: '9px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '2px 7px', borderRadius: '20px',
          background: 'rgba(204,0,0,0.12)', color: 'var(--accent)', border: '1px solid rgba(204,0,0,0.22)',
        }}>AI-generated</span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Plain-language help — not official.</span>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} style={{
        maxHeight: 'clamp(300px, 48vh, 520px)', overflowY: 'auto',
        border: '1px solid var(--border)', borderRadius: '12px', padding: '14px',
        display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--surface)',
      }}>
        {messages.length === 0 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Ask about Override — scoring, autonomous, robot rules, tournaments. Try:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {SUGGESTIONS.map(s => (
                <button key={s} type="button" onClick={() => ask(s)} disabled={disabled}
                  style={{
                    padding: '8px 12px', borderRadius: '999px', cursor: disabled ? 'default' : 'pointer',
                    border: '1px solid var(--border)', background: 'var(--surface-2)',
                    color: 'var(--text)', fontSize: '13px', fontFamily: 'inherit', textAlign: 'left',
                    opacity: disabled ? 0.5 : 1,
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => <Bubble key={i} message={m} />)}

        {loading && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)', fontSize: '13px' }}>
            Checking the rules…
          </div>
        )}
      </div>

      {error && (
        <p style={{ margin: 0, fontSize: '13px', color: '#f87171', padding: '8px 12px', background: 'rgba(248,113,113,0.1)', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.2)' }}>
          {error}
        </p>
      )}

      {!online && (
        <p style={{ margin: 0, fontSize: '13px', color: '#fbbf24' }}>You’re offline — reconnect to ask a question.</p>
      )}

      {/* Composer */}
      <form onSubmit={e => { e.preventDefault(); ask(input) }} style={{ display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a rules question…"
          maxLength={1000}
          disabled={disabled}
          style={{
            flex: 1, height: '48px', padding: '0 14px', boxSizing: 'border-box',
            background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: '10px',
            color: 'var(--text)', fontFamily: 'inherit', fontSize: '15px', outline: 'none',
          }}
        />
        <button type="submit" className="v-btn v-btn-accent" disabled={disabled || !input.trim()}
          style={{
            height: '48px', padding: '0 18px', borderRadius: '10px', border: 'none',
            background: 'var(--accent)', color: '#fff', fontSize: '15px', fontWeight: '700',
            cursor: disabled || !input.trim() ? 'default' : 'pointer',
            opacity: disabled || !input.trim() ? 0.5 : 1,
          }}>
          Ask
        </button>
      </form>

      {/* Disclaimer */}
      <p style={{ margin: '2px 4px 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        AI-generated from our plain-language rules summary — always confirm rulings against the{' '}
        <a href={manualUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
          official Game Manual
        </a>{' '}and VEX Q&amp;A. The head referee&rsquo;s call is final.
      </p>
    </div>
  )
}

function Bubble({ message }) {
  const isUser = message.role === 'user'
  const cites = (message.citations ?? []).filter(c => c?.title)
  return (
    <div style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
      <div style={{
        padding: '10px 13px', borderRadius: '12px', fontSize: '14px', lineHeight: 1.5,
        background: isUser ? 'var(--accent)' : 'var(--surface-2)',
        color: isUser ? '#fff' : 'var(--text)',
        border: isUser ? 'none' : '1px solid var(--border)',
        whiteSpace: 'pre-wrap',
      }}>
        {message.content}
      </div>
      {!isUser && cites.length > 0 && (
        <p style={{ margin: '5px 2px 0', fontSize: '11px', color: 'var(--text-muted)' }}>
          Referenced: {cites.slice(0, 4).map(c => c.title).join(' · ')}
        </p>
      )}
    </div>
  )
}

const gateCard = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
  padding: '28px 20px', textAlign: 'center',
}
