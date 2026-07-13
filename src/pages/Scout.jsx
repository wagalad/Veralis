import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../hooks/useTeam'
import { useScoutingEntries } from '../hooks/useScoutingEntries'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import OptionGroup from '../components/OptionGroup'

const SCORING_LABELS = { fast: 'Fast', average: 'Average', slow: 'Slow', cant_tell: "Couldn't tell" }
// Label maps for the expandable entry detail rows (mirrors the My Team log).
const DEFENSE_LABELS    = { folds: 'Folds', handles: 'Handles it', unstoppable: 'Unstoppable', didnt_see: "Didn't see" }
const DRIVER_LABELS     = { struggles: 'Struggles', decent: 'Decent', skilled: 'Skilled', didnt_see: "Didn't see" }
const STABILITY_LABELS  = { tippy: 'Tippy', solid: 'Solid', rock_solid: 'Rock-solid' }
const AUTO_LABELS       = { strong: 'Strong', works: 'Works', weak_none: 'Weak/none', didnt_see: "Didn't see" }
const DRIVETRAIN_LABELS = { tank: 'Tank', mecanum: 'Mecanum', xdrive: 'X-drive', other: 'Other/unsure' }
const INTAKE_LABELS     = { strong: 'Strong', okay: 'Okay', weak: 'Weak', none: 'None/unsure' }

// Threat level is the headline eye-test judgment; each level carries a heat color.
const THREAT_META = {
  low:        { label: 'Low',        color: '#22c55e' },
  medium:     { label: 'Medium',     color: '#f59e0b' },
  high:       { label: 'High',       color: '#fb923c' },
  must_scout: { label: 'Must-scout', color: 'var(--accent)' },
}
const THREAT_ORDER = ['low', 'medium', 'high', 'must_scout']
const PLAY_CHIPS = ['Rush early', 'Avoid', 'Great pick', 'Exploit auto', 'Play our game']

// Eye-test fields first (how a robot PLAYS); drivetrain/intake are specs, kept
// under "More details". All optional — a scout may not assess everything.
const emptyForm = {
  threat_level: null, scoring: null, under_defense: null, driver_skill: null,
  stability: null, autonomous: null, reliability: null, how_to_play: '',
  note: '', photo: null,
  drivetrain: null, intake: null,
}

export default function Scout() {
  const { user } = useAuth()
  const { team, loading: teamLoading } = useTeam()
  const { entries, loading: entriesLoading, save, update } = useScoutingEntries(team)
  const online = useOnlineStatus()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [form, setForm] = useState(emptyForm)
  const [scoutedTeam, setScoutedTeam] = useState(
    searchParams.get('team')?.toUpperCase() ?? '16858A'
  )
  const [lastScouted, setLastScouted] = useState(null)
  const [lastWasEdit, setLastWasEdit] = useState(false)
  const [editing, setEditing] = useState(null) // entry being edited, or null
  const [saving, setSaving] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const photoRef = useRef(null)

  function setField(field, value) { setForm(f => ({ ...f, [field]: value })) }

  // Load an existing entry into the form for editing (author-only; the Edit
  // affordance is only shown on entries the current user created).
  function startEdit(entry) {
    setEditing(entry)
    setForm({
      threat_level: entry.threat_level ?? null,
      scoring: entry.scoring ?? null,
      under_defense: entry.under_defense ?? null,
      driver_skill: entry.driver_skill ?? null,
      stability: entry.stability ?? null,
      autonomous: entry.autonomous ?? null,
      reliability: entry.reliability ?? null,
      how_to_play: entry.how_to_play ?? '',
      note: entry.note ?? '',
      photo: null,
      drivetrain: entry.drivetrain ?? null,
      intake: entry.intake ?? null,
    })
    setScoutedTeam(entry.scouted_team_number)
    setShowMore(Boolean(entry.drivetrain || entry.intake))
    setLastScouted(null)
    if (photoRef.current) photoRef.current.value = ''
    scrollAppToTop()
  }

  function cancelEdit() {
    setEditing(null)
    setForm(emptyForm)
    if (photoRef.current) photoRef.current.value = ''
  }

  // Deep-link into edit mode from another page (e.g. My Team's scouting log).
  // The entry to edit is handed over via router state; clear it after applying
  // so a refresh or back-navigation doesn't re-open the editor.
  useEffect(() => {
    const entry = location.state?.editEntry
    if (entry) {
      startEdit(entry)
      navigate('/scout', { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (file) setField('photo', file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const team = scoutedTeam.trim().toUpperCase()
    if (!team) return
    setSaving(true)
    if (editing) {
      await update(editing, team, form, form.photo)
      setEditing(null)
      setLastWasEdit(true)
    } else {
      await save(team, form, form.photo)
      setLastWasEdit(false)
    }
    setLastScouted(team)
    setForm(emptyForm)
    if (photoRef.current) photoRef.current.value = ''
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
            {lastScouted} {lastWasEdit ? 'updated' : 'saved'}{!online ? ' locally' : ''}
          </span>
          <button onClick={() => setLastScouted(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(34,197,94,0.6)', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
      )}

      {/* Edit-mode banner */}
      {editing && (
        <div style={{ background: 'rgba(204,0,0,0.08)', border: '1.5px solid var(--accent)', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent)' }}>Editing report</span>
          <button type="button" onClick={cancelEdit} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>Cancel</button>
        </div>
      )}

      {/* Team being scouted — an obvious, always-editable text box */}
      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="scout-team" style={{ ...labelStyle, display: 'block', marginBottom: '8px' }}>
          Team number{editing ? ' · editing report' : ''}
        </label>
        <input
          id="scout-team"
          value={scoutedTeam}
          onChange={e => setScoutedTeam(e.target.value.toUpperCase())}
          placeholder="e.g. 16858A"
          maxLength={12}
          autoComplete="off"
          spellCheck={false}
          style={{
            width: '100%', height: '56px', padding: '0 16px', boxSizing: 'border-box',
            background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: '12px',
            color: 'var(--text)', fontFamily: 'inherit', fontSize: '24px', fontWeight: '800',
            letterSpacing: '0.02em', outline: 'none',
          }}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

          <Field label="Threat level">
            <ThreatGroup value={form.threat_level} onChange={v => setField('threat_level', v)} />
          </Field>

          <Field label="Scoring">
            <OptionGroup value={form.scoring} onChange={v => setField('scoring', v)} options={[
              { value: 'fast', label: 'Fast' },
              { value: 'average', label: 'Average' },
              { value: 'slow', label: 'Slow' },
              { value: 'cant_tell', label: "Couldn't tell" },
            ]} />
          </Field>

          <Field label="Under defense" hint="how they hold up when defended">
            <OptionGroup value={form.under_defense} onChange={v => setField('under_defense', v)} options={[
              { value: 'folds', label: 'Folds' },
              { value: 'handles', label: 'Handles it' },
              { value: 'unstoppable', label: 'Unstoppable' },
              { value: 'didnt_see', label: "Didn't see" },
            ]} />
          </Field>

          <Field label="Driver skill">
            <OptionGroup value={form.driver_skill} onChange={v => setField('driver_skill', v)} options={[
              { value: 'struggles', label: 'Struggles' },
              { value: 'decent', label: 'Decent' },
              { value: 'skilled', label: 'Skilled' },
              { value: 'didnt_see', label: "Didn't see" },
            ]} />
          </Field>

          <Field label="Stability">
            <OptionGroup value={form.stability} onChange={v => setField('stability', v)} options={[
              { value: 'tippy', label: 'Tippy' },
              { value: 'solid', label: 'Solid' },
              { value: 'rock_solid', label: 'Rock-solid' },
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

          <Field label="How to play them" hint="the actionable verdict">
            <HowToPlay value={form.how_to_play} onChange={v => setField('how_to_play', v)} />
          </Field>

          <Field label="Note" optional>
            <textarea value={form.note} onChange={e => setField('note', e.target.value)}
              placeholder="e.g. exposed intake, panics under pressure…"
              maxLength={80}
              rows={2}
              style={{ width: '100%', background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '15px', padding: '12px 14px', minHeight: '54px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.4 }}
            />
            {form.note.length >= 60 && (
              <p style={{ margin: '5px 2px 0', textAlign: 'right', fontSize: '11px', fontVariantNumeric: 'tabular-nums', color: form.note.length >= 80 ? '#f59e0b' : 'var(--text-muted)' }}>
                {80 - form.note.length} left
              </p>
            )}
          </Field>

          <Field label="Photo" optional>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhoto} />
            <button type="button" className="v-btn" onClick={() => photoRef.current?.click()} style={{
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

          {/* Robot specs — low eye-test value, collapsed so the fast path stays lean */}
          <div>
            <button type="button" className="v-btn" onClick={() => setShowMore(s => !s)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%',
                minHeight: '48px', padding: '0 14px', cursor: 'pointer',
                background: 'var(--surface-2)', border: '1px dashed var(--accent)', borderRadius: '10px',
                color: 'var(--text)', fontFamily: 'inherit', fontSize: '14px', fontWeight: '600',
              }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{showMore ? '▲' : '▼'}</span>
              {showMore ? 'Hide robot specs' : 'Add robot specs · drivetrain, intake'}
            </button>
            {showMore && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', marginTop: '16px' }}>
                <Field label="Drivetrain" optional>
                  <OptionGroup value={form.drivetrain} onChange={v => setField('drivetrain', v)} options={[
                    { value: 'tank', label: 'Tank' },
                    { value: 'mecanum', label: 'Mecanum' },
                    { value: 'xdrive', label: 'X-drive' },
                    { value: 'other', label: 'Other/unsure' },
                  ]} />
                </Field>
                <Field label="Intake / pickup" optional>
                  <OptionGroup value={form.intake} onChange={v => setField('intake', v)} options={[
                    { value: 'strong', label: 'Strong' },
                    { value: 'okay', label: 'Okay' },
                    { value: 'weak', label: 'Weak' },
                    { value: 'none', label: 'None/unsure' },
                  ]} />
                </Field>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            {editing && (
              <button type="button" className="v-btn" onClick={cancelEdit} disabled={saving} style={{
                height: '58px', padding: '0 22px',
                background: 'var(--surface-2)', color: 'var(--text-muted)',
                border: '1px solid var(--border)', borderRadius: '12px',
                fontSize: '16px', fontWeight: '600', cursor: saving ? 'default' : 'pointer',
              }}>
                Cancel
              </button>
            )}
            {(() => { const disabled = saving || !scoutedTeam.trim(); return (
            <button className="v-btn v-btn-accent" type="submit" disabled={disabled} style={{
              flex: 1, height: '58px',
              background: disabled ? 'var(--surface-2)' : 'var(--accent)',
              color: disabled ? 'var(--text-muted)' : '#fff',
              border: 'none', borderRadius: '12px', fontSize: '17px', fontWeight: '700',
              cursor: disabled ? 'default' : 'pointer',
            }}>
              {saving ? (editing ? 'Updating…' : 'Saving…') : !scoutedTeam.trim() ? 'Enter a team number' : `${editing ? 'Update' : 'Save'} — ${scoutedTeam.trim()}`}
            </button>
            )})()}
          </div>
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
              <ScoutedCard
                key={entry.id ?? entry._local_id ?? i}
                entry={entry}
                canEdit={true}
                isEditing={editing && (editing.id ? editing.id === entry.id : editing._local_id === entry._local_id)}
                onEdit={() => startEdit(entry)}
              />
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
        <button className="v-btn v-btn-accent" onClick={onAction} style={{ height: '52px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', width: '100%' }}>
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

// Threat level — the prominent, heat-colored headline judgment. Single tap.
function ThreatGroup({ value, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
      {THREAT_ORDER.map(key => {
        const { label, color } = THREAT_META[key]
        const active = value === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(active ? null : key)}
            style={{
              minHeight: '56px', padding: '10px 4px', borderRadius: '10px', cursor: 'pointer',
              border: `1.5px solid ${active ? color : 'var(--border)'}`,
              background: active ? `color-mix(in oklch, ${color} 16%, transparent)` : 'var(--surface-2)',
              color: active ? color : 'var(--text)',
              fontSize: '14px', fontWeight: active ? '700' : '400', lineHeight: '1.15',
              transition: 'border-color 0.1s, background 0.1s, color 0.1s',
              WebkitUserSelect: 'none', userSelect: 'none',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// How to play them — quick-select chips, or type a short custom verdict.
function HowToPlay({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {PLAY_CHIPS.map(chip => {
          const active = value === chip
          return (
            <button
              key={chip}
              type="button"
              onClick={() => onChange(active ? '' : chip)}
              style={{
                padding: '10px 14px', borderRadius: '999px', cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'rgba(204,0,0,0.13)' : 'var(--surface-2)',
                color: active ? 'var(--accent)' : 'var(--text)',
                fontSize: '13px', fontWeight: active ? '700' : '500',
                WebkitUserSelect: 'none', userSelect: 'none',
              }}
            >
              {chip}
            </button>
          )
        })}
      </div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="or type a quick verdict…"
        maxLength={80}
        style={{ width: '100%', height: '46px', background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '14px', padding: '0 14px', fontFamily: 'inherit', outline: 'none' }}
      />
    </div>
  )
}

// Tap to expand into the full report — same interaction as the My Team log.
function ScoutedCard({ entry, canEdit, isEditing, onEdit }) {
  const [open, setOpen] = useState(false)
  const teamNum = entry.scouted_team_number ?? entry.teamNumber
  const stars = entry.reliability ? '★'.repeat(entry.reliability) + '☆'.repeat(5 - entry.reliability) : null
  const threat = THREAT_META[entry.threat_level]
  const tags = [SCORING_LABELS[entry.scoring], entry.how_to_play].filter(Boolean)
  const pending = entry._synced === false

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${isEditing ? 'var(--accent)' : pending ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`, borderRadius: '10px', overflow: 'hidden' }}>
      {/* Collapsed header — tap anywhere to expand */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px', fontFamily: 'inherit', color: 'inherit' }}
      >
        <span style={{ fontWeight: '700', fontSize: '15px', minWidth: '58px' }}>{teamNum}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {(threat || stars) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {threat && (
                <span style={{ fontSize: '11px', fontWeight: '700', color: threat.color, border: `1px solid ${threat.color}`, background: `color-mix(in oklch, ${threat.color} 14%, transparent)`, borderRadius: '999px', padding: '1px 8px' }}>
                  {threat.label}
                </span>
              )}
              {stars && <span style={{ color: '#f59e0b', fontSize: '12px', letterSpacing: '1px' }}>{stars}</span>}
            </div>
          )}
          {tags.length > 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tags.join(' · ')}</div>}
        </div>
        {pending && <span style={{ fontSize: '11px', color: '#fbbf24', flexShrink: 0 }}>pending</span>}
        <span style={{ flexShrink: 0, fontSize: '16px', color: 'var(--text-muted)', lineHeight: 1, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}>⌄</span>
      </button>

      {/* Expanded detail */}
      {open && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <DetailRow k="Threat" v={threat?.label} />
          <DetailRow k="Scoring" v={SCORING_LABELS[entry.scoring]} />
          <DetailRow k="Under defense" v={DEFENSE_LABELS[entry.under_defense]} />
          <DetailRow k="Driver skill" v={DRIVER_LABELS[entry.driver_skill]} />
          <DetailRow k="Stability" v={STABILITY_LABELS[entry.stability]} />
          <DetailRow k="Autonomous" v={AUTO_LABELS[entry.autonomous]} />
          <DetailRow k="Reliability" v={entry.reliability ? `${entry.reliability}/5` : null} />
          <DetailRow k="How to play" v={entry.how_to_play} />
          <DetailRow k="Drivetrain" v={DRIVETRAIN_LABELS[entry.drivetrain]} />
          <DetailRow k="Intake" v={INTAKE_LABELS[entry.intake]} />
          {entry.photo_url && <DetailRow k="Photo" v="Attached" />}
          {entry.note && (
            <div style={{ marginTop: '2px' }}>
              <p style={{ ...detailK, marginBottom: '2px' }}>Note</p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, fontStyle: 'italic' }}>"{entry.note}"</p>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : ''}
            </span>
            {canEdit && (
              <button type="button" onClick={onEdit} aria-label={`Edit ${teamNum} report`} style={{
                flexShrink: 0, background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--accent)', borderRadius: '8px',
                padding: '6px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              }}>
                {isEditing ? 'Editing' : 'Edit report'}
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

// The app scrolls inside <main class="app-main">, not the window — so scroll
// that container (falls back to window if the layout ever changes).
function scrollAppToTop() {
  const main = document.querySelector('.app-main')
  if (main) main.scrollTo({ top: 0, behavior: 'smooth' })
  else window.scrollTo({ top: 0, behavior: 'smooth' })
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
