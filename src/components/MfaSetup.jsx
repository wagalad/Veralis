import { useState, useEffect } from 'react'
import { listFactors, startEnroll, verifyCode, disableMfa, generateRecoveryCodes } from '../hooks/useMfa'

// Account-settings widget (rendered in My Team) to turn 2FA on or off and
// manage recovery codes.
export default function MfaSetup() {
  const [factors, setFactors] = useState(null) // null = loading
  const [enroll, setEnroll] = useState(null)    // { factorId, qrSvg, secret } while enrolling
  const [recoveryCodes, setRecoveryCodes] = useState(null) // string[] to display once
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try { setFactors(await listFactors()) }
    catch (err) { setError(err.message) }
  }

  const verified = factors?.find(f => f.status === 'verified')

  async function begin() {
    setError(null); setBusy(true)
    try { setEnroll(await startEnroll()) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  async function confirm(e) {
    e.preventDefault()
    setError(null); setBusy(true)
    try {
      await verifyCode(enroll.factorId, code.trim())
      setEnroll(null)
      setCode('')
      // Session is now AAL2 — immediately mint recovery codes to show once.
      const codes = await generateRecoveryCodes()
      setRecoveryCodes(codes)
      await load()
    } catch (err) {
      setError(err.message?.includes('match') || err.message?.includes('nvalid')
        ? "That code didn't match. Check your app and try again."
        : err.message)
    } finally {
      setBusy(false)
    }
  }

  async function regenerate() {
    if (!confirm('Generate new recovery codes? Your old codes will stop working.')) return
    setError(null); setBusy(true)
    try { setRecoveryCodes(await generateRecoveryCodes()) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  async function turnOff() {
    if (!confirm('Turn off two-factor authentication? Your account will be protected by password only.')) return
    setError(null); setBusy(true)
    try { await disableMfa(verified.id); await load() }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <div>
      <p style={{ ...label, marginBottom: '4px' }}>Two-factor authentication</p>

      {factors === null ? (
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</p>
      ) : recoveryCodes ? (
        <RecoveryCodes codes={recoveryCodes} onDone={() => setRecoveryCodes(null)} />
      ) : enroll ? (
        <form onSubmit={confirm} style={{ marginTop: '10px' }}>
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Scan this with an authenticator app (Google Authenticator, Authy, 1Password), then enter the 6-digit code it shows.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <img src={enroll.qrSvg} alt="2FA QR code" style={{ width: '180px', height: '180px', background: '#fff', borderRadius: '10px', padding: '8px' }} />
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all' }}>
            Can't scan? Enter this key manually:<br /><code style={{ color: 'var(--text)' }}>{enroll.secret}</code>
          </p>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            style={{ ...input, textAlign: 'center', letterSpacing: '0.3em', fontFamily: 'monospace' }}
          />
          {error && <p style={errorStyle}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button className="v-btn v-btn-accent" type="submit" disabled={busy || code.length !== 6} style={{ ...primaryBtn, flex: 1, opacity: busy || code.length !== 6 ? 0.6 : 1 }}>
              {busy ? 'Verifying…' : 'Confirm'}
            </button>
            <button type="button" className="v-btn v-btn-ghost" onClick={() => { setEnroll(null); setCode(''); setError(null) }} style={secondaryBtn}>
              Cancel
            </button>
          </div>
        </form>
      ) : verified ? (
        <div style={{ marginTop: '8px' }}>
          <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#4ade80', fontWeight: 600 }}>● On — a code is required at sign-in.</p>
          {error && <p style={errorStyle}>{error}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button className="v-btn v-btn-ghost" onClick={regenerate} disabled={busy} style={{ ...secondaryBtn, opacity: busy ? 0.6 : 1 }}>
              Regenerate recovery codes
            </button>
            <button className="v-btn" onClick={turnOff} disabled={busy} style={{ ...dangerBtn, opacity: busy ? 0.6 : 1 }}>
              Turn off 2FA
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '8px' }}>
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Add a second step at sign-in with an authenticator app for stronger account security.
          </p>
          {error && <p style={errorStyle}>{error}</p>}
          <button className="v-btn v-btn-accent" onClick={begin} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Starting…' : 'Enable 2FA'}
          </button>
        </div>
      )}
    </div>
  )
}

// One-time display of recovery codes with copy / download and an acknowledgement.
function RecoveryCodes({ codes, onDone }) {
  const [copied, setCopied] = useState(false)
  const text = codes.join('\n')

  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  function download() {
    const url = URL.createObjectURL(new Blob([`Veralis recovery codes\n\n${text}\n`], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'veralis-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ marginTop: '10px' }}>
      <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Save your recovery codes</p>
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Each code works once. If you lose your authenticator, a code lets you sign in and reset 2FA.
        Store them somewhere safe — <strong>you won't see them again.</strong>
      </p>
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontFamily: 'monospace', fontSize: '14px', letterSpacing: '0.04em' }}>
        {codes.map(c => <span key={c}>{c}</span>)}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button className="v-btn v-btn-ghost" onClick={copy} style={secondaryBtn}>{copied ? 'Copied!' : 'Copy'}</button>
        <button className="v-btn v-btn-ghost" onClick={download} style={secondaryBtn}>Download</button>
      </div>
      <button className="v-btn v-btn-accent" onClick={onDone} style={{ ...primaryBtn, width: '100%', marginTop: '10px' }}>
        I've saved my codes
      </button>
    </div>
  )
}

const label = { margin: 0, color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }
const input = { height: '48px', padding: '0 14px', background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '16px', fontFamily: 'inherit', outline: 'none', width: '100%' }
const errorStyle = { margin: '10px 0 0', fontSize: '13px', color: '#f87171', padding: '8px 12px', background: 'rgba(248,113,113,0.1)', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.2)' }
const primaryBtn = { height: '44px', padding: '0 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }
const secondaryBtn = { height: '44px', padding: '0 16px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }
const dangerBtn = { height: '44px', padding: '0 16px', background: 'transparent', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }
