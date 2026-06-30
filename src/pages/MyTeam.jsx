import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../hooks/useTeam'

export default function MyTeam() {
  const { user, loading: authLoading, signOut } = useAuth()
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
          <button onClick={() => navigate('/login')} style={{ ...btnPrimary, width: '100%', marginBottom: '10px' }}>
            Sign in
          </button>
          <button onClick={() => navigate('/login')} style={{ ...btnSecondary, width: '100%' }}>
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

      <button
        onClick={async () => { await signOut(); navigate('/login') }}
        style={{ ...btnSecondary, width: '100%', marginTop: '8px' }}
      >
        Sign out
      </button>
    </div>
  )
}

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
          style={{ ...btnSecondary, height: '48px', padding: '0 16px', fontSize: '13px', flexShrink: 0 }}
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
              style={inputStyle}
            />
            <input
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="Team name (optional)"
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

        <button type="submit" disabled={loading} style={{ ...btnPrimary, width: '100%', opacity: loading ? 0.6 : 1 }}>
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
