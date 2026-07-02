import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Search from './pages/Search'
import Scout from './pages/Scout'
import MyTeam from './pages/MyTeam'
import Login from './pages/Login'
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
  const chromeless = CHROMELESS.includes(pathname)

  return (
    <div className="app-shell">
      {!chromeless && <BottomNav />}
      <main className={chromeless ? undefined : 'app-main'} style={chromeless ? { flex: 1, overflowY: 'auto' } : undefined}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/scout" element={<Scout />} />
          <Route path="/my-team" element={<MyTeam />} />
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
