import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import MfaSetup from '../components/MfaSetup'
import { useAdmin } from '../hooks/useAdmin'
import { getStoredTheme, setTheme } from '../lib/theme'

export default function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const admin = useAdmin()
  const [theme, setThemeState] = useState(getStoredTheme)
  const [isOperator, setIsOperator] = useState(false)

  function chooseTheme(pref) { setTheme(pref); setThemeState(pref) }

  // Probe operator access; the link only appears if the server says yes (i.e.
  // the user is in platform_admins and their session is AAL2). Non-operators
  // get a 403 and never see the entry point.
  useEffect(() => {
    if (!user) { setIsOperator(false); return }
    let alive = true
    admin.overview().then(() => alive && setIsOperator(true)).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return (
    <div style={{ padding: '24px 16px', maxWidth: '560px', margin: '0 auto' }}>
      <h1 style={h1}>Settings</h1>

      {user && (
        <div style={{ ...card, marginBottom: '12px' }}>
          <p style={{ ...label, marginBottom: '4px' }}>Signed in as</p>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, wordBreak: 'break-all' }}>{user.email}</p>
        </div>
      )}

      {/* Appearance */}
      <div style={{ ...card, marginBottom: '12px' }}>
        <p style={{ ...label, marginBottom: '12px' }}>Appearance</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['system', 'light', 'dark'].map(t => {
            const active = theme === t
            return (
              <button
                key={t}
                className="v-btn" onClick={() => chooseTheme(t)}
                style={{
                  flex: 1, height: '46px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                  cursor: 'pointer', textTransform: 'capitalize',
                  background: active ? 'var(--accent)' : 'var(--surface-2)',
                  color: active ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {t}
              </button>
            )
          })}
        </div>
      </div>

      {/* Security — two-factor authentication */}
      {user && (
        <div style={{ ...card, marginBottom: '12px' }}>
          <MfaSetup />
        </div>
      )}

      {/* Operator — only rendered for platform admins */}
      {isOperator && (
        <button className="v-btn" onClick={() => navigate('/admin')} style={{ ...card, width: '100%', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', color: 'inherit', textAlign: 'left' }}>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>Operator dashboard</span>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>→</span>
        </button>
      )}

      {user ? (
        <button className="v-btn v-btn-ghost" onClick={async () => { await signOut(); navigate('/login') }} style={{ ...btnSecondary, width: '100%', marginTop: '8px' }}>
          Sign out
        </button>
      ) : (
        <button onClick={() => navigate('/login')} className="v-btn v-btn-accent" style={{ ...btnPrimary, width: '100%', marginTop: '8px' }}>
          Sign in
        </button>
      )}
    </div>
  )
}

const label = { margin: 0, color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }
const h1 = { margin: '8px 0 20px', fontSize: '28px', fontWeight: 800 }
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }
const btnSecondary = { height: '52px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '15px', fontWeight: 500, cursor: 'pointer' }
const btnPrimary = { height: '52px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }
