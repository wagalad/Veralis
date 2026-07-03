import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getVerifiedFactor, verifyCode, consumeRecoveryCode } from '../hooks/useMfa'

// Shown to a signed-in user whose session still needs to be elevated to AAL2 —
// i.e., they have 2FA enabled and haven't entered their code yet this session.
// Two modes: an authenticator code, or (if the device is lost) a recovery code.
export default function MfaChallenge() {
  const { signOut, recheckMfa } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('totp') // 'totp' | 'recovery'
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [recovered, setRecovered] = useState(false)

  async function submitTotp(e) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      const factor = await getVerifiedFactor()
      if (!factor) throw new Error('No authenticator is set up on this account.')
      await verifyCode(factor.id, code.trim())
      await recheckMfa() // success elevates the session → this screen unmounts
    } catch (err) {
      setError(err.message?.includes('nvalid') ? 'That code is incorrect or expired. Try again.' : (err.message || 'Verification failed.'))
      setLoading(false)
    }
  }

  async function submitRecovery(e) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      await consumeRecoveryCode(code.trim())
      setRecovered(true) // 2FA is now off; user acknowledges then continues
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (recovered) {
    return (
      <Wrap>
        <h1 style={h1}>You're back in</h1>
        <p style={sub}>
          Two-factor authentication has been turned off using your recovery code. For your security,
          set it up again from the My Team page.
        </p>
        <button onClick={recheckMfa} style={{ ...primaryBtn, width: '100%' }}>Continue</button>
      </Wrap>
    )
  }

  const isRecovery = mode === 'recovery'

  return (
    <Wrap>
      <h1 style={h1}>Two-factor authentication</h1>
      <p style={sub}>
        {isRecovery
          ? 'Enter one of the recovery codes you saved when you set up 2FA.'
          : 'Enter the 6-digit code from your authenticator app.'}
      </p>

      <form onSubmit={isRecovery ? submitRecovery : submitTotp} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {isRecovery ? (
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXX-XXXXX"
            autoComplete="off"
            autoFocus
            style={{ ...input, textAlign: 'center', letterSpacing: '0.15em', fontFamily: 'monospace' }}
          />
        ) : (
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            style={{ ...input, textAlign: 'center', letterSpacing: '0.4em', fontSize: '22px', fontFamily: 'monospace' }}
          />
        )}
        {error && <p style={errorStyle}>{error}</p>}
        <button
          type="submit"
          disabled={loading || (isRecovery ? code.trim().length < 6 : code.length !== 6)}
          style={{ ...primaryBtn, opacity: loading || (isRecovery ? code.trim().length < 6 : code.length !== 6) ? 0.6 : 1 }}
        >
          {loading ? 'Verifying…' : isRecovery ? 'Use recovery code' : 'Verify'}
        </button>
      </form>

      <button
        onClick={() => { setMode(isRecovery ? 'totp' : 'recovery'); setCode(''); setError(null) }}
        style={linkBtn}
      >
        {isRecovery ? 'Back to authenticator code' : 'Lost your authenticator? Use a recovery code'}
      </button>

      <button onClick={async () => { await signOut(); navigate('/login') }} style={{ ...secondaryBtn, width: '100%', marginTop: '4px' }}>
        Sign out
      </button>
    </Wrap>
  )
}

function Wrap({ children }) {
  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <img src="/logo.png" alt="Veralis" style={{ width: '96px', height: '96px', objectFit: 'contain', margin: '0 auto 20px', display: 'block' }} />
        {children}
      </div>
    </div>
  )
}

const h1 = { margin: '0 0 8px', fontSize: '24px', fontWeight: 800, textAlign: 'center' }
const sub = { margin: '0 0 24px', fontSize: '15px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }
const input = { height: '54px', padding: '0 16px', background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', width: '100%' }
const errorStyle = { margin: 0, fontSize: '14px', color: '#f87171', padding: '10px 14px', background: 'rgba(248,113,113,0.1)', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)' }
const primaryBtn = { height: '54px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }
const secondaryBtn = { height: '48px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }
const linkBtn = { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', padding: '12px 8px', width: '100%', textDecoration: 'underline' }
