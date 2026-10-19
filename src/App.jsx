import { useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import BottomNav from './components/BottomNav'
import LoadingScreen from './components/LoadingScreen'
import MfaChallenge from './components/MfaChallenge'
import { FirstRunTour } from './components/Onboarding'
import Home from './pages/Home'
import Search from './pages/Search'
import Scout from './pages/Scout'
import MyTeam from './pages/MyTeam'
import TeamJoin from './pages/TeamJoin'
import GameRules from './pages/GameRules'
import Settings from './pages/Settings'
import AdminPanel from './pages/AdminPanel'
import Login from './pages/Login'
import Landing from './pages/Landing'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}

// Pages shown without the bottom nav (full-height, scrollable on their own).
const CHROMELESS = ['/login', '/privacy', '/terms', '/team/join']

function Shell() {
  const { pathname } = useLocation()
  const { user, mfaRequired, loading } = useAuth()
  // The public landing page ("/" when logged out) renders without the app nav.
  const onLanding = pathname === '/' && !user
  const chromeless = CHROMELESS.includes(pathname) || onLanding

  // Desktop sidebar: pinned (kept open) vs. hover-to-expand. Persisted per device.
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem('veralis-sidebar-pinned') === '1' } catch { return false }
  })
  function togglePin() {
    setPinned(p => {
      const next = !p
      try { localStorage.setItem('veralis-sidebar-pinned', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  // While the session is still resolving, show the loader instead of guessing
  // at a route — this also prevents a signed-in user flashing the public
  // Landing page ("/" renders Landing whenever user is falsy, incl. undefined).
  if (loading) return <LoadingScreen />

  // A signed-in user with 2FA enabled must pass the code challenge before
  // anything else in the app is reachable.
  if (user && mfaRequired) {
    return (
      <div className="app-shell">
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <MfaChallenge />
        </main>
      </div>
    )
  }

  return (
    <div className={`app-shell${!chromeless && pinned ? ' app-shell--pinned' : ''}`}>
      {!chromeless && <BottomNav pinned={pinned} onTogglePin={togglePin} />}
      <main className={chromeless ? undefined : 'app-main'} style={chromeless ? { flex: 1, overflowY: 'auto' } : undefined}>
        <Routes>
          <Route path="/" element={user ? <Home /> : <Landing />} />
          <Route path="/search" element={<Search />} />
          <Route path="/scout" element={<Scout />} />
          <Route path="/my-team" element={<MyTeam />} />
          <Route path="/team/join" element={<TeamJoin />} />
          <Route path="/rules" element={<GameRules />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {/* First-run tour — only for a signed-in user past the MFA gate */}
      {user && <FirstRunTour />}
    </div>
  )
}
