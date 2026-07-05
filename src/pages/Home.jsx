import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../hooks/useTeam'
import { useScoutingEntries } from '../hooks/useScoutingEntries'
import { useEvent } from '../hooks/useEvent'
import { searchEvents, getTeam, getTeamStats } from '../lib/vexApi'

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
  if (!activeEvent) return <EventPicker teamNumber={team.team_number} onSelect={selectEvent} />

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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [upcomingOnly, setUpcomingOnly] = useState(true)

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      const events = await searchEvents(query.trim())
      setResults(Array.isArray(events) ? events : [])
    } catch {
      setResults([])
    } finally {
      setSearched(true)
      setSearching(false)
    }
  }

  // "Upcoming & current" = events that haven't ended yet (end date today or later).
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const visible = upcomingOnly
    ? results.filter(ev => {
        const end = ev.end || ev.start
        return !end || new Date(end) >= todayStart
      })
    : results

  return (
    <div style={{ padding: '20px 16px 32px', maxWidth: '560px', margin: '0 auto' }}>
      <p style={sectionLabel}>VERALIS</p>
      <h1 style={{ margin: '4px 0 4px', fontSize: '26px', fontWeight: '800' }}>Live Event Mode</h1>
      <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: '14px' }}>
        Team {teamNumber} · Search for your event to load your match schedule.
      </p>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by event name or city…"
          style={{
            flex: 1, height: '48px', padding: '0 14px',
            background: 'var(--surface)', border: '1.5px solid var(--border)',
            borderRadius: '10px', color: 'var(--text)', fontSize: '15px',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          style={{
            height: '48px', padding: '0 20px', background: 'var(--accent)',
            color: '#fff', border: 'none', borderRadius: '10px',
            fontSize: '15px', fontWeight: '700',
            cursor: searching || !query.trim() ? 'default' : 'pointer',
            opacity: searching || !query.trim() ? 0.6 : 1,
          }}
        >
          {searching ? '…' : 'Search'}
        </button>
      </form>

      {searched && (
        <button
          type="button"
          onClick={() => setUpcomingOnly(v => !v)}
          role="switch"
          aria-checked={upcomingOnly}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px',
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

      {searched && results.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
          No events found — try a shorter name or city.
        </p>
      )}

      {searched && results.length > 0 && visible.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
          No upcoming events found — turn off the filter to see past events.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visible.map(event => {
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
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '14px 16px', cursor: 'pointer',
              }}
            >
              <p style={{ margin: '0 0 2px', fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>
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
  )
}

// ── Match schedule ────────────────────────────────────────────────────────────

function MatchSchedule({ event, team, matches, loading, error, entries, onChangeEvent }) {
  const [activeTeam, setActiveTeam] = useState(null) // { number, matchId }
  const [queueAlert, setQueueAlert] = useState(null)

  const myNumber = team.team_number?.toUpperCase()

  const upcoming = [...matches]
    .filter(m => !m.scored)
    .sort((a, b) => (a.scheduled ?? '').localeCompare(b.scheduled ?? ''))

  const past = [...matches]
    .filter(m => m.scored)
    .sort((a, b) => (b.scheduled ?? '').localeCompare(a.scheduled ?? ''))

  // 5-min queue alert — re-checks every 30 s
  useEffect(() => {
    function check() {
      for (const m of upcoming) {
        if (!m.scheduled) continue
        const mins = (new Date(m.scheduled) - Date.now()) / 60000
        if (mins > 0 && mins <= 5) {
          setQueueAlert({ name: m.name ?? `Match ${m.matchnum}`, mins: Math.ceil(mins) })
          return
        }
      }
      setQueueAlert(null)
    }
    check()
    const id = setInterval(check, 30000)
    return () => clearInterval(id)
  }, [upcoming])

  function toggleTeam(teamNumber, matchId) {
    setActiveTeam(prev =>
      prev?.number === teamNumber && prev?.matchId === matchId ? null : { number: teamNumber, matchId }
    )
  }

  return (
    <div style={{ padding: '20px 16px 80px', maxWidth: '560px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '12px' }}>
        <div>
          <p style={sectionLabel}>VERALIS · LIVE</p>
          <h1 style={{ margin: '2px 0 2px', fontSize: '20px', fontWeight: '800', lineHeight: 1.2 }}>
            {event.name}
          </h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Team {myNumber}</p>
        </div>
        <button
          onClick={onChangeEvent}
          style={{
            flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', borderRadius: '8px', padding: '6px 12px',
            fontSize: '12px', cursor: 'pointer',
          }}
        >
          Change event
        </button>
      </div>

      {/* Queue alert banner */}
      {queueAlert && (
        <div style={{
          background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.5)',
          borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span style={{ fontSize: '20px' }}>⏱</span>
          <div>
            <p style={{ margin: 0, fontWeight: '800', fontSize: '15px', color: '#ef4444' }}>
              Queue in {queueAlert.mins} min — {queueAlert.name}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(239,68,68,0.75)' }}>
              Head to the queuing area now
            </p>
          </div>
        </div>
      )}

      {loading && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading schedule…</p>}
      {error && <p style={{ color: '#ef4444', fontSize: '14px' }}>Failed to load: {error}</p>}

      {/* Upcoming */}
      {!loading && upcoming.length > 0 && (
        <>
          <p style={sectionLabel}>Upcoming matches</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
            {upcoming.map((m, i) => (
              <MatchCard
                key={m.id}
                match={m}
                myNumber={myNumber}
                isNext={i === 0}
                activeTeam={activeTeam}
                onToggleTeam={toggleTeam}
                entries={entries}
              />
            ))}
          </div>
        </>
      )}

      {/* Results */}
      {!loading && past.length > 0 && (
        <>
          <p style={sectionLabel}>Results</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {past.map(m => (
              <MatchCard
                key={m.id}
                match={m}
                myNumber={myNumber}
                isNext={false}
                activeTeam={activeTeam}
                onToggleTeam={toggleTeam}
                entries={entries}
              />
            ))}
          </div>
        </>
      )}

      {!loading && !error && matches.length === 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '28px 20px', textAlign: 'center',
        }}>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
            No matches found for team {myNumber} at this event.<br />
            Matches may not be posted yet.
          </p>
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
      background: 'var(--surface)',
      border: `1.5px solid ${isNext ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: '12px',
      overflow: 'hidden',
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
  const DRIVE  = { tank: 'Tank', mecanum: 'Mecanum', xdrive: 'X-drive', other: 'Other' }
  const INTAKE = { strong: 'Strong', okay: 'Okay', weak: 'Weak', none: 'None' }
  const SCORE  = { fast: 'Fast', average: 'Average', slow: 'Slow', cant_tell: '?' }
  const tags = [DRIVE[entry.drivetrain], INTAKE[entry.intake], SCORE[entry.scoring]].filter(Boolean)
  const stars = entry.reliability
    ? '★'.repeat(entry.reliability) + '☆'.repeat(5 - entry.reliability)
    : null

  return (
    <div style={{ fontSize: '13px' }}>
      {tags.length > 0 && <span style={{ color: 'var(--text-muted)' }}>{tags.join(' · ')}</span>}
      {stars && <span style={{ color: '#f59e0b', marginLeft: '8px', fontSize: '11px', letterSpacing: '1px' }}>{stars}</span>}
      {entry.note && <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{entry.note}</span>}
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
      <p style={sectionLabel}>VERALIS</p>
      <h1 style={{ margin: '4px 0 24px', fontSize: '26px', fontWeight: '800' }}>Live Event Mode</h1>
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

const sectionLabel = {
  margin: '0 0 6px',
  color: 'var(--text-muted)',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}
