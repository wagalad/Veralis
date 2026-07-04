import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import MfaSetup from '../components/MfaSetup'
import { getStoredTheme, setTheme } from '../lib/theme'

export default function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [theme, setThemeState] = useState(getStoredTheme)

  function chooseTheme(pref) { setTheme(pref); setThemeState(pref) }

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
                onClick={() => chooseTheme(t)}
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

      {user ? (
        <button onClick={async () => { await signOut(); navigate('/login') }} style={{ ...btnSecondary, width: '100%', marginTop: '8px' }}>
          Sign out
        </button>
      ) : (
        <button onClick={() => navigate('/login')} style={{ ...btnPrimary, width: '100%', marginTop: '8px' }}>
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
