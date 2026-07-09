import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import BottomNav from './components/BottomNav'
import MfaChallenge from './components/MfaChallenge'
import Home from './pages/Home'
import Search from './pages/Search'
import Scout from './pages/Scout'
import MyTeam from './pages/MyTeam'
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
const CHROMELESS = ['/login', '/privacy', '/terms']

function Shell() {
  const { pathname } = useLocation()
  const { user, mfaRequired } = useAuth()
  // The public landing page ("/" when logged out) renders without the app nav.
  const onLanding = pathname === '/' && !user
  const chromeless = CHROMELESS.includes(pathname) || onLanding

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
    <div className="app-shell">
      {!chromeless && <BottomNav />}
      <main className={chromeless ? undefined : 'app-main'} style={chromeless ? { flex: 1, overflowY: 'auto' } : undefined}>
        <Routes>
          <Route path="/" element={user ? <Home /> : <Landing />} />
          <Route path="/search" element={<Search />} />
          <Route path="/scout" element={<Scout />} />
          <Route path="/my-team" element={<MyTeam />} />
          <Route path="/rules" element={<GameRules />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
