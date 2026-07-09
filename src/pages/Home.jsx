import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../hooks/useTeam'
import { useScoutingEntries } from '../hooks/useScoutingEntries'
import { useEvent } from '../hooks/useEvent'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { getTeamEvents, getTeam, getTeamStats } from '../lib/vexApi'

export default function Home() {
  const { user } = useAuth()
  const { team, loading: teamLoading } = useTeam()
  const { entries } = useScoutingEntries(team)
  const navigate = useNavigate()
  const { activeEvent, vexTeam, matches, matchesLoading, matchesError, selectEvent, clearEvent } =
    useEvent(team?.team_number)

  if (!user) return (
    <Gate message="Sign in to use Live Event Mode." action="Sign in" onAction={() => navigate('/login')} />
  )
  if (teamLoading) return <div style={{ padding: '24px 16px', color: 'var(--text-muted)' }}>Loading…</div>
  if (!team) return (
    <Gate
      message="Join or create a team so Live Event Mode can show your match schedule."
      action="Go to My Team"
      onAction={() => navigate('/my-team')}
    />
  )
  if (!activeEvent) return <EventHome team={team} entries={entries} onSelect={selectEvent} />

  return (
    <MatchSchedule
      event={activeEvent}
      team={team}
      matches={matches}
      loading={matchesLoading}
      error={matchesError}
      entries={entries}
      onChangeEvent={clearEvent}
    />
  )
}

// ── Event picker ──────────────────────────────────────────────────────────────

function EventPicker({ teamNumber, onSelect }) {
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error | notfound
  const [upcomingOnly, setUpcomingOnly] = useState(true)

  // Resolve the team's VEX id, then load the events it's registered for.
  // (The VEX API has no event name-search, so we list the team's own events.)
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    ;(async () => {
      try {
        const t = await getTeam(teamNumber)
        if (cancelled) return
        if (!t?.id) { setStatus('notfound'); return }
        const evs = await getTeamEvents(t.id)
        if (cancelled) return
        setEvents(Array.isArray(evs) ? evs : [])
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [teamNumber])

  // "Upcoming & current" = events that haven't ended yet (end date today or later).
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const visible = upcomingOnly
    ? events.filter(ev => {
        const end = ev.end || ev.start
        return !end || new Date(end) >= todayStart
      })
    : events

  const muted = { color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }

  return (
    <div style={card}>
      <div style={cardHead}><span style={cardTitle}>Load an event</span></div>
      <div style={{ padding: '14px 15px 6px' }}>
        <p style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: '13px' }}>
          Pick an event to load your team's match schedule.
        </p>

        {status === 'ready' && events.length > 0 && (
          <button
            type="button"
            onClick={() => setUpcomingOnly(v => !v)}
            role="switch"
            aria-checked={upcomingOnly}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px',
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              color: 'var(--text)', fontFamily: 'inherit', fontSize: '13px', fontWeight: '600',
            }}
          >
            <span style={{
              width: '38px', height: '22px', borderRadius: '11px', flexShrink: 0,
              background: upcomingOnly ? 'var(--accent)' : 'var(--border)',
              position: 'relative', transition: 'background 0.15s',
            }}>
              <span style={{
                position: 'absolute', top: '2px', left: upcomingOnly ? '18px' : '2px',
                width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                transition: 'left 0.15s',
              }} />
            </span>
            Upcoming &amp; current events only
          </button>
        )}

        {status === 'loading' && <p style={muted}>Loading your team's events…</p>}
        {status === 'error' && <p style={muted}>Couldn't load events — check your connection and try again.</p>}
        {status === 'notfound' && <p style={muted}>Team {teamNumber} wasn't found in the VEX database.</p>}
        {status === 'ready' && events.length === 0 && (
          <p style={muted}>Team {teamNumber} isn't registered for any events yet.</p>
        )}
        {status === 'ready' && events.length > 0 && visible.length === 0 && (
          <p style={muted}>No upcoming events — turn off the filter to see past events.</p>
        )}

        <div>
          {visible.map((event, i) => {
            const city = [event.location?.city, event.location?.region].filter(Boolean).join(', ')
            const date = event.start
              ? new Date(event.start).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
              : null
            return (
              <button
                key={event.id}
                onClick={() => onSelect(event)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'transparent', border: 'none',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  padding: '12px 2px', cursor: 'pointer',
                }}
              >
                <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>
                  {event.name}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  {[city, date].filter(Boolean).join(' · ')}
                </p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Event home (no active event: event picker + scouting modules) ─────────────

function EventHome({ team, entries, onSelect }) {
  const isDesktop = useMediaQuery('(min-width: 900px)')
  const online = useOnlineStatus()
  const myNumber = team.team_number?.toUpperCase()
  const { pending, reports, teamsScouted, scoutsToday } = deriveStats(entries)

  const pickerBlock = <EventPicker teamNumber={team.team_number} onSelect={onSelect} />
  const snapshotBlock = <TeamSnapshot reports={reports} teamsScouted={teamsScouted} scoutsToday={scoutsToday} />
  const recentBlock = <RecentScouting entries={entries} />
  const offlineBlock = <OfflineQueue pending={pending} online={online} />
  const lookupBlock = <QuickLookup entries={entries} />

  return (
    <div className="home-dash">
      <div style={{ marginBottom: '18px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: '800' }}>Live Event Mode</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Team {myNumber}</span>
          <StatusPill online={online} pending={pending.length} />
        </div>
      </div>

      {isDesktop ? (
        <div className="home-grid">
          <div className="home-col">{pickerBlock}{recentBlock}{offlineBlock}</div>
          <div className="home-col">{snapshotBlock}{lookupBlock}</div>
        </div>
      ) : (
        <div className="home-grid">
          {pickerBlock}{snapshotBlock}{recentBlock}{offlineBlock}{lookupBlock}
        </div>
      )}
    </div>
  )
}

// ── Match schedule ────────────────────────────────────────────────────────────

function MatchSchedule({ event, team, matches, loading, error, entries, onChangeEvent }) {
  const [activeTeam, setActiveTeam] = useState(null) // { number, matchId }
  const isDesktop = useMediaQuery('(min-width: 900px)')
  const online = useOnlineStatus()

  const myNumber = team.team_number?.toUpperCase()

  const upcoming = [...matches]
    .filter(m => !m.scored)
    .sort((a, b) => (a.scheduled ?? '').localeCompare(b.scheduled ?? ''))

  const past = [...matches]
    .filter(m => m.scored)
    .sort((a, b) => (b.scheduled ?? '').localeCompare(a.scheduled ?? ''))

  // Real scouting stats derived from this team's entries — no fabricated numbers.
  const { pending, reports, teamsScouted, scoutsToday } = deriveStats(entries)

  function toggleTeam(teamNumber, matchId) {
    setActiveTeam(prev =>
      prev?.number === teamNumber && prev?.matchId === matchId ? null : { number: teamNumber, matchId }
    )
  }

  const matchesBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {loading && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading schedule…</p>}
      {error && <p style={{ color: '#ef4444', fontSize: '14px' }}>Failed to load: {error}</p>}

      {!loading && upcoming.length > 0 && (
        <div>
          <p style={sectionLabel}>Next matches</p>
          <div style={{
            maxHeight: 'clamp(340px, 56vh, 600px)', overflowY: 'auto',
            padding: '8px', border: '1px solid var(--border)', borderRadius: '12px',
            scrollbarWidth: 'thin',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {upcoming.map((m, i) => (
                <MatchCard key={m.id} match={m} myNumber={myNumber} isNext={i === 0}
                  activeTeam={activeTeam} onToggleTeam={toggleTeam} entries={entries} />
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && past.length > 0 && (
        <div>
          <p style={sectionLabel}>Results</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {past.map(m => (
              <MatchCard key={m.id} match={m} myNumber={myNumber} isNext={false}
                activeTeam={activeTeam} onToggleTeam={toggleTeam} entries={entries} />
            ))}
          </div>
        </div>
      )}

      {!loading && !error && matches.length === 0 && (
        <div style={{ ...card, padding: '28px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
            No matches found for team {myNumber} at this event.<br />
            Matches may not be posted yet.
          </p>
        </div>
      )}
    </div>
  )

  const queueBlock = <QueueHero upcoming={upcoming} />
  const snapshotBlock = <TeamSnapshot reports={reports} teamsScouted={teamsScouted} scoutsToday={scoutsToday} />
  const recentBlock = <RecentScouting entries={entries} />
  const offlineBlock = <OfflineQueue pending={pending} online={online} />
  const lookupBlock = <QuickLookup entries={entries} />

  return (
    <div className="home-dash">
      {/* Header (no top nav, no brand wordmark) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={sectionLabel}>Live event</p>
          <h1 style={{ margin: '2px 0 8px', fontSize: '22px', fontWeight: '800', lineHeight: 1.2 }}>
            {event.name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Team {myNumber}</span>
            <StatusPill online={online} pending={pending.length} />
          </div>
        </div>
        <button
          onClick={onChangeEvent}
          style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '7px',
            background: 'rgba(204,0,0,0.10)', border: '1px solid var(--accent)',
            color: 'var(--accent)', borderRadius: '9px', padding: '9px 14px',
            fontSize: '13px', fontWeight: '700', cursor: 'pointer',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 4 3 8l4 4" />
            <path d="M3 8h13a4 4 0 0 1 4 4" />
            <path d="m17 20 4-4-4-4" />
            <path d="M21 16H8a4 4 0 0 1-4-4" />
          </svg>
          Change event
        </button>
      </div>

      {isDesktop ? (
        <div className="home-grid">
          <div className="home-col">{matchesBlock}{recentBlock}{offlineBlock}</div>
          <div className="home-col">{queueBlock}{snapshotBlock}{lookupBlock}</div>
        </div>
      ) : (
        <div className="home-grid">
          {queueBlock}{matchesBlock}{snapshotBlock}{recentBlock}{offlineBlock}{lookupBlock}
        </div>
      )}
    </div>
  )
}

// ── Online / pending status pill ──────────────────────────────────────────────

function StatusPill({ online, pending }) {
  const color = online ? '#22c55e' : '#f59e0b'
  const bg = online ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 9px', borderRadius: '999px', background: bg, color, fontSize: '11px', fontWeight: '700' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
      {online ? 'Online' : 'Offline'}{pending > 0 ? ` · ${pending} pending` : ''}
    </span>
  )
}

// ── Time to Queue (live countdown to the next scheduled match) ─────────────────

function QueueHero({ upcoming }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // `upcoming` is unscored matches sorted by scheduled time ascending. Anchor to
  // the EARLIEST unscored match that has a time — not the first one still in the
  // future — so a match that's running late stays on screen as "overdue" instead
  // of silently vanishing. When it finally gets scored it drops out of `upcoming`
  // and the anchor advances to the next one on its own.
  const next = upcoming.find(m => m.scheduled)
  const untimed = !next && upcoming.length > 0 ? upcoming[0] : null

  const diffSec = next ? Math.floor((new Date(next.scheduled).getTime() - now) / 1000) : null
  const overdue = diffSec != null && diffSec <= 0
  const urgent = diffSec != null && diffSec > 0 && diffSec <= 300
  const lateSec = overdue ? -diffSec : 0

  let display = '—'
  if (overdue) {
    display = 'Now'
  } else if (diffSec != null) {
    if (diffSec >= 3600) {
      display = `${Math.floor(diffSec / 3600)}h ${Math.floor((diffSec % 3600) / 60)}m`
    } else {
      const m = Math.floor(diffSec / 60), s = diffSec % 60
      display = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
  }

  const lateStr = lateSec >= 60 ? `${Math.floor(lateSec / 60)}m late` : `${lateSec}s late`
  const glow = overdue
    ? 'radial-gradient(120% 90% at 50% -10%, rgba(239,68,68,0.16), transparent 70%)'
    : next ? 'radial-gradient(120% 90% at 50% -10%, rgba(204,0,0,0.10), transparent 70%)' : 'transparent'

  return (
    <div style={card}>
      <div style={{ textAlign: 'center', padding: '22px 18px', background: glow }}>
        <p style={{ ...cardTitle, margin: 0 }}>Time to Queue</p>
        {next ? (
          <>
            <p style={{ margin: '8px 0 4px', fontSize: overdue ? '44px' : '54px', fontWeight: '800', color: overdue ? '#ef4444' : 'var(--accent)', lineHeight: 1.02, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{display}</p>
            {overdue ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '4px 11px', borderRadius: '999px', background: 'rgba(239,68,68,0.16)', color: '#ef4444', fontWeight: '700', fontSize: '11.5px' }}>
                ▶ Queue now{lateSec > 0 ? ` · ${lateStr}` : ''}
              </span>
            ) : urgent ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '4px 11px', borderRadius: '999px', background: 'rgba(245,158,11,0.14)', color: '#f59e0b', fontWeight: '700', fontSize: '11.5px' }}>⚠ Leave now</span>
            ) : null}
            <p style={{ margin: '6px auto 0', color: 'var(--text-muted)', fontSize: '13px', maxWidth: '30ch' }}>
              {overdue ? 'Should be up' : 'Head to the field queue'} for <b style={{ color: 'var(--text)' }}>{next.name ?? `Match ${next.matchnum}`}</b>.
            </p>
          </>
        ) : untimed ? (
          <>
            <p style={{ margin: '10px 0 4px', fontSize: '20px', fontWeight: '800', color: 'var(--text)' }}>
              {untimed.name ?? `Match ${untimed.matchnum}`}
            </p>
            <p style={{ margin: '2px auto 0', color: 'var(--text-muted)', fontSize: '13px', maxWidth: '30ch' }}>Up next — start time not posted yet.</p>
          </>
        ) : (
          <p style={{ margin: '12px 0 2px', color: 'var(--text-muted)', fontSize: '14px' }}>No upcoming matches.</p>
        )}
      </div>
    </div>
  )
}

// ── Team snapshot (real scouting stats) ───────────────────────────────────────

function TeamSnapshot({ reports, teamsScouted, scoutsToday }) {
  const stats = [
    [reports, 'Reports'],
    [teamsScouted, 'Teams scouted'],
    [scoutsToday, 'Scouts today'],
  ]
  return (
    <div style={card}>
      <div style={cardHead}><span style={cardTitle}>Team Snapshot</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {stats.map(([n, l], i) => (
          <div key={l} style={{ textAlign: 'center', padding: '16px 6px', borderLeft: i === 0 ? 'none' : '1px solid var(--border)' }}>
            <p style={{ margin: 0, fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{n}</p>
            <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-muted)' }}>{l}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Recent scouting (latest reports) ──────────────────────────────────────────

function RecentScouting({ entries }) {
  const recent = [...entries]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 3)
  if (recent.length === 0) return null
  return (
    <div style={card}>
      <div style={cardHead}>
        <span style={cardTitle}>Recent Scouting</span>
        <Link to="/my-team" style={cardLink}>View all</Link>
      </div>
      <div>
        {recent.map((e, i) => <RecentScoutRow key={e.id ?? e._local_id ?? i} entry={e} first={i === 0} />)}
      </div>
    </div>
  )
}

function RecentScoutRow({ entry, first }) {
  const team = (entry.scouted_team_number ?? entry.teamNumber ?? '?').toUpperCase()
  const tags = scoutTags(entry)
  const rel = entry.reliability
  return (
    <Link to={`/search?q=${encodeURIComponent(team)}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 15px', textDecoration: 'none', color: 'inherit', borderTop: first ? 'none' : '1px solid var(--border)' }}>
      <span style={{ fontWeight: '800', fontSize: '14px', width: '52px', flexShrink: 0 }}>{team}</span>
      <span style={{ flex: 1, minWidth: 0, color: 'var(--text-muted)', fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {tags.join(' · ') || 'Scouting report'}
      </span>
      {rel != null && <RelMeter rel={rel} />}
    </Link>
  )
}

// ── Offline queue (pending localStorage entries) ──────────────────────────────

function OfflineQueue({ pending, online }) {
  return (
    <div style={card}>
      <div style={cardHead}>
        <span style={cardTitle}>Offline Queue</span>
        <span style={{ ...cardTitle, color: 'var(--text-muted)' }}>{pending.length} waiting</span>
      </div>
      {pending.length === 0 ? (
        <div style={{ padding: '18px 15px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
          <span style={{ color: '#22c55e', fontWeight: '800' }}>✓</span> All caught up — nothing waiting to sync.
        </div>
      ) : (
        <div>
          {pending.slice(0, 4).map((e, i) => (
            <div key={e._local_id ?? e.id ?? i} style={{ padding: '11px 15px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <p style={{ margin: 0, fontWeight: '700', fontSize: '13px' }}>
                {(e.scouted_team_number ?? e.teamNumber ?? '?').toUpperCase()}
                <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}> · saved {timeAgo(e.created_at)}</span>
              </p>
              <p style={{ margin: '1px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>{scoutTags(e).join(', ') || 'Scouting report'}</p>
            </div>
          ))}
          <div style={{ padding: '11px 15px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '12px' }}>
            {online ? 'Syncing…' : "Syncs automatically when you're back online."}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Quick lookup (entry point into Search) ────────────────────────────────────

function QuickLookup({ entries }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const recentTeams = [...new Set(
    [...entries]
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      .map(e => (e.scouted_team_number ?? e.teamNumber)?.toUpperCase())
      .filter(Boolean)
  )].slice(0, 4)

  function submit(e) {
    e.preventDefault()
    const v = q.trim()
    if (v) navigate(`/search?q=${encodeURIComponent(v)}`)
  }

  return (
    <div style={card}>
      <div style={cardHead}><span style={cardTitle}>Quick Lookup</span></div>
      <form onSubmit={submit} style={{ padding: '13px 15px 6px' }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search a team or event…"
          style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </form>
      {recentTeams.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px 15px 15px' }}>
          {recentTeams.map(t => (
            <button
              key={t}
              onClick={() => navigate(`/search?q=${encodeURIComponent(t)}`)}
              style={{ fontSize: '12px', fontWeight: '700', padding: '5px 10px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Match card ────────────────────────────────────────────────────────────────

function MatchCard({ match, myNumber, isNext, activeTeam, onToggleTeam, entries }) {
  const red = (match.alliances ?? []).find(a => a.color === 'red')
  const blue = (match.alliances ?? []).find(a => a.color === 'blue')

  const scoreStr = match.scored
    ? `${red?.score ?? '?'} – ${blue?.score ?? '?'}`
    : null

  return (
    <div style={{
      background: isNext ? 'rgba(204,0,0,0.08)' : 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: isNext ? 'inset 3px 0 0 var(--accent)' : 'none',
    }}>
      {/* Match header row */}
      <div style={{ padding: '10px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', fontWeight: '700', color: isNext ? 'var(--accent)' : 'var(--text-muted)' }}>
          {match.name ?? `Match ${match.matchnum}`}
        </span>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {scoreStr && <span style={{ fontSize: '13px', fontWeight: '700' }}>{scoreStr}</span>}
          {match.scheduled && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {formatMatchTime(match.scheduled)}
            </span>
          )}
        </div>
      </div>

      {/* Alliances */}
      <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <AllianceRow alliance={red} color="red" myNumber={myNumber} activeTeam={activeTeam} matchId={match.id} onToggle={onToggleTeam} />
        <AllianceRow alliance={blue} color="blue" myNumber={myNumber} activeTeam={activeTeam} matchId={match.id} onToggle={onToggleTeam} />
      </div>

      {/* Inline scouting panel */}
      {activeTeam?.matchId === match.id && (
        <TeamSummary
          teamNumber={activeTeam.number}
          entries={entries}
          onClose={() => onToggleTeam(activeTeam.number, match.id)}
        />
      )}
    </div>
  )
}

// ── Alliance row ──────────────────────────────────────────────────────────────

function AllianceRow({ alliance, color, myNumber, activeTeam, matchId, onToggle }) {
  if (!alliance) return null
  const teams = (alliance.teams ?? []).filter(t => !t.sitting)
  const accentColor = color === 'red' ? '#ef4444' : '#3b82f6'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ width: '28px', fontSize: '10px', fontWeight: '700', color: accentColor, textTransform: 'uppercase', flexShrink: 0 }}>
        {color}
      </span>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {teams.map(({ team }) => {
          const num = (team?.number ?? team?.name ?? '?').toUpperCase()
          const isMe = num === myNumber
          const isActive = activeTeam?.number === num && activeTeam?.matchId === matchId
          return (
            <button
              key={team?.id ?? num}
              onClick={() => onToggle(num, matchId)}
              style={{
                height: '32px', padding: '0 10px', borderRadius: '8px',
                fontSize: '13px', fontWeight: isMe ? '800' : '600', cursor: 'pointer',
                background: isMe ? accentColor : isActive ? 'rgba(204,0,0,0.08)' : 'var(--surface-2)',
                color: isMe ? '#fff' : isActive ? 'var(--accent)' : 'var(--text)',
                border: `1.5px solid ${isActive ? 'var(--accent)' : isMe ? accentColor : 'var(--border)'}`,
              }}
            >
              {num}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Team summary panel ────────────────────────────────────────────────────────

function TeamSummary({ teamNumber, entries, onClose }) {
  const teamEntries = entries
    .filter(e => (e.scouted_team_number ?? e.teamNumber)?.toUpperCase() === teamNumber)
    .slice(0, 3)

  const [vexStats, setVexStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    if (teamEntries.length > 0) return
    setStatsLoading(true)
    getTeam(teamNumber)
      .then(t => t && getTeamStats(t.id))
      .then(s => s && setVexStats(s))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [teamNumber])

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px 14px', background: 'rgba(0,0,0,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: '800' }}>{teamNumber}</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
        >
          ×
        </button>
      </div>

      {teamEntries.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {teamEntries.map((e, i) => <ScoutRow key={e.id ?? e._local_id ?? i} entry={e} />)}
          <Link
            to={`/search?q=${teamNumber}`}
            style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', marginTop: '4px' }}
          >
            Full profile →
          </Link>
        </div>
      ) : (
        <div>
          {statsLoading ? (
            <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-muted)' }}>Loading stats…</p>
          ) : vexStats ? (
            <VexStatsSummary stats={vexStats} />
          ) : (
            <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-muted)' }}>No public data yet.</p>
          )}
          <Link
            to={`/scout?team=${teamNumber}`}
            style={{
              display: 'inline-block', marginTop: '8px',
              height: '32px', lineHeight: '32px', padding: '0 14px',
              background: 'var(--accent)', color: '#fff',
              borderRadius: '8px', fontSize: '13px', fontWeight: '700',
              textDecoration: 'none',
            }}
          >
            Scout {teamNumber} →
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Scout row (scouting summary in the panel) ─────────────────────────────────

function ScoutRow({ entry }) {
  const tags = scoutTags(entry)
  const rel = entry.reliability

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
      <span style={{ flex: 1, minWidth: 0, color: 'var(--text-muted)' }}>
        {tags.join(' · ')}
        {entry.note && <span style={{ fontStyle: 'italic' }}> · {entry.note}</span>}
      </span>
      {rel != null && <RelMeter rel={rel} />}
    </div>
  )
}

// ── VEX public stats fallback ─────────────────────────────────────────────────

function VexStatsSummary({ stats }) {
  let wins = 0, losses = 0, ties = 0
  for (const r of stats.rankings ?? []) {
    wins   += r.wins   ?? 0
    losses += r.losses ?? 0
    ties   += r.ties   ?? 0
  }
  const record = wins + losses + ties > 0 ? `${wins}W–${losses}L–${ties}T` : null

  const bestSkills = (stats.skills ?? [])
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]

  return (
    <div style={{ display: 'flex', gap: '20px', marginBottom: '4px' }}>
      {record && (
        <div>
          <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Record</p>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>{record}</p>
        </div>
      )}
      {bestSkills && (
        <div>
          <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Skills</p>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>{bestSkills.score}</p>
        </div>
      )}
      {!record && !bestSkills && (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>No public stats found.</p>
      )}
    </div>
  )
}

// ── Gate screen ───────────────────────────────────────────────────────────────

function Gate({ message, action, onAction }) {
  return (
    <div style={{ padding: '24px 16px', maxWidth: '560px', margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 24px', fontSize: '26px', fontWeight: '800' }}>Live Event Mode</h1>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 20px', fontSize: '15px', lineHeight: 1.5 }}>{message}</p>
        <button
          onClick={onAction}
          style={{ height: '52px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', width: '100%' }}
        >
          {action}
        </button>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMatchTime(scheduled) {
  const d = new Date(scheduled)
  if (isNaN(d)) return ''
  const isToday = d.toDateString() === new Date().toDateString()
  return isToday
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' +
      d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// Reliability (1–5) → semantic colour, kept distinct from the red brand accent.
function relColor(r) {
  return r >= 4 ? '#22c55e' : r === 3 ? '#f59e0b' : '#ef4444'
}

const sectionLabel = {
  margin: '0 0 10px',
  color: 'var(--text-muted)',
  fontSize: '12px',
  fontWeight: '700',
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
}

// Shared dashboard card primitives (mirrors the approved mockup's card system).
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }
const cardHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', borderBottom: '1px solid var(--border)' }
const cardTitle = { fontSize: '11.5px', fontWeight: '700', letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const cardLink = { fontSize: '11.5px', fontWeight: '700', color: 'var(--accent)', textDecoration: 'none' }

// Human-readable scouting tags from a raw entry (shared by ScoutRow, RecentScoutRow, OfflineQueue).
function scoutTags(entry) {
  const DRIVE  = { tank: 'Tank', mecanum: 'Mecanum', xdrive: 'X-drive', other: 'Other' }
  const INTAKE = { strong: 'Strong', okay: 'Okay', weak: 'Weak', none: 'None' }
  const SCORE  = { fast: 'Fast', average: 'Average', slow: 'Slow', cant_tell: '?' }
  return [DRIVE[entry.drivetrain], INTAKE[entry.intake], SCORE[entry.scoring]].filter(Boolean)
}

function isToday(iso) {
  if (!iso) return false
  const d = new Date(iso)
  return !isNaN(d) && d.toDateString() === new Date().toDateString()
}

// Real scouting stats from a team's entries (shared by the event + no-event views).
function deriveStats(entries) {
  return {
    pending: entries.filter(e => !e._synced),
    reports: entries.length,
    teamsScouted: new Set(
      entries.map(e => (e.scouted_team_number ?? e.teamNumber)?.toUpperCase()).filter(Boolean)
    ).size,
    scoutsToday: new Set(
      entries.filter(e => isToday(e.created_at)).map(e => e.created_by).filter(Boolean)
    ).size,
  }
}

function timeAgo(iso) {
  if (!iso) return 'just now'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// Compact reliability meter (1–5) with a semantic fill colour.
function RelMeter({ rel }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
      <span style={{ width: '34px', height: '5px', borderRadius: '3px', background: 'var(--surface-2)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${(rel / 5) * 100}%`, background: relColor(rel), borderRadius: '3px' }} />
      </span>
      <span style={{ fontWeight: '800', fontSize: '12px', width: '14px', textAlign: 'right' }}>{rel}</span>
    </span>
  )
}
