import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../hooks/useTeam'

// Stash key for an invite code that arrived before the invitee was signed in.
// TeamSetup (on /my-team) picks this up after authentication to finish the join.
export const PENDING_JOIN_KEY = 'veralis_pending_join'

// Landing screen for shared invite links: /team/join?code=INVITECODE.
// When the invitee is signed in with no team, it joins immediately and forwards
// to My Team. When signed out, it stashes the code and routes to login.
export default function TeamJoin() {
  const [searchParams] = useSearchParams()
  const code = (searchParams.get('code') ?? '').trim().toUpperCase()
  const { user, loading: authLoading } = useAuth()
  const { team, loading: teamLoading, joinTeam } = useTeam()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const ran = useRef(false)

  useEffect(() => {
    if (authLoading) return

    // No code in the link — nothing to join.
    if (!code) { navigate('/my-team', { replace: true }); return }

    // Signed out: remember the code and send them to sign in / sign up. On return
    // they land on /my-team, where TeamSetup completes the join from the stash.
    if (!user) {
      try { localStorage.setItem(PENDING_JOIN_KEY, code) } catch { /* ignore */ }
      navigate('/login', { replace: true })
      return
    }

    if (teamLoading || ran.current) return
    ran.current = true

    // Already on a team — a user holds one team at a time, so just show it.
    if (team) {
      try { localStorage.removeItem(PENDING_JOIN_KEY) } catch { /* ignore */ }
      navigate('/my-team', { replace: true })
      return
    }

    // Signed in, no team → auto-join.
    ;(async () => {
      try {
        await joinTeam(code)
        try { localStorage.removeItem(PENDING_JOIN_KEY) } catch { /* ignore */ }
        navigate('/my-team', { replace: true })
      } catch (err) {
        setError(err.message)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, teamLoading, user, team, code])

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '360px' }}>
        {error ? (
          <>
            <p style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 6px', color: '#f87171' }}>Couldn't join the team</p>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 18px', lineHeight: 1.5 }}>{error}</p>
            <button
              onClick={() => navigate('/my-team', { replace: true })}
              className="v-btn v-btn-accent"
              style={{ height: '44px', padding: '0 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
            >
              Go to My Team
            </button>
          </>
        ) : (
          <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>Joining team…</p>
        )}
      </div>
    </div>
  )
}
