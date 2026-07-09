import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../hooks/useTeam'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { supabase } from '../lib/supabase'
import { searchTeams, getTeamStats, getTeamSeasonMatches } from '../lib/vexApi'
import { computeTeamRating } from '../lib/rating'

const DRIVETRAIN_LABELS = { tank: 'Tank', mecanum: 'Mecanum', xdrive: 'X-drive', other: 'Other/unsure' }
const INTAKE_LABELS    = { strong: 'Strong', okay: 'Okay', weak: 'Weak', none: 'None/unsure' }
const SCORING_LABELS   = { fast: 'Fast', average: 'Average', slow: 'Slow', cant_tell: "Couldn't tell" }
const AUTO_LABELS      = { strong: 'Strong', works: 'Works', weak_none: 'Weak/none', didnt_see: "Didn't see" }
const DEFENSE_LABELS   = { folds: 'Folds', handles: 'Handles it', unstoppable: 'Unstoppable', didnt_see: "Didn't see" }
const DRIVER_LABELS    = { struggles: 'Struggles', decent: 'Decent', skilled: 'Skilled', didnt_see: "Didn't see" }
const STABILITY_LABELS = { tippy: 'Tippy', solid: 'Solid', rock_solid: 'Rock-solid' }
const THREAT_META      = { low: { label: 'Low', color: '#22c55e' }, medium: { label: 'Medium', color: '#f59e0b' }, high: { label: 'High', color: '#fb923c' }, must_scout: { label: 'Must-scout', color: 'var(--accent)' } }

export default function Search() {
  const { user } = useAuth()
  const { team } = useTeam()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [program, setProgram] = useState('VRC')
  const [results, setResults] = useState(null) // null = not searched yet
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)

  // expanded = VEX internal team id; expandedData keyed by same id
  const [expandedId, setExpandedId] = useState(null)
  const [expandedData, setExpandedData] = useState({})

  const [searchParams] = useSearchParams()

  // Arrived via /search?q=… (Quick Lookup, "Full profile" / recent-scouting
  // links): pre-fill the box and run the search automatically.
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setQuery(q)
      runSearch(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  if (!user) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: '560px', margin: '0 auto' }}>
        <p style={label}>Teams</p>
        <h1 style={h1}>Search</h1>
        <div style={card}>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.5, margin: '0 0 20px' }}>
            Sign in to search for any VEX team.
          </p>
          <button onClick={() => navigate('/login')} className="v-btn v-btn-accent" style={{ ...btnPrimary, width: '100%' }}>
            Sign in
          </button>
        </div>
      </div>
    )
  }

  async function runSearch(rawQuery, prog = program) {
    const q = (rawQuery ?? '').trim()
    if (!q) return
    setSearching(true)
    setSearchError(null)
    setResults(null)
    setExpandedId(null)
    try {
      const teams = await searchTeams(q, prog)
      setResults(teams)
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }

  function handleSearch(e) {
    e?.preventDefault()
    runSearch(query, program)
  }

  async function toggleExpand(vexTeam) {
    const id = vexTeam.id
    if (expandedId === id) { setExpandedId(null); return }

    setExpandedId(id)
    if (expandedData[id]) return // already loaded

    // Mark as loading
    setExpandedData(prev => ({ ...prev, [id]: { loading: true } }))

    try {
      // Fetch VEX stats, scouting entries, and this + last season's matches in parallel
      const [stats, scoutingRes, seasonMatches, prevMatches] = await Promise.allSettled([
        getTeamStats(id),
        supabase
          .from('scouting_entries')
          .select('*')
          .eq('scouted_team_number', vexTeam.number)
          .order('created_at', { ascending: false }),
        getTeamSeasonMatches(id, program),
        getTeamSeasonMatches(id, program, 'previous'),
      ])

      const rating = seasonMatches.status === 'fulfilled'
        ? computeTeamRating(seasonMatches.value ?? [], vexTeam.number)
        : null
      const prevRating = prevMatches.status === 'fulfilled'
        ? computeTeamRating(prevMatches.value ?? [], vexTeam.number)
        : null

      setExpandedData(prev => ({
        ...prev,
        [id]: {
          loading: false,
          stats: stats.status === 'fulfilled' ? stats.value : null,
          statsError: stats.status === 'rejected' ? stats.reason?.message : null,
          scouting: scoutingRes.status === 'fulfilled' ? (scoutingRes.value.data ?? []) : [],
          rating,
          prevRating,
        },
      }))
    } catch (err) {
      setExpandedData(prev => ({ ...prev, [id]: { loading: false, error: err.message } }))
    }
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: '560px', margin: '0 auto' }}>
      <p style={label}>Teams</p>
      <h1 style={h1}>Search</h1>

      {/* Search form */}
      <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Team number or name (e.g. 16858A or Waga)"
          autoComplete="off"
          maxLength={100}
          style={{ ...inputStyle, fontSize: '17px' }}
        />

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {['VRC', 'VEXU', 'IQ'].map(p => (
            <button
              key={p}
              type="button"
              className="v-btn" onClick={() => setProgram(p)}
              style={{
                height: '34px', padding: '0 14px', borderRadius: '8px',
                fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                background: program === p ? 'var(--accent)' : 'transparent',
                color: program === p ? '#fff' : 'var(--text-muted)',
                border: `1px solid ${program === p ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          type="submit"
          className="v-btn v-btn-accent" disabled={searching || !query.trim()}
          style={{ ...btnPrimary, width: '100%', opacity: searching || !query.trim() ? 0.5 : 1 }}
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* Search error */}
      {searchError && (
        <div style={{ ...card, borderColor: 'rgba(248,113,113,0.25)', marginBottom: '12px' }}>
          <p style={{ margin: 0, color: '#f87171', fontSize: '14px' }}>{searchError}</p>
        </div>
      )}

      {/* No results */}
      {results?.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
          No teams found for "{query}" in {program}.
        </p>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {results.map(vexTeam => (
            <TeamCard
              key={vexTeam.id}
              vexTeam={vexTeam}
              expanded={expandedId === vexTeam.id}
              expandedData={expandedData[vexTeam.id]}
              hasTeam={!!team}
              teamId={team?.id}
              onToggle={() => toggleExpand(vexTeam)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Individual team result card ───────────────────────────────────────────────

function TeamCard({ vexTeam, expanded, expandedData, hasTeam, teamId, onToggle }) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const loc = [vexTeam.location?.city, vexTeam.location?.region]
    .filter(Boolean).join(', ')
  const programName = vexTeam.program?.name ?? null

  return (
    <div style={{
      ...card,
      cursor: 'pointer',
      border: `1px solid ${expanded ? 'rgba(204,0,0,0.4)' : 'var(--border)'}`,
      transition: 'border-color 150ms',
    }}>
      {/* Collapsed header — always visible, tap to expand */}
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '0.01em' }}>
              {vexTeam.number}
            </span>
            {vexTeam.team_name && (
              <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '500' }}>
                {vexTeam.team_name}
              </span>
            )}
          </div>
          {(loc || vexTeam.organization) && (
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              {[vexTeam.organization, loc].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
          {programName && (
            <span style={{
              fontSize: '10px', fontWeight: '700', letterSpacing: '0.07em',
              padding: '2px 8px', borderRadius: '20px',
              background: 'rgba(204,0,0,0.12)', color: 'var(--accent)',
              border: '1px solid rgba(204,0,0,0.2)',
            }}>
              {programName}
            </span>
          )}
          {vexTeam.grade && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{vexTeam.grade}</span>
          )}
          <span style={{
            fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1,
            transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms',
            display: 'block', marginTop: '2px',
          }}>
            ⌄
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          {expandedData?.loading && (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</p>
          )}

          {expandedData && !expandedData.loading && (
            <>
              {/* OpenSkill rating — the at-a-glance strength number */}
              <RatingSection rating={expandedData.rating} prevRating={expandedData.prevRating} />

              {/* W-L-T summary + last 3 events */}
              <PerformanceSection stats={expandedData.stats} />

              {/* Full per-event breakdown toggle */}
              <button
                className="v-btn" onClick={() => setShowBreakdown(s => !s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--accent)', fontSize: '11px', fontWeight: '700',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '0 0 14px',
                }}
              >
                <span style={{ fontSize: '9px' }}>{showBreakdown ? '▲' : '▼'}</span>
                {showBreakdown ? 'Hide event history' : 'Full event history'}
              </button>

              {showBreakdown && expandedData.stats && (
                <EventBreakdownSection stats={expandedData.stats} />
              )}

              {/* Best skills scores (aggregate) */}
              <SkillsSection stats={expandedData.stats} statsError={expandedData.statsError} />

              {/* Awards */}
              <AwardsSection stats={expandedData.stats} />

              {/* Our scouting */}
              <ScoutingSection
                entries={expandedData.scouting ?? []}
                teamNumber={vexTeam.number}
                hasTeam={hasTeam}
                teamId={teamId}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── OpenSkill rating ──────────────────────────────────────────────────────────

function tierColor(tier) {
  return tier === 'Elite' ? '#22c55e'
    : tier === 'Strong' ? '#84cc16'
      : tier === 'Solid' ? '#f59e0b'
        : '#9ca3af'
}

function RatingSection({ rating, prevRating }) {
  const hasCur = rating && rating.score != null
  const hasPrev = prevRating && prevRating.score != null

  if (!hasCur && !hasPrev) {
    return (
      <div style={{ marginBottom: '16px' }}>
        <p style={{ ...sectionLabel, marginBottom: '8px' }}>OpenSkill rating</p>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
          Not enough scored matches yet.
        </p>
      </div>
    )
  }

  const color = hasCur ? tierColor(rating.tier) : 'var(--text-muted)'
  const delta = hasCur && hasPrev ? rating.score - prevRating.score : null

  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ ...sectionLabel, marginBottom: '8px' }}>OpenSkill rating</p>
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px' }}>
        {hasCur ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', flexShrink: 0 }}>
                <span style={{ fontSize: '34px', fontWeight: '800', letterSpacing: '-0.02em', lineHeight: 1, color }}>{rating.score}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>/100</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'inline-block', fontSize: '12px', fontWeight: '700', color,
                  padding: '2px 9px', borderRadius: '20px',
                  background: `${color}22`, border: `1px solid ${color}55`,
                }}>
                  {rating.tier}{rating.provisional ? ' · provisional' : ''}
                </span>
                <div style={{ marginTop: '8px', height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${rating.score}%`, background: color, borderRadius: '3px' }} />
                </div>
              </div>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              This season · OpenSkill from {rating.matches} match{rating.matches === 1 ? '' : 'es'}
              {rating.provisional ? ' (provisional)' : ''}
            </p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>No rated matches this season yet.</p>
        )}

        {hasPrev && (
          <div style={{
            marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Last season
            </span>
            <span style={{ fontSize: '18px', fontWeight: '800', color: tierColor(prevRating.tier) }}>{prevRating.score}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{prevRating.tier}</span>
            {delta != null && Math.abs(delta) > 2 && (
              <span style={{ fontSize: '12px', fontWeight: '700', color: delta > 0 ? '#22c55e' : '#ef4444' }}>
                {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>
              {prevRating.matches} match{prevRating.matches === 1 ? '' : 'es'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Performance (W-L-T + recent event rankings) ───────────────────────────────

function PerformanceSection({ stats }) {
  const rankings = stats?.rankings ?? []

  const totals = rankings.reduce(
    (acc, r) => ({
      wins:   acc.wins   + (r.wins   ?? r.win   ?? 0),
      losses: acc.losses + (r.losses ?? r.loss  ?? 0),
      ties:   acc.ties   + (r.ties   ?? r.tie   ?? 0),
    }),
    { wins: 0, losses: 0, ties: 0 },
  )

  const played = totals.wins + totals.losses + totals.ties
  const winRate = played > 0 ? Math.round((totals.wins / played) * 100) : null

  // Sort by event start date descending, show 3 most recent
  const recent = [...rankings]
    .sort((a, b) => {
      const dateA = a.event?.start ?? a.event?.date ?? ''
      const dateB = b.event?.start ?? b.event?.date ?? ''
      return dateB.localeCompare(dateA)
    })
    .slice(0, 3)

  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ ...sectionLabel, marginBottom: '8px' }}>Performance</p>

      {played === 0 ? (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>No matches yet this season</p>
      ) : (
        <>
          {/* W-L-T record tiles */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {[
              { label: 'W',    value: totals.wins,   color: '#4ade80' },
              { label: 'L',    value: totals.losses,  color: '#f87171' },
              { label: 'T',    value: totals.ties,    color: 'var(--text-muted)' },
              { label: 'Win%', value: `${winRate}%`,  color: winRate >= 50 ? '#4ade80' : '#f87171' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                flex: 1, background: 'var(--surface-2)', borderRadius: '8px',
                padding: '8px 4px', textAlign: 'center',
              }}>
                <p style={{ margin: '0 0 2px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  {label}
                </p>
                <p style={{ margin: 0, fontSize: '17px', fontWeight: '800', color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Recent event breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {recent.map((r, i) => {
              const w = r.wins ?? r.win ?? 0
              const l = r.losses ?? r.loss ?? 0
              const t = r.ties ?? r.tie ?? 0
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '8px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: '12px', color: 'var(--text)', fontWeight: '500',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.event?.name ?? 'Event'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {w}W – {l}L{t > 0 ? ` – ${t}T` : ''}
                    </p>
                  </div>
                  <span style={{
                    marginLeft: '12px', flexShrink: 0,
                    fontSize: '15px', fontWeight: '800',
                    color: r.rank <= 3 ? '#fbbf24' : 'var(--text)',
                  }}>
                    #{r.rank}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Full event history (per-event breakdown + season toggle) ──────────────────

// Known VEX game names by season start year. Add new seasons here as they're announced.
const SEASON_NAMES = {
  2026: 'Override',
  2025: 'Push Back',
  2024: 'High Stakes',
  2023: 'Over Under',
  2022: 'Spin Up',
  2021: 'Tipping Point',
  2020: 'Change Up',
  2019: 'Tower Takeover',
}

// VEX seasons run May → May. Returns the year the season started.
function getSeasonYear(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  const year = d.getFullYear()
  const month = d.getMonth() // 0-indexed
  return month >= 4 ? year : year - 1 // season starts in May
}

function seasonLabel(year) {
  return SEASON_NAMES[year] ?? `${year}–${String(year + 1).slice(2)}`
}

function buildEventMap(stats) {
  const map = new Map()

  const entry = (id, event) => {
    if (!map.has(id)) map.set(id, { event, rank: null, wins: 0, losses: 0, ties: 0, driver: 0, prog: 0, awards: [] })
    return map.get(id)
  }

  for (const r of stats?.rankings ?? []) {
    const id = r.event?.id; if (!id) continue
    const e = entry(id, r.event)
    e.rank   = r.rank ?? null
    e.wins   = r.wins   ?? r.win   ?? 0
    e.losses = r.losses ?? r.loss  ?? 0
    e.ties   = r.ties   ?? r.tie   ?? 0
  }

  for (const s of stats?.skills ?? []) {
    const id = s.event?.id; if (!id) continue
    const e = entry(id, s.event)
    const score = s.score ?? 0
    const t = s.type
    if      (t === 'driver'      || t === 1) e.driver = Math.max(e.driver, score)
    else if (t === 'programming' || t === 2) e.prog   = Math.max(e.prog,   score)
  }

  for (const a of stats?.awards ?? []) {
    const id = a.event?.id; if (!id) continue
    entry(id, a.event).awards.push(a.title ?? a.name ?? 'Award')
  }

  return map
}

function EventBreakdownSection({ stats }) {
  const eventMap  = buildEventMap(stats)
  const allEvents = [...eventMap.values()].sort(
    (a, b) => (b.event?.start ?? '').localeCompare(a.event?.start ?? '')
  )

  // Detect all season years present in the data, newest first
  const seasonYears = [...new Set(
    allEvents.map(e => getSeasonYear(e.event?.start)).filter(y => y !== null)
  )].sort((a, b) => b - a)

  // Auto-select most recent season
  const [activeYear, setActiveYear] = useState(seasonYears[0] ?? null)

  const filtered = activeYear !== null
    ? allEvents.filter(e => getSeasonYear(e.event?.start) === activeYear)
    : allEvents

  // Show fallback notice when showing a past season because the current one has no data
  const currentSeasonYear = getSeasonYear(new Date().toISOString())
  const showingFallback = activeYear !== null && activeYear < currentSeasonYear

  return (
    <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
      {/* Header + season pills */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <p style={sectionLabel}>Event history</p>
        {seasonYears.length > 1 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {seasonYears.map(year => (
              <button
                key={year}
                className="v-btn" onClick={() => setActiveYear(year)}
                style={{
                  height: '24px', padding: '0 10px', borderRadius: '6px',
                  fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                  background: activeYear === year ? 'var(--accent)' : 'transparent',
                  color:      activeYear === year ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${activeYear === year ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {seasonLabel(year)}
              </button>
            ))}
          </div>
        )}
      </div>

      {showingFallback && (
        <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#fbbf24', fontStyle: 'italic' }}>
          Showing {seasonLabel(activeYear)} — no {seasonLabel(currentSeasonYear)} events yet.
        </p>
      )}

      {filtered.length === 0 ? (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>No events this season.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.map(e => <EventRow key={e.event?.id} data={e} />)}
        </div>
      )}
    </div>
  )
}

function EventRow({ data }) {
  const { event, rank, wins, losses, ties, driver, prog, awards } = data
  const played = wins + losses + ties
  const winPct = played > 0 ? Math.round(wins / played * 100) : null
  const skillsTotal = driver + prog
  const dateLabel = event?.start
    ? new Date(event.start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: '8px', padding: '10px 12px' }}>
      {/* Event name + rank */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: played > 0 || skillsTotal > 0 ? '6px' : 0 }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
          <p style={{
            margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {event?.name ?? 'Event'}
          </p>
          {dateLabel && (
            <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{dateLabel}</p>
          )}
        </div>
        {rank != null && (
          <span style={{
            fontSize: '16px', fontWeight: '800', flexShrink: 0,
            color: rank <= 3 ? '#fbbf24' : rank <= 8 ? 'var(--text)' : 'var(--text-muted)',
          }}>
            #{rank}
          </span>
        )}
      </div>

      {/* W-L-T + win% + skills on one line */}
      {(played > 0 || skillsTotal > 0) && (
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {played > 0 && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              <span style={{ color: '#4ade80', fontWeight: '700' }}>{wins}W</span>
              {' – '}
              <span style={{ color: '#f87171', fontWeight: '700' }}>{losses}L</span>
              {ties > 0 && <span> – {ties}T</span>}
              {winPct !== null && (
                <span style={{ marginLeft: '5px', color: winPct >= 50 ? '#4ade80' : '#f87171' }}>
                  · {winPct}%
                </span>
              )}
            </span>
          )}
          {skillsTotal > 0 && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Skills <span style={{ color: 'var(--text)', fontWeight: '700' }}>{skillsTotal}</span>
              <span style={{ fontSize: '10px' }}> ({driver}d+{prog}p)</span>
            </span>
          )}
        </div>
      )}

      {/* Awards */}
      {awards.length > 0 && (
        <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {awards.map((a, i) => (
            <span key={i} style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
              background: 'rgba(251,191,36,0.1)', color: '#fbbf24',
              border: '1px solid rgba(251,191,36,0.2)',
            }}>
              🏆 {a}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Skills ────────────────────────────────────────────────────────────────────

function SkillsSection({ stats, statsError }) {
  if (statsError) {
    return <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-muted)' }}>Skills unavailable</p>
  }
  if (!stats) return null

  const runs = stats.skills ?? []

  // Find best driver and programming scores
  const driverBest = runs
    .filter(r => r.type === 'driver' || r.type === 1)
    .reduce((max, r) => Math.max(max, r.score ?? 0), 0)
  const progBest = runs
    .filter(r => r.type === 'programming' || r.type === 2)
    .reduce((max, r) => Math.max(max, r.score ?? 0), 0)
  const total = driverBest + progBest

  if (!runs.length) {
    return (
      <div style={{ marginBottom: '16px' }}>
        <p style={{ ...sectionLabel, marginBottom: '6px' }}>Skills</p>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>No skills runs recorded</p>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ ...sectionLabel, marginBottom: '8px' }}>Skills</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[
          { label: 'Driver', value: driverBest },
          { label: 'Programming', value: progBest },
          { label: 'Total', value: total, bold: true },
        ].map(({ label: l, value, bold }) => (
          <div key={l} style={{
            flex: 1, background: 'var(--surface-2)', borderRadius: '8px',
            padding: '10px', textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{l}</p>
            <p style={{ margin: 0, fontSize: bold ? '20px' : '17px', fontWeight: '800', color: bold ? 'var(--accent)' : 'var(--text)' }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Awards ────────────────────────────────────────────────────────────────────

function AwardsSection({ stats }) {
  const awards = stats?.awards
  if (!awards?.length) return null

  // Show up to 3 most recent awards
  const shown = awards.slice(0, 3)

  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ ...sectionLabel, marginBottom: '8px' }}>Awards{awards.length > 3 ? ` (${awards.length} total)` : ''}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {shown.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#fbbf24' }}>🏆</span>
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>
              {a.title ?? a.name ?? 'Award'}
              {a.event?.name && (
                <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>· {a.event.name}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Our team's scouting on this team ─────────────────────────────────────────

function ScoutingSection({ entries, teamNumber, hasTeam, teamId }) {
  return (
    <div>
      {/* AI brief of our own scouting — only when we have a team + some data */}
      {hasTeam && teamId && entries.length >= 1 && (
        <AiSummarySection teamId={teamId} teamNumber={teamNumber} entryCount={entries.length} />
      )}

      <p style={{ ...sectionLabel, marginBottom: '8px' }}>
        Our scouting{entries.length > 0 ? ` · ${entries.length}` : ''}
      </p>

      {entries.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            {hasTeam ? `No scouting on ${teamNumber} yet.` : 'Join a team to see shared scouting data.'}
          </p>
          {hasTeam && (
            <Link
              to={`/scout?team=${encodeURIComponent(teamNumber)}`}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                height: '42px', padding: '0 16px', borderRadius: '9px',
                background: 'var(--accent)', color: '#fff', textDecoration: 'none',
                fontSize: '13px', fontWeight: '700', alignSelf: 'flex-start',
              }}
            >
              Scout {teamNumber} →
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {entries.map((entry, i) => (
            <MiniScoutCard key={entry.id ?? i} entry={entry} />
          ))}
          <Link
            to={`/scout?team=${encodeURIComponent(teamNumber)}`}
            style={{
              display: 'inline-flex', alignItems: 'center',
              marginTop: '4px', fontSize: '13px', color: 'var(--accent)',
              textDecoration: 'none', fontWeight: '600', gap: '4px',
            }}
          >
            Scout again →
          </Link>
        </div>
      )}
    </div>
  )
}

// ── AI Summary ("SparkNotes") of our own scouting on this team ────────────────
// Server-side Edge Function does the model call + caching + team-scoping; this
// just renders it, clearly marked as AI-generated and traceable to N reports.

function AiHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <span style={{ ...sectionLabel, color: 'var(--accent)' }}>Summary</span>
      <span style={{
        fontSize: '9px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase',
        padding: '2px 7px', borderRadius: '20px',
        background: 'rgba(204,0,0,0.12)', color: 'var(--accent)', border: '1px solid rgba(204,0,0,0.22)',
      }}>
        AI-generated
      </span>
    </div>
  )
}

function AiSummarySection({ teamId, teamNumber, entryCount }) {
  const online = useOnlineStatus()
  // status: 'loading' | 'ok' | 'error' | 'offline'
  const [result, setResult] = useState({ status: 'loading' })

  useEffect(() => {
    if (!online) { setResult({ status: 'offline' }); return }
    if (!teamId) return
    let cancelled = false
    setResult({ status: 'loading' })
    supabase.functions
      .invoke('summarize-scouting', { body: { team_id: teamId, scouted_team_number: teamNumber } })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || data?.error || !data?.summary) { setResult({ status: 'error' }); return }
        setResult({ status: 'ok', summary: data.summary, count: data.entry_count, enough: data.enough })
      })
      .catch(() => { if (!cancelled) setResult({ status: 'error' }) })
    return () => { cancelled = true }
  }, [teamId, teamNumber, entryCount, online])

  // Offline: fail silently — never break the page or imply data we don't have.
  if (result.status === 'offline') return null

  return (
    <div style={aiCard}>
      <AiHeader />

      {result.status === 'loading' && (
        <p style={aiMuted}>Reading your team's scouting…</p>
      )}

      {result.status === 'error' && (
        <p style={aiMuted}>Summary unavailable right now.</p>
      )}

      {result.status === 'ok' && (
        <>
          <p style={{ margin: '9px 0 0', fontSize: '14px', lineHeight: 1.5, color: 'var(--text)' }}>
            {result.summary}
          </p>
          {result.enough && (
            <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              Based on {result.count} scouting {result.count === 1 ? 'report' : 'reports'} from your team · AI-generated, double-check before trusting.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function MiniScoutCard({ entry }) {
  const stars = entry.reliability
    ? '★'.repeat(entry.reliability) + '☆'.repeat(5 - entry.reliability)
    : null
  const threat = THREAT_META[entry.threat_level]
  const tags = [
    SCORING_LABELS[entry.scoring],
    DEFENSE_LABELS[entry.under_defense] && `Def: ${DEFENSE_LABELS[entry.under_defense]}`,
    DRIVER_LABELS[entry.driver_skill] && `Driver: ${DRIVER_LABELS[entry.driver_skill]}`,
    STABILITY_LABELS[entry.stability],
    AUTO_LABELS[entry.autonomous] && `Auto: ${AUTO_LABELS[entry.autonomous]}`,
    DRIVETRAIN_LABELS[entry.drivetrain],
    INTAKE_LABELS[entry.intake],
  ].filter(Boolean)

  return (
    <div style={{
      background: 'var(--surface-2)', borderRadius: '8px', padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: '5px',
    }}>
      {(threat || stars) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {threat && (
            <span style={{ fontSize: '11px', fontWeight: '700', color: threat.color, border: `1px solid ${threat.color}`, background: `color-mix(in oklch, ${threat.color} 14%, transparent)`, borderRadius: '999px', padding: '1px 8px' }}>
              {threat.label} threat
            </span>
          )}
          {stars && <span style={{ color: '#f59e0b', fontSize: '12px', letterSpacing: '1px' }}>{stars}</span>}
        </div>
      )}
      {entry.how_to_play && (
        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>→ {entry.how_to_play}</span>
      )}
      {tags.length > 0 && (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tags.join(' · ')}</span>
      )}
      {entry.note && (
        <span style={{ fontSize: '13px', color: 'var(--text)', fontStyle: 'italic' }}>"{entry.note}"</span>
      )}
      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
        {new Date(entry.created_at).toLocaleDateString()}
      </span>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const label       = { margin: 0, color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }
const h1          = { margin: '4px 0 20px', fontSize: '28px', fontWeight: '800' }
const card        = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }
const sectionLabel = { margin: 0, color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase' }
const btnPrimary  = { height: '52px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }
const inputStyle  = { height: '52px', padding: '0 14px', background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }
// Accent-tinted card so the AI brief reads as distinct from the neutral,
// human-entered scouting blocks below it (which use --surface-2).
const aiCard      = { marginBottom: '18px', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(204,0,0,0.22)', background: 'rgba(204,0,0,0.045)' }
const aiMuted     = { margin: '9px 0 0', fontSize: '13px', color: 'var(--text-muted)' }
