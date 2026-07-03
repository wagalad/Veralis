import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getVerifiedFactor, verifyCode } from '../hooks/useMfa'

// Shown to a signed-in user whose session still needs to be elevated to AAL2 —
// i.e., they have 2FA enabled and haven't entered their code yet this session.
export default function MfaChallenge() {
  const { signOut, recheckMfa } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const factor = await getVerifiedFactor()
      if (!factor) throw new Error('No authenticator is set up on this account.')
      await verifyCode(factor.id, code.trim())
      await recheckMfa() // success elevates the session → this screen unmounts
    } catch (err) {
      setError(err.message?.includes('Invalid') ? 'That code is incorrect or expired. Try again.' : (err.message || 'Verification failed.'))
      setLoading(false)
    }
  }

  return (
    <div style={wrap}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <img src="/logo.png" alt="Veralis" style={{ width: '96px', height: '96px', objectFit: 'contain', margin: '0 auto 20px', display: 'block' }} />
        <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 800, textAlign: 'center' }}>Two-factor authentication</h1>
        <p style={{ margin: '0 0 24px', fontSize: '15px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
          Enter the 6-digit code from your authenticator app.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            style={{ ...input, textAlign: 'center', letterSpacing: '0.4em', fontSize: '22px', fontFamily: 'monospace' }}
          />
          {error && <p style={errorStyle}>{error}</p>}
          <button type="submit" disabled={loading || code.length !== 6} style={{ ...primaryBtn, opacity: loading || code.length !== 6 ? 0.6 : 1 }}>
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </form>
        <button onClick={async () => { await signOut(); navigate('/login') }} style={{ ...secondaryBtn, width: '100%', marginTop: '12px' }}>
          Sign out
        </button>
      </div>
    </div>
  )
}

const wrap = { minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }
const input = { height: '54px', padding: '0 16px', background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', width: '100%' }
const errorStyle = { margin: 0, fontSize: '14px', color: '#f87171', padding: '10px 14px', background: 'rgba(248,113,113,0.1)', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)' }
const primaryBtn = { height: '54px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }
const secondaryBtn = { height: '48px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }
