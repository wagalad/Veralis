import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Search from './pages/Search'
import Scout from './pages/Scout'
import MyTeam from './pages/MyTeam'
import Login from './pages/Login'

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}

function Shell() {
  const { pathname } = useLocation()
  const isAuthPage = pathname === '/login'

  return (
    <div className="app-shell">
      {!isAuthPage && <BottomNav />}
      <main className={isAuthPage ? undefined : 'app-main'} style={isAuthPage ? { flex: 1, overflowY: 'auto' } : undefined}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/scout" element={<Scout />} />
          <Route path="/my-team" element={<MyTeam />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
