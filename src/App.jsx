import { Routes, Route, Navigate } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Scout from './pages/Scout'
import MyTeam from './pages/MyTeam'

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 'var(--nav-height)' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scout" element={<Scout />} />
          <Route path="/my-team" element={<MyTeam />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
