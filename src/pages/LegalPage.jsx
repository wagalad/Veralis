import { useNavigate } from 'react-router-dom'

// Shared layout + typography for the Privacy / Terms pages.
export default function LegalPage({ title, updated, children }) {
  const navigate = useNavigate()
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 20px 72px' }}>
      <button onClick={() => navigate(-1)} style={backBtn}>← Back</button>
      <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '10px 0 4px', letterSpacing: '-0.5px' }}>{title}</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 24px' }}>Last updated: {updated}</p>
      <div style={{ fontSize: '15px', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

export function H({ children }) {
  return <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '28px 0 8px' }}>{children}</h2>
}
export function P({ children }) {
  return <p style={{ margin: '0 0 12px', color: 'var(--text-muted)' }}>{children}</p>
}
export function UL({ children }) {
  return <ul style={{ margin: '0 0 12px', paddingLeft: '20px', color: 'var(--text-muted)' }}>{children}</ul>
}
export function LI({ children }) {
  return <li style={{ margin: '0 0 6px' }}>{children}</li>
}
export function Mail() {
  return <a href="mailto:orbitvrc@gmail.com" style={{ color: 'var(--accent)' }}>orbitvrc@gmail.com</a>
}

const backBtn = { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', padding: 0 }
