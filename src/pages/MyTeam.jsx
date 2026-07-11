import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../hooks/useTeam'
import { useScoutingEntries } from '../hooks/useScoutingEntries'

export default function MyTeam() {
  const { user, loading: authLoading } = useAuth()
  const { team, role, loading: teamLoading, createTeam, joinTeam, leaveTeam, regenerateInvite, getMembers, manageMember } = useTeam()
  const navigate = useNavigate()

  if (authLoading || (user && teamLoading)) {
    return <div style={{ padding: '24px 16px', color: 'var(--text-muted)' }}>Loading…</div>
  }

  if (!user) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: '560px', margin: '0 auto' }}>
        <p style={label}>My Team</p>
        <h1 style={h1}>Team Pool</h1>
        <div style={card}>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 20px', fontSize: '15px', lineHeight: 1.5 }}>
            Sign in to join your team's scouting pool and share data in real time.
          </p>
          <button onClick={() => navigate('/login')} className="v-btn v-btn-accent" style={{ ...btnPrimary, width: '100%', marginBottom: '10px' }}>
            Sign in
          </button>
          <button onClick={() => navigate('/login?mode=signup')} className="v-btn v-btn-ghost" style={{ ...btnSecondary, width: '100%' }}>
            Create account
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: '560px', margin: '0 auto' }}>
      <p style={label}>My Team</p>
      <h1 style={h1}>Account</h1>

      {/* Account */}
      <div style={{ ...card, marginBottom: '12px' }}>
        <p style={{ ...label, marginBottom: '4px' }}>Signed in as</p>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', wordBreak: 'break-all' }}>{user.email}</p>
      </div>

      {/* Team */}
      {team ? (
        <TeamCard
          team={team}
          role={role}
          currentUserId={user.id}
          leaveTeam={leaveTeam}
          regenerateInvite={regenerateInvite}
          getMembers={getMembers}
          manageMember={manageMember}
        />
      ) : (
        <TeamSetup createTeam={createTeam} joinTeam={joinTeam} />
      )}

      {/* Log of the whole team's scouting output — your own entries are editable */}
      {team && (
        <ScoutingLog
          team={team}
          getMembers={getMembers}
          currentUserId={user.id}
          onScout={() => navigate('/scout')}
          onEditEntry={(entry) => navigate('/scout', { state: { editEntry: entry } })}
        />
      )}

    </div>
  )
}

// ── Scouting log — read-only view of the whole team's entries ────────────────

const DRIVE  = { tank: 'Tank', mecanum: 'Mecanum', xdrive: 'X-drive', other: 'Other' }
const INTAKE = { strong: 'Strong intake', okay: 'Okay intake', weak: 'Weak intake', none: 'No intake' }
const SCORE  = { fast: 'Fast scoring', average: 'Avg scoring', slow: 'Slow scoring', cant_tell: 'Scoring ?' }
const AUTO   = { strong: 'Strong auto', works: 'Auto works', weak_none: 'Weak/no auto', didnt_see: 'Auto unseen' }
// Eye-test fields
const THREAT    = { low: { label: 'Low', color: '#22c55e' }, medium: { label: 'Medium', color: '#f59e0b' }, high: { label: 'High', color: '#fb923c' }, must_scout: { label: 'Must-scout', color: 'var(--accent)' } }
const DEFENSE   = { folds: 'Folds', handles: 'Handles it', unstoppable: 'Unstoppable', didnt_see: "Didn't see" }
const DRIVER    = { struggles: 'Struggles', decent: 'Decent', skilled: 'Skilled', didnt_see: "Didn't see" }
const STABILITY = { tippy: 'Tippy', solid: 'Solid', rock_solid: 'Rock-solid' }

function timeAgo(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const s = (Date.now() - d.getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function ScoutingLog({ team, getMembers, currentUserId, onScout, onEditEntry }) {
  const { entries, loading } = useScoutingEntries(team)
  const [members, setMembers] = useState([])
  const [teamFilter, setTeamFilter] = useState('')
  const [scoutFilter, setScoutFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [limit, setLimit] = useState(15)

  useEffect(() => {
    let cancelled = false
    getMembers(team.id).then(m => { if (!cancelled) setMembers(m || []) }).catch(() => {})
    return () => { cancelled = true }
  }, [team.id])

  const nameById = useMemo(() => {
    const map = {}
    for (const m of members) map[m.user_id] = m.display_name || m.email || 'Unknown'
    return map
  }, [members])

  const scoutName = (id) =>
    id === currentUserId ? 'You' : (nameById[id] || 'Teammate')

  const filtered = useMemo(() => entries.filter(e => {
    const num = (e.scouted_team_number || '').toUpperCase()
    if (teamFilter && !num.includes(teamFilter.toUpperCase())) return false
    if (scoutFilter !== 'all' && e.created_by !== scoutFilter) return false
    return true
  }), [entries, teamFilter, scoutFilter])

  const visible = filtered.slice(0, limit)
  const key = (e) => e.id || e._local_id

  return (
    <div style={{ ...card, marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
        <p style={label}>
          Scouting log{entries.length ? ` · ${entries.length}` : ''}
        </p>
        {entries.length > 0 && (
          <button onClick={onScout} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: 0 }}>
            + Scout
          </button>
        )}
      </div>

      {/* Empty / loading states */}
      {loading && entries.length === 0 && (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</p>
      )}
      {!loading && entries.length === 0 && (
        <div style={{ textAlign: 'center', padding: '18px 8px' }}>
          <p style={{ margin: '0 0 14px', fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            No scouting entries yet. Forms your team submits will collect here.
          </p>
          <button onClick={onScout} className="v-btn v-btn-accent" style={{ ...btnPrimary, height: '44px', padding: '0 20px', fontSize: '14px' }}>
            Scout a team
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              value={teamFilter}
              onChange={e => { setTeamFilter(e.target.value.toUpperCase()); setLimit(15) }}
              placeholder="Filter by team #"
              style={{ ...inputStyle, height: '40px', fontSize: '13px', flex: 1 }}
            />
            <select
              value={scoutFilter}
              onChange={e => { setScoutFilter(e.target.value); setLimit(15) }}
              style={{
                height: '40px', padding: '0 10px', flexShrink: 0, maxWidth: '42%',
                background: 'var(--surface-2)', border: '1.5px solid var(--border)',
                borderRadius: '10px', color: 'var(--text)', fontSize: '13px', fontFamily: 'inherit', outline: 'none',
              }}
            >
              <option value="all">All scouts</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_id === currentUserId ? 'You' : (m.display_name || m.email || 'Member')}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <p style={{ margin: '4px 0', fontSize: '13px', color: 'var(--text-muted)' }}>No entries match those filters.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {visible.map(e => (
                <EntryRow
                  key={key(e)}
                  entry={e}
                  scout={scoutName(e.created_by)}
                  editor={e.edited_by ? scoutName(e.edited_by) : null}
                  canEdit={true}
                  onEdit={() => onEditEntry(e)}
                  open={expanded === key(e)}
                  onToggle={() => setExpanded(expanded === key(e) ? null : key(e))}
                />
              ))}
            </div>
          )}

          {filtered.length > limit && (
            <button
              onClick={() => setLimit(l => l + 20)}
              style={{ ...btnSecondary, width: '100%', height: '42px', fontSize: '13px', marginTop: '10px' }}
            >
              Show {Math.min(20, filtered.length - limit)} more
            </button>
          )}
        </>
      )}
    </div>
  )
}

function EntryRow({ entry, scout, editor, canEdit, onEdit, open, onToggle }) {
  const threat = THREAT[entry.threat_level]
  const stars = entry.reliability ? '★'.repeat(entry.reliability) + '☆'.repeat(5 - entry.reliability) : null
  const summary = [SCORE[entry.scoring], entry.how_to_play].filter(Boolean)

  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: '10px', overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '12px', fontFamily: 'inherit' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>
            {entry.scouted_team_number}
            {entry._synced === false && (
              <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: '700', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                pending
              </span>
            )}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(entry.created_at)}</span>
        </div>

        {(threat || stars) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            {threat && (
              <span style={{ fontSize: '11px', fontWeight: '700', color: threat.color, border: `1px solid ${threat.color}`, background: `color-mix(in oklch, ${threat.color} 14%, transparent)`, borderRadius: '999px', padding: '1px 8px' }}>
                {threat.label} threat
              </span>
            )}
            {stars && <span style={{ fontSize: '11px', color: '#f59e0b', letterSpacing: '1px' }}>{stars}</span>}
          </div>
        )}

        {summary.length > 0 && (
          <p style={{ margin: '5px 0 0', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {summary.join(' · ')}
          </p>
        )}

        {!open && entry.note && (
          <p style={{ margin: '5px 0 0', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            "{entry.note}"
          </p>
        )}
      </button>

      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <DetailRow k="Threat" v={threat?.label} />
          <DetailRow k="Scoring" v={SCORE[entry.scoring]} />
          <DetailRow k="Under defense" v={DEFENSE[entry.under_defense]} />
          <DetailRow k="Driver skill" v={DRIVER[entry.driver_skill]} />
          <DetailRow k="Stability" v={STABILITY[entry.stability]} />
          <DetailRow k="Autonomous" v={AUTO[entry.autonomous]} />
          <DetailRow k="Reliability" v={entry.reliability ? `${entry.reliability}/5` : null} />
          <DetailRow k="How to play" v={entry.how_to_play} />
          <DetailRow k="Drivetrain" v={DRIVE[entry.drivetrain]} />
          <DetailRow k="Intake" v={INTAKE[entry.intake]} />
          {entry.photo_url && <DetailRow k="Photo" v="Attached" />}
          {entry.note && (
            <div style={{ marginTop: '2px' }}>
              <p style={{ ...detailK, marginBottom: '2px' }}>Note</p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, fontStyle: 'italic' }}>"{entry.note}"</p>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '4px' }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                Scouted by <span style={{ color: 'var(--text)', fontWeight: '600' }}>{scout}</span>
              </p>
              {entry.edited_at && (
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Edited by <span style={{ color: 'var(--text)', fontWeight: '600' }}>{editor || 'Teammate'}</span> · {timeAgo(entry.edited_at)}
                </p>
              )}
            </div>
            {canEdit && (
              <button
                onClick={onEdit}
                style={{ flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
              >
                Edit report
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ k, v }) {
  if (!v) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px' }}>
      <span style={detailK}>{k}</span>
      <span style={{ color: 'var(--text)', fontWeight: '500', textAlign: 'right' }}>{v}</span>
    </div>
  )
}

const detailK = { margin: 0, color: 'var(--text-muted)', fontSize: '12px' }

// ── Team card shown when user is already in a team ──────────────────────────

function TeamCard({ team, role, currentUserId, leaveTeam, regenerateInvite, getMembers, manageMember }) {
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [inviteCode, setInviteCode] = useState(team.invite_code)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState(null)
  const isAdmin = role === 'admin'

  async function copyCode() {
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleLeave() {
    const msg = isAdmin
      ? `Leave team ${team.team_number}? If you're the only admin, the longest-standing member will be promoted. You'll need an invite code to rejoin.`
      : `Leave team ${team.team_number}? You'll need an invite code to rejoin.`
    if (!confirm(msg)) return
    setLeaving(true)
    setLeaveError(null)
    try {
      await leaveTeam(team.id)
    } catch (err) {
      setLeaveError(err.message)
      setLeaving(false)
    }
  }

  async function handleRegenerate() {
    if (!confirm('Regenerate the invite code? The old code will stop working immediately.')) return
    setRegenerating(true)
    try {
      const newCode = await regenerateInvite()
      setInviteCode(newCode)
    } catch (err) {
      alert(err.message)
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div style={{ ...card, marginBottom: '12px' }}>
      {/* Team identity */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ ...label, marginBottom: '4px' }}>
          Team ·{' '}
          <span style={{ color: role === 'admin' ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>
            {role}
          </span>
        </p>
        <p style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>{team.team_number}</p>
        {team.team_name && <p style={{ margin: '2px 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>{team.team_name}</p>}
      </div>

      {/* Invite code — visible to all members so they can share it */}
      <p style={{ ...label, marginBottom: '8px' }}>Invite code</p>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{
          flex: 1,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '10px 14px',
          fontFamily: 'monospace',
          fontSize: '20px',
          fontWeight: '700',
          letterSpacing: '0.2em',
          color: 'var(--text)',
        }}>
          {inviteCode}
        </div>
        <button
          onClick={copyCode}
          className="v-btn v-btn-ghost"
          style={{ ...btnSecondary, height: '48px', padding: '0 16px', fontSize: '13px', flexShrink: 0, color: copied ? '#22c55e' : 'var(--text-muted)' }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Share this code with teammates. They enter it in the "Join a team" screen.
      </p>

      {/* Regenerate — admin only */}
      {isAdmin && (
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          style={{ ...btnSecondary, marginTop: '16px', fontSize: '13px', height: '40px', padding: '0 14px', opacity: regenerating ? 0.5 : 1 }}
        >
          {regenerating ? 'Regenerating…' : 'Regenerate code'}
        </button>
      )}

      {/* Member list */}
      <MemberList
        teamId={team.id}
        currentUserId={currentUserId}
        currentRole={role}
        getMembers={getMembers}
        manageMember={manageMember}
      />

      {/* Leave team */}
      <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
        {leaveError && (
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#f87171' }}>{leaveError}</p>
        )}
        <button
          onClick={handleLeave}
          disabled={leaving}
          style={{
            width: '100%', height: '44px',
            background: 'transparent',
            color: leaving ? 'var(--text-muted)' : '#f87171',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: '10px',
            fontSize: '14px', fontWeight: '600',
            cursor: leaving ? 'default' : 'pointer',
            opacity: leaving ? 0.6 : 1,
          }}
        >
          {leaving ? 'Leaving…' : 'Leave team'}
        </button>
      </div>
    </div>
  )
}

// ── Member list with admin actions ───────────────────────────────────────────

function MemberList({ teamId, currentUserId, currentRole, getMembers, manageMember }) {
  const [members, setMembers] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [busy, setBusy] = useState(null) // user_id currently being actioned

  useEffect(() => { loadMembers() }, [teamId])

  async function loadMembers() {
    setFetchError(null)
    try {
      const data = await getMembers(teamId)
      setMembers(data)
    } catch (err) {
      setFetchError(err.message)
    }
  }

  async function handleAction(targetUserId, action, displayName) {
    if (action === 'remove') {
      if (!confirm(`Remove ${displayName} from the team?`)) return
    }
    setBusy(targetUserId)
    try {
      await manageMember(teamId, targetUserId, action)
      await loadMembers()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(null)
    }
  }

  const isAdmin = currentRole === 'admin'

  return (
    <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
      <p style={{ ...label, marginBottom: '12px' }}>
        Members{members ? ` · ${members.length}` : ''}
      </p>

      {fetchError && (
        <p style={{ margin: 0, fontSize: '13px', color: '#f87171' }}>{fetchError}</p>
      )}

      {!fetchError && !members && (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</p>
      )}

      {members && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {members.map(m => {
            const displayName = m.display_name || m.email || '?'
            const initials = displayName
              .split(/[\s@.]+/)
              .filter(Boolean)
              .slice(0, 2)
              .map(w => w[0].toUpperCase())
              .join('')
            const isMe = m.user_id === currentUserId
            const isBusy = busy === m.user_id
            const memberIsAdmin = m.role === 'admin'

            return (
              <div
                key={m.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'var(--surface-2)',
                  borderRadius: '10px',
                  padding: '12px',
                }}
              >
                {/* Initials avatar */}
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: memberIsAdmin ? 'rgba(204,0,0,0.15)' : 'transparent',
                  border: `1.5px solid ${memberIsAdmin ? 'var(--accent)' : 'var(--border)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: memberIsAdmin ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                  {initials || '?'}
                </div>

                {/* Name + email + role */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {displayName}
                    {isMe && (
                      <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' }}>
                        you
                      </span>
                    )}
                  </p>
                  {m.display_name && (
                    <p style={{
                      margin: '1px 0 0',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {m.email}
                    </p>
                  )}
                  <p style={{
                    margin: '2px 0 0',
                    fontSize: '10px',
                    fontWeight: '700',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: memberIsAdmin ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                    {m.role}
                  </p>
                </div>

                {/* Action buttons — admins only, not on yourself */}
                {isAdmin && !isMe && (
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {!memberIsAdmin && (
                      <button
                        disabled={isBusy}
                        onClick={() => handleAction(m.user_id, 'promote', displayName)}
                        style={{
                          height: '34px',
                          padding: '0 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border)',
                          opacity: isBusy ? 0.4 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Make admin
                      </button>
                    )}
                    <button
                      disabled={isBusy}
                      onClick={() => handleAction(m.user_id, 'remove', displayName)}
                      style={{
                        height: '34px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        background: 'transparent',
                        color: '#f87171',
                        border: '1px solid rgba(248,113,113,0.3)',
                        opacity: isBusy ? 0.4 : 1,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Setup flow for users not yet in a team ───────────────────────────────────

function TeamSetup({ createTeam, joinTeam }) {
  const [mode, setMode] = useState('join')
  const [inviteCode, setInviteCode] = useState('')
  const [teamNumber, setTeamNumber] = useState('')
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState(null) // { message, duplicate?, teamNumber? }
  const [loading, setLoading] = useState(false)

  function switchToJoin() {
    setMode('join')
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'join') await joinTeam(inviteCode)
      else await createTeam(teamNumber, teamName)
    } catch (err) {
      setError({
        message: err.message,
        duplicate: err.duplicate ?? false,
        teamNumber: err.teamNumber ?? null,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ ...card, marginBottom: '12px' }}>
      <p style={{ ...label, marginBottom: '16px' }}>Team</p>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[
          { key: 'join', text: 'Join a team' },
          { key: 'create', text: 'Create team' },
        ].map(({ key, text }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setMode(key); setError(null) }}
            style={{
              flex: 1, height: '40px', borderRadius: '8px', fontSize: '13px',
              fontWeight: '600', cursor: 'pointer',
              background: mode === key ? 'var(--accent)' : 'var(--surface-2)',
              color: mode === key ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${mode === key ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            {text}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {mode === 'join' ? (
          <input
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.toUpperCase())}
            placeholder="Invite code (e.g. A3K9BM2P)"
            required
            maxLength={8}
            autoComplete="off"
            style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.1em', fontSize: '18px' }}
          />
        ) : (
          <>
            <input
              value={teamNumber}
              onChange={e => setTeamNumber(e.target.value.toUpperCase())}
              placeholder="VEX team number (e.g. 16858A)"
              required
              maxLength={12}
              style={inputStyle}
            />
            <input
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="Team name (optional)"
              maxLength={100}
              style={inputStyle}
            />
          </>
        )}

        {/* Duplicate team error — actionable card, not just a red string */}
        {error?.duplicate ? (
          <div style={{
            padding: '14px',
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.25)',
            borderRadius: '10px',
          }}>
            <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '700', color: '#fbbf24' }}>
              Team {error.teamNumber} already exists
            </p>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              This team already has a scouting pool on Veralis. Ask your captain for the invite code, then join that pool.
            </p>
            <button
              type="button"
              onClick={switchToJoin}
              style={{ height: '36px', padding: '0 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
            >
              Switch to Join
            </button>
          </div>
        ) : error ? (
          <p style={{ margin: 0, fontSize: '13px', color: '#f87171', padding: '8px 12px', background: 'rgba(248,113,113,0.1)', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.2)' }}>
            {error.message}
          </p>
        ) : null}

        <button type="submit" className="v-btn v-btn-accent" disabled={loading} style={{ ...btnPrimary, width: '100%', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Please wait…' : mode === 'join' ? 'Join team' : 'Create team'}
        </button>
      </form>

      <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {mode === 'join'
          ? 'Get the invite code from your team captain — it looks like ABCD1234.'
          : "Creates a new private scouting pool. You'll get an invite code to share with teammates."}
      </p>
    </div>
  )
}

// ── Shared styles ────────────────────────────────────────────────────────────

const label = { margin: 0, color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }
const h1    = { margin: '4px 0 20px', fontSize: '28px', fontWeight: '800' }
const card  = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }

const btnPrimary   = { height: '52px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }
const btnSecondary = { height: '52px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }
const inputStyle   = { height: '52px', padding: '0 14px', background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '15px', fontFamily: 'inherit', outline: 'none', width: '100%' }
