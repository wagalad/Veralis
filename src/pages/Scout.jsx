import { useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../hooks/useTeam'
import { useScoutingEntries } from '../hooks/useScoutingEntries'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import OptionGroup from '../components/OptionGroup'

const DRIVETRAIN_LABELS = { tank: 'Tank', mecanum: 'Mecanum', xdrive: 'X-drive', other: 'Other/unsure' }
const INTAKE_LABELS    = { strong: 'Strong', okay: 'Okay', weak: 'Weak', none: 'None/unsure' }
const SCORING_LABELS   = { fast: 'Fast', average: 'Average', slow: 'Slow', cant_tell: "Couldn't tell" }

const emptyForm = { drivetrain: null, intake: null, scoring: null, autonomous: null, reliability: null, photo: null, note: '' }

export default function Scout() {
  const { user } = useAuth()
  const { team, loading: teamLoading } = useTeam()
  const { entries, loading: entriesLoading, save } = useScoutingEntries(team)
  const online = useOnlineStatus()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [form, setForm] = useState(emptyForm)
  const [scoutedTeam, setScoutedTeam] = useState(
    searchParams.get('team')?.toUpperCase() ?? '16858A'
  )
  const [editingTeam, setEditingTeam] = useState(false)
  const [teamInput, setTeamInput] = useState('')
  const [lastScouted, setLastScouted] = useState(null)
  const [saving, setSaving] = useState(false)
  const photoRef = useRef(null)

  function setField(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (file) setField('photo', file)
  }

  function confirmTeamEdit() {
    const v = teamInput.trim().toUpperCase()
    if (v) setScoutedTeam(v)
    setEditingTeam(false)
    setTeamInput('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    await save(scoutedTeam, form, form.photo)
    setLastScouted(scoutedTeam)
    setForm(emptyForm)
    setSaving(false)
  }

  // ── Gate: not signed in ──
  if (!user) {
    return (
      <Gate
        title="Scout a Robot"
        message="Sign in to save scouting data to your team's shared pool."
        action="Sign in"
        onAction={() => navigate('/login')}
      />
    )
  }

  // ── Gate: loading team ──
  if (teamLoading) {
    return <div style={{ padding: '24px 16px', color: 'var(--text-muted)' }}>Loading…</div>
  }

  // ── Gate: no team ──
  if (!team) {
    return (
      <Gate
        title="Scout a Robot"
        message="Join your team first so scouting entries are shared with your teammates."
        action="Go to My Team"
        onAction={() => navigate('/my-team')}
      />
    )
  }

  return (
    <div style={{ padding: '20px 16px 32px', maxWidth: '560px', margin: '0 auto' }}>

      {/* Offline banner */}
      {!online && (
        <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#fbbf24' }}>
          Offline — entries save locally and sync when you reconnect.
        </div>
      )}

      {/* Confirmation banner */}
      {lastScouted && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.4)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <span style={{ color: '#22c55e' }}>✓</span>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#22c55e' }}>
            {lastScouted} saved{!online ? ' locally' : ''}
          </span>
          <button onClick={() => setLastScouted(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(34,197,94,0.6)', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
      )}

      {/* Team being scouted */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ flex: 1 }}>
          <p style={labelStyle}>Scouting</p>
          {editingTeam ? (
            <input
              autoFocus
              value={teamInput}
              onChange={e => setTeamInput(e.target.value.toUpperCase())}
              onBlur={confirmTeamEdit}
              onKeyDown={e => e.key === 'Enter' && confirmTeamEdit()}
              placeholder={scoutedTeam}
              style={{ fontSize: '28px', fontWeight: '800', background: 'transparent', border: 'none', borderBottom: '2px solid var(--accent)', color: 'var(--text)', outline: 'none', width: '120px', letterSpacing: '-0.5px' }}
            />
          ) : (
            <h1 style={{ margin: 0, fontSize: '30px', fontWeight: '800', letterSpacing: '-0.5px' }}>{scoutedTeam}</h1>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setTeamInput(scoutedTeam); setEditingTeam(true) }}
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer', minHeight: '40px' }}
        >
          Change
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

          <Field label="Drivetrain">
            <OptionGroup value={form.drivetrain} onChange={v => setField('drivetrain', v)} options={[
              { value: 'tank', label: 'Tank' },
              { value: 'mecanum', label: 'Mecanum' },
              { value: 'xdrive', label: 'X-drive' },
              { value: 'other', label: 'Other/unsure' },
            ]} />
          </Field>

          <Field label="Intake / pickup">
            <OptionGroup value={form.intake} onChange={v => setField('intake', v)} options={[
              { value: 'strong', label: 'Strong' },
              { value: 'okay', label: 'Okay' },
              { value: 'weak', label: 'Weak' },
              { value: 'none', label: 'None/unsure' },
            ]} />
          </Field>

          <Field label="Scoring">
            <OptionGroup value={form.scoring} onChange={v => setField('scoring', v)} options={[
              { value: 'fast', label: 'Fast' },
              { value: 'average', label: 'Average' },
              { value: 'slow', label: 'Slow' },
              { value: 'cant_tell', label: "Couldn't tell" },
            ]} />
          </Field>

          <Field label="Autonomous">
            <OptionGroup value={form.autonomous} onChange={v => setField('autonomous', v)} options={[
              { value: 'strong', label: 'Strong' },
              { value: 'works', label: 'Works' },
              { value: 'weak_none', label: 'Weak/none' },
              { value: 'didnt_see', label: "Didn't see" },
            ]} />
          </Field>

          <Field label="Reliability" hint="1 = breaks down · 5 = never fails">
            <OptionGroup value={form.reliability} onChange={v => setField('reliability', v)}
              options={[1,2,3,4,5].map(n => ({ value: n, label: String(n) }))} />
          </Field>

          <Field label="Photo">
            <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhoto} />
            <button type="button" onClick={() => photoRef.current?.click()} style={{
              width: '100%', minHeight: '52px',
              border: `1.5px solid ${form.photo ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '10px',
              background: form.photo ? 'rgba(204,0,0,0.13)' : 'var(--surface-2)',
              color: form.photo ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '14px', fontWeight: form.photo ? '700' : '400',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              <CameraIcon />
              {form.photo ? form.photo.name : online ? 'Add photo' : 'Add photo (uploads when online)'}
            </button>
          </Field>

          <Field label="One-word note" optional>
            <input type="text" value={form.note} onChange={e => setField('note', e.target.value)}
              placeholder="e.g. consistent, fragile, speedy…"
              maxLength={200}
              style={{ width: '100%', background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '15px', padding: '0 14px', height: '52px', fontFamily: 'inherit', outline: 'none' }}
            />
          </Field>

          <button type="submit" disabled={saving} style={{
            width: '100%', height: '58px',
            background: saving ? 'var(--surface-2)' : 'var(--accent)',
            color: saving ? 'var(--text-muted)' : '#fff',
            border: 'none', borderRadius: '12px', fontSize: '17px', fontWeight: '700',
            cursor: saving ? 'default' : 'pointer', marginTop: '4px',
          }}>
            {saving ? 'Saving…' : `Save — ${scoutedTeam}`}
          </button>
        </div>
      </form>

      {/* Scouted entries list */}
      {(entries.length > 0 || entriesLoading) && (
        <div style={{ marginTop: '40px' }}>
          <p style={labelStyle}>
            {entriesLoading ? 'Loading pool…' : `Scouted (${entries.length})`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {entries.map((entry, i) => (
              <ScoutedCard key={entry.id ?? entry._local_id ?? i} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Gate({ title, message, action, onAction }) {
  return (
    <div style={{ padding: '24px 16px', maxWidth: '560px', margin: '0 auto' }}>
      <p style={labelStyle}>Scouting</p>
      <h1 style={{ margin: '4px 0 24px', fontSize: '28px', fontWeight: '800' }}>{title}</h1>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 20px', fontSize: '15px', lineHeight: 1.5 }}>{message}</p>
        <button onClick={onAction} style={{ height: '52px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', width: '100%' }}>
          {action}
        </button>
      </div>
    </div>
  )
}

function Field({ label, hint, optional, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
        <p style={{ ...labelStyle, margin: 0 }}>
          {label}
          {optional && <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)', opacity: 0.6 }}> · optional</span>}
        </p>
        {hint && <span style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.7, fontStyle: 'italic' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function ScoutedCard({ entry }) {
  const teamNum = entry.scouted_team_number ?? entry.teamNumber
  const stars = entry.reliability ? '★'.repeat(entry.reliability) + '☆'.repeat(5 - entry.reliability) : null
  const tags = [DRIVETRAIN_LABELS[entry.drivetrain], INTAKE_LABELS[entry.intake], SCORING_LABELS[entry.scoring]].filter(Boolean)
  const pending = entry._synced === false

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${pending ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`, borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontWeight: '700', fontSize: '15px', minWidth: '58px' }}>{teamNum}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {stars && <div style={{ color: '#f59e0b', fontSize: '12px', letterSpacing: '1px' }}>{stars}</div>}
        {tags.length > 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tags.join(' · ')}</div>}
      </div>
      {entry.note && <span style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{entry.note}</span>}
      {pending && <span style={{ fontSize: '11px', color: '#fbbf24', flexShrink: 0 }}>pending</span>}
    </div>
  )
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

const labelStyle = { margin: 0, color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }
