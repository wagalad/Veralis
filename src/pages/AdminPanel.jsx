import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../hooks/useAdmin'

// Global operator dashboard (read-only). Not linked from the bottom nav; reached
// via /admin. Access is enforced server-side by the admin-panel Edge Function
// (platform_admins + AAL2). A 403 on the initial probe bounces non-operators to
// home so the shell is never shown to anyone who isn't the operator.
export default function AdminPanel() {
  const admin = useAdmin()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [authorized, setAuthorized] = useState(null) // null = probing

  // Probe access on mount using the cheapest action.
  useEffect(() => {
    let alive = true
    admin.overview()
      .then(() => { if (alive) setAuthorized(true) })
      .catch((e) => {
        if (!alive) return
        if (e.status === 403) navigate('/', { replace: true })
        else setAuthorized(true) // transient error — let the tab surface it
      })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (authorized === null) {
    return <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Checking access…</div>
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <h1 style={h1}>Operator</h1>
        <span style={badge}>ADMIN</span>
      </div>

      <div style={tabBar}>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              ...tabBtn,
              color: tab === id ? '#fff' : 'var(--text-muted)',
              background: tab === id ? 'var(--accent)' : 'transparent',
              borderColor: tab === id ? 'var(--accent)' : 'var(--border)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab admin={admin} />}
      {tab === 'teams' && <TeamsTab admin={admin} />}
      {tab === 'users' && <UsersTab admin={admin} />}
    </div>
  )
}

const TABS = [['overview', 'Overview'], ['teams', 'Teams'], ['users', 'Users']]

// ── Generic async-data helper ────────────────────────────────────────────────
function useAsync(fn) {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const run = useCallback(() => {
    let alive = true
    setState({ loading: true, error: null, data: null })
    fn()
      .then((data) => alive && setState({ loading: false, error: null, data }))
      .catch((e) => alive && setState({ loading: false, error: e.message || 'Error', data: null }))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(run, [run])
  return state
}

function Status({ loading, error }) {
  if (loading) return <p style={muted}>Loading…</p>
  if (error) return <p style={{ ...muted, color: 'var(--accent)' }}>{error === 'forbidden' ? 'Access denied.' : error}</p>
  return null
}

// ── Overview ─────────────────────────────────────────────────────────────────
function OverviewTab({ admin }) {
  const { loading, error, data } = useAsync(admin.overview)
  if (loading || error) return <Status loading={loading} error={error} />

  const stats = [
    ['Teams', data.teams],
    ['Users', data.users],
    ['Scouting entries', data.entries],
    ['Entries · last 7d', data.entries_last_7d],
    ['Users with 2FA', data.users_with_2fa],
    ['AI summaries · window', data.ai_summaries_in_window],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
      {stats.map(([label, value]) => (
        <div key={label} style={card}>
          <p style={statNum}>{value ?? 0}</p>
          <p style={statLabel}>{label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Teams ────────────────────────────────────────────────────────────────────
function TeamsTab({ admin }) {
  const { loading, error, data } = useAsync(admin.listTeams)
  const [openId, setOpenId] = useState(null)
  if (loading || error) return <Status loading={loading} error={error} />

  const teams = data.teams ?? []
  if (teams.length === 0) return <p style={muted}>No teams yet.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {teams.map((t) => (
        <div key={t.id} style={card}>
          <button onClick={() => setOpenId(openId === t.id ? null : t.id)} style={rowBtn}>
            <div>
              <span style={{ fontWeight: 700, fontSize: '15px' }}>{t.team_number}</span>
              {t.team_name && <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '13px' }}>{t.team_name}</span>}
            </div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>{t.member_count} 👤</span>
              <span>{t.entry_count} 📋</span>
            </div>
          </button>
          {openId === t.id && <TeamDetail admin={admin} teamId={t.id} />}
        </div>
      ))}
    </div>
  )
}

function TeamDetail({ admin, teamId }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { loading, error, data } = useAsync(useCallback(() => admin.teamDetail(teamId), [teamId]))
  if (loading || error) return <div style={{ paddingTop: '12px' }}><Status loading={loading} error={error} /></div>

  return (
    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
      <p style={sectionLabel}>Members ({data.members?.length ?? 0})</p>
      {(data.members ?? []).map((m) => (
        <div key={m.user_id} style={detailRow}>
          <span>{m.display_name || '—'} <span style={{ color: 'var(--text-muted)' }}>· {m.email}</span></span>
          <span style={{ color: m.role === 'admin' ? 'var(--accent)' : 'var(--text-muted)', fontSize: '12px' }}>{m.role}</span>
        </div>
      ))}
      <p style={{ ...sectionLabel, marginTop: '14px' }}>Recent entries ({data.recent_entries?.length ?? 0})</p>
      {(data.recent_entries ?? []).length === 0 && <p style={muted}>None.</p>}
      {(data.recent_entries ?? []).map((e) => (
        <div key={e.id} style={detailRow}>
          <span>#{e.scouted_team_number} <span style={{ color: 'var(--text-muted)' }}>rel {e.reliability ?? '—'}</span></span>
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{fmtDate(e.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Users ────────────────────────────────────────────────────────────────────
function UsersTab({ admin }) {
  const { loading, error, data } = useAsync(admin.listUsers)
  const [q, setQ] = useState('')
  if (loading || error) return <Status loading={loading} error={error} />

  const all = data.users ?? []
  const needle = q.trim().toLowerCase()
  const users = needle
    ? all.filter((u) =>
      (u.email || '').toLowerCase().includes(needle) ||
      (u.display_name || '').toLowerCase().includes(needle) ||
      u.teams.some((t) => t.team_number.toLowerCase().includes(needle)))
    : all

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search email, name, or team…"
        style={search}
      />
      <p style={{ ...muted, margin: '0 0 8px' }}>{users.length} of {all.length}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {users.map((u) => (
          <div key={u.user_id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '14px', wordBreak: 'break-all' }}>{u.display_name || u.email}</span>
              {u.has_2fa && <span style={pill}>2FA</span>}
            </div>
            {u.display_name && <p style={{ ...muted, margin: '2px 0 0', wordBreak: 'break-all' }}>{u.email}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {u.teams.length === 0 && <span style={muted}>No team</span>}
              {u.teams.map((t) => (
                <span key={t.team_number} style={teamChip}>
                  {t.team_number}{t.role === 'admin' ? ' ·admin' : ''}
                </span>
              ))}
            </div>
            <p style={{ ...muted, margin: '8px 0 0', fontSize: '11px' }}>Joined {fmtDate(u.created_at)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── helpers + styles ─────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return '—' }
}

const h1 = { margin: 0, fontSize: '28px', fontWeight: 800 }
const badge = { fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '6px', padding: '2px 6px' }
const tabBar = { display: 'flex', gap: '8px', marginBottom: '16px' }
const tabBtn = { flex: 1, height: '40px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)' }
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }
const muted = { margin: 0, color: 'var(--text-muted)', fontSize: '13px' }
const statNum = { margin: 0, fontSize: '30px', fontWeight: 800, lineHeight: 1.1 }
const statLabel = { margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }
const rowBtn = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left', gap: '8px' }
const sectionLabel = { margin: '0 0 6px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }
const detailRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', padding: '5px 0', fontSize: '13px', borderBottom: '1px solid var(--border)' }
const pill = { fontSize: '10px', fontWeight: 700, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '6px', padding: '1px 5px', whiteSpace: 'nowrap' }
const teamChip = { fontSize: '12px', fontWeight: 600, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 7px' }
const search = { width: '100%', height: '44px', padding: '0 12px', marginBottom: '10px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '14px', boxSizing: 'border-box' }
