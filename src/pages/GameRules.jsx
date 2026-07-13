import { useState } from 'react'
import RulesAssistant from '../components/RulesAssistant'

// ── Game Rules ────────────────────────────────────────────────────────────────
// A plain-language quick reference for this season's V5RC game. This is our own
// summary of publicly known game facts (scoring values, field counts, rule
// intent) — NOT a reproduction of the copyrighted Game Manual. The official
// manual remains the only authoritative source, and we link to it prominently.

const OFFICIAL_MANUAL_URL = 'https://link.vex.com/docs/26-27/v5rc/game-manual'

export default function GameRules() {
  const [tab, setTab] = useState('rules')
  return (
    <div style={{ padding: '20px 16px 80px', maxWidth: '560px', margin: '0 auto' }}>

      {/* Header */}
      <p style={sectionLabel}>VERALIS · GAME</p>
      <h1 style={{ margin: '2px 0 2px', fontSize: '26px', fontWeight: '800', lineHeight: 1.15 }}>
        Override
      </h1>
      <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: '14px' }}>
        VEX V5 Robotics Competition · 2026–2027 season
      </p>

      {/* Tab toggle */}
      <div style={segWrap}>
        <SegBtn active={tab === 'rules'} onClick={() => setTab('rules')}>Rules</SegBtn>
        <SegBtn active={tab === 'calc'} onClick={() => setTab('calc')}>Calculator</SegBtn>
        <SegBtn active={tab === 'ask'} onClick={() => setTab('ask')}>Ask AI</SegBtn>
      </div>

      {tab === 'calc' ? <ScoreCalculator />
        : tab === 'ask' ? <RulesAssistant manualUrl={OFFICIAL_MANUAL_URL} />
          : <RulesView />}
    </div>
  )
}

// ── Rules reference ───────────────────────────────────────────────────────────

function RulesView() {
  return (
    <>
      {/* At-a-glance strip */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <Stat label="Field" value="12′ × 12′" />
        <Stat label="Alliances" value="2 v 2" />
        <Stat label="Match" value="2:00" />
      </div>

      <Section label="Overview" defaultOpen>
        <p style={p}>
          Two alliances — one <b>red</b> and one <b>blue</b>, each made of two teams — face off
          on a 12′ × 12′ field. A match is a <b>15-second Autonomous Period</b> (robots run on
          pre-programmed code, no driver input) followed by a <b>1:45 Driver Controlled Period</b>.
        </p>
        <p style={p}>
          Points come from a few places: building stacks of <b>Pins and Cups</b> in the <b>Goals</b>,
          flipping the <b>Toggles</b> so a quadrant counts for your side, and having your robot sit in
          the middle strip of the field (the <b>Midfield</b>) when time runs out. Whoever adds up more
          points takes the match.
        </p>
        <p style={{ ...p, marginBottom: 0 }}>
          Two bonuses are up for grabs in the autonomous period: an <b>Autonomous Bonus</b> for the
          higher-scoring alliance, and an <b>Autonomous Win Point</b> for completing a set of tasks.
        </p>
      </Section>

      <Section label="Scoring">
        <ScoreRow name="Autonomous Bonus" detail="higher score after auton · 6 each on a tie" pts="12" />
        <ScoreRow name="Alliance-colored Pin (scored)" pts="5" />
        <ScoreRow name="Yellow Pin (scored & owned)" pts="10" />
        <ScoreRow name="Robot in the Midfield at match end" pts="8" last />

        <div style={{ ...calloutBox, marginTop: '12px' }}>
          <p style={{ ...callout, marginTop: 0 }}>
            <b>Owning yellow Pins is the swingy part.</b> A yellow Pin only scores if your alliance
            <i> owns</i> it — either by setting that quadrant's Toggle to your color, or (in the
            Midfield) by ending with more robots there than your opponent. Flip a Toggle and a whole
            quadrant of yellow Pins can change hands.
          </p>
          <p style={{ ...callout, marginBottom: 0 }}>
            Pins and Cups only count when <b>Placed</b> — nested in a Goal or stacked on another
            placed piece.
          </p>
        </div>
      </Section>

      <Section label="Autonomous Win Point">
        <p style={p}>
          Earn the Auton Win Point by finishing the 15-second autonomous period with all of these
          done, and <b>no violations</b>:
        </p>
        <Check>At least <b>7 Pins</b> scored for your alliance</Check>
        <Check>At least <b>3 Goals</b> each holding <b>2+</b> of your scored Pins</Check>
        <Check last>Neither of your robots touching the field perimeter</Check>
        <p style={{ ...noteText, marginBottom: 0 }}>
          Championship-qualifying events may use slightly tougher targets later in the season.
        </p>
      </Section>

      <Section label="Key match rules">
        <Rule>Robots start within an <b>18″ × 18″ × 18″</b> cube, stationary, on your side of the autonomous line.</Rule>
        <Rule>You may expand once the match starts — up to <b>24″ × 24″</b> wide and <b>50″</b> tall.</Rule>
        <Rule>Each robot gets <b>one Pin</b> as a preload. Possession is capped at <b>one Pin + one Cup</b> at a time.</Rule>
        <Rule>During auton, don't cross the autonomous line or interfere with the opponents' side.</Rule>
        <Rule>Alliance Goals and Load Zones are <b>protected</b> — you can't strip pieces from a neutral or opponent Goal.</Rule>
        <Rule last>The <b>final 10 seconds</b> is a "king of the hill" fight for the Midfield — expect contact, and some expansion limits shift.</Rule>
      </Section>

      <Section label="The field">
        <p style={p}>The Override field is stocked with:</p>
        <FieldItem count="63" name="Pins" note="red/blue, red-yellow, blue-yellow & yellow" />
        <FieldItem count="56" name="Cups" note="match loads + pre-placed" />
        <FieldItem count="9" name="Goals" note="4 alliance-colored, 5 neutral" />
        <FieldItem count="4" name="Toggles" note="one per quadrant" />
        <FieldItem count="4" name="Loaders" note="two by each alliance station" last />
      </Section>

      <Section label="Robot & tournament basics">
        <Rule>One robot per team, built from the <b>VEX V5</b> system; must pass an 18″ sizing inspection.</Rule>
        <Rule>One V5 Brain, VEXnet radio, VEX batteries only, with motor limits and a small allowance for custom plastic/pneumatics.</Rule>
        <Rule>Each team plays at least <b>6 qualification matches</b> that set its ranking.</Rule>
        <Rule last>Top-ranked teams captain alliances in selection, then play an elimination bracket for the title.</Rule>
      </Section>

      {/* Official manual link */}
      <a
        href={OFFICIAL_MANUAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px', textDecoration: 'none',
          background: 'var(--accent)', color: '#fff',
          borderRadius: '12px', padding: '16px 18px', marginTop: '22px',
        }}
      >
        <span>
          <span style={{ display: 'block', fontSize: '15px', fontWeight: '800' }}>
            Read the official Game Manual
          </span>
          <span style={{ display: 'block', fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>
            The authoritative source for every rule &amp; ruling
          </span>
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M7 17L17 7" />
          <path d="M7 7h10v10" />
        </svg>
      </a>

      <p style={{ ...noteText, textAlign: 'center', margin: '16px 4px 0' }}>
        This is a plain-language summary for quick reference — not the full rulebook. Always confirm
        rulings against the official Game Manual and the VEX Q&amp;A system, which take precedence.
      </p>

      <p style={{ ...noteText, textAlign: 'center', margin: '10px 4px 0', opacity: 0.8 }}>
        Veralis is an independent tool and is not affiliated with, sponsored by, or endorsed by VEX
        Robotics or Innovation First, Inc. “VEX”, “V5RC”, and “Override” are trademarks of their
        respective owners.
      </p>
    </>
  )
}

// ── Score calculator ──────────────────────────────────────────────────────────
// A full-match calculator: both alliances at once, with a live winner + margin.
// Models Override scoring — alliance Pins ×5, owned yellow Pins ×10, Midfield
// robots ×8, plus the 12-pt Autonomous Bonus (6/6 on a tie). Pure arithmetic,
// no manual text reproduced. It's a strategy helper, not an official scorer.

const PTS = { pins: 5, yellow: 10, mid: 8 }
const ALLIANCE = {
  red:  { name: 'Red Alliance',  color: '#ef4444', tint: 'rgba(239,68,68,0.09)', line: 'rgba(239,68,68,0.35)' },
  blue: { name: 'Blue Alliance', color: '#3b82f6', tint: 'rgba(59,130,246,0.09)', line: 'rgba(59,130,246,0.35)' },
}

function allianceScore(v, autonPts) {
  return v.pins * PTS.pins + v.yellow * PTS.yellow + v.mid * PTS.mid + autonPts
}

function ScoreCalculator() {
  const [red, setRed] = useState({ pins: 0, yellow: 0, mid: 0 })
  const [blue, setBlue] = useState({ pins: 0, yellow: 0, mid: 0 })
  const [auton, setAuton] = useState('none') // 'red' | 'tie' | 'blue' | 'none'

  const redAuton = auton === 'red' ? 12 : auton === 'tie' ? 6 : 0
  const blueAuton = auton === 'blue' ? 12 : auton === 'tie' ? 6 : 0
  const redTotal = allianceScore(red, redAuton)
  const blueTotal = allianceScore(blue, blueAuton)
  const winner = redTotal > blueTotal ? 'red' : blueTotal > redTotal ? 'blue' : 'tie'
  const margin = Math.abs(redTotal - blueTotal)

  const touched = redTotal > 0 || blueTotal > 0

  function reset() {
    setRed({ pins: 0, yellow: 0, mid: 0 })
    setBlue({ pins: 0, yellow: 0, mid: 0 })
    setAuton('none')
  }

  return (
    <>
      {/* Live result */}
      <div style={{ ...card, marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', padding: '16px 12px' }}>
          <TotalBlock label="Red" value={redTotal} color={ALLIANCE.red.color} winning={winner === 'red'} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '72px', gap: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {winner === 'tie' ? 'Result' : 'Margin'}
            </span>
            <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)' }}>
              {winner === 'tie' ? '—' : `+${margin}`}
            </span>
          </div>
          <TotalBlock label="Blue" value={blueTotal} color={ALLIANCE.blue.color} winning={winner === 'blue'} />
        </div>
        <div style={{
          padding: '9px', textAlign: 'center', borderTop: '1px solid var(--border)',
          fontSize: '13px', fontWeight: '700',
          color: winner === 'tie' ? 'var(--text-muted)' : ALLIANCE[winner].color,
        }}>
          {!touched ? 'Enter counts to project a match' : winner === 'tie' ? `Tied at ${redTotal}` : `${ALLIANCE[winner].name} wins by ${margin}`}
        </div>
      </div>

      {/* Autonomous Bonus */}
      <div style={{ ...card, padding: '14px 16px' }}>
        <p style={{ ...sectionLabel, margin: '0 0 4px', color: 'var(--accent)' }}>Autonomous Bonus</p>
        <p style={{ ...callout, margin: '0 0 10px' }}>
          12 points to whichever alliance leads after the 15-second auton period — 6 each on a tie.
        </p>
        <div style={{ ...segWrap, marginBottom: 0 }}>
          <SegBtn active={auton === 'red'} onClick={() => setAuton('red')} color={ALLIANCE.red.color}>Red +12</SegBtn>
          <SegBtn active={auton === 'tie'} onClick={() => setAuton('tie')}>Tie 6·6</SegBtn>
          <SegBtn active={auton === 'blue'} onClick={() => setAuton('blue')} color={ALLIANCE.blue.color}>Blue +12</SegBtn>
          <SegBtn active={auton === 'none'} onClick={() => setAuton('none')}>None</SegBtn>
        </div>
      </div>

      <AlliancePanel side="red" v={red} onChange={setRed} autonPts={redAuton} />
      <AlliancePanel side="blue" v={blue} onChange={setBlue} autonPts={blueAuton} />

      <button
        type="button"
        className="v-btn v-btn-ghost" onClick={reset}
        style={{
          width: '100%', marginTop: '4px', padding: '11px', cursor: 'pointer',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
          color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: '13px', fontWeight: '600',
        }}
      >
        Reset all
      </button>

      <p style={{ ...noteText, textAlign: 'center', margin: '14px 4px 0' }}>
        Unofficial strategy helper — yellow Pins only count when your alliance owns them (via the
        quadrant Toggle or the Midfield). Always confirm final scores with the head referee.
      </p>
    </>
  )
}

function TotalBlock({ label, value, color, winning }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', opacity: winning || value === 0 ? 1 : 0.75 }}>
      <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ display: 'block', fontSize: '34px', fontWeight: '800', color, lineHeight: 1.1 }}>
        {value}
      </span>
    </div>
  )
}

function AlliancePanel({ side, v, onChange, autonPts }) {
  const a = ALLIANCE[side]
  const subtotal = allianceScore(v, autonPts)
  const set = (key) => (n) => onChange({ ...v, [key]: n })
  return (
    <div style={{ ...card, borderColor: a.line, background: a.tint }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '800', color: a.color }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: a.color }} />
          {a.name}
        </span>
        <span style={{ fontSize: '18px', fontWeight: '800', color: a.color }}>{subtotal}</span>
      </div>
      <div style={{ padding: '0 16px 6px' }}>
        <Stepper label="Alliance Pins" mult={PTS.pins} value={v.pins} onChange={set('pins')} accent={a.color} />
        <Stepper label="Yellow Pins (owned)" mult={PTS.yellow} value={v.yellow} onChange={set('yellow')} accent={a.color} />
        <Stepper label="Robots in Midfield" mult={PTS.mid} value={v.mid} onChange={set('mid')} accent={a.color} max={2} last />
      </div>
      {autonPts > 0 && (
        <div style={{ padding: '8px 16px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          + {autonPts} Autonomous Bonus
        </div>
      )}
    </div>
  )
}

function Stepper({ label, mult, value, onChange, accent, max = 99, last }) {
  const btn = (disabled) => ({
    width: '34px', height: '34px', flexShrink: 0, borderRadius: '8px', cursor: disabled ? 'default' : 'pointer',
    border: `1.5px solid ${disabled ? 'var(--border)' : accent}`,
    background: 'transparent', color: disabled ? 'var(--text-muted)' : accent,
    fontSize: '20px', fontWeight: '700', lineHeight: 1, fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.4 : 1,
  })
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
      padding: '9px 0', borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <div>
        <span style={{ display: 'block', fontSize: '14px', color: 'var(--text)' }}>{label}</span>
        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
          {mult} pts each{value > 0 ? ` · ${value * mult}` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button type="button" aria-label={`Decrease ${label}`} disabled={value <= 0} className="v-btn" onClick={() => onChange(Math.max(0, value - 1))} style={btn(value <= 0)}>−</button>
        <span style={{ minWidth: '22px', textAlign: 'center', fontSize: '17px', fontWeight: '800', color: 'var(--text)' }}>{value}</span>
        <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} className="v-btn" onClick={() => onChange(Math.min(max, value + 1))} style={btn(value >= max)}>+</button>
      </div>
    </div>
  )
}

// ── Segmented control ─────────────────────────────────────────────────────────

function SegBtn({ active, onClick, color, children }) {
  return (
    <button
      type="button"
      className="v-btn" onClick={onClick}
      style={{
        flex: 1, padding: '9px 6px', border: 'none', borderRadius: '8px', cursor: 'pointer',
        fontFamily: 'inherit', fontSize: '13px', fontWeight: active ? '700' : '500',
        background: active ? (color || 'var(--accent)') : 'transparent',
        color: active ? '#fff' : 'var(--text-muted)',
        transition: 'background 0.12s',
      }}
    >
      {children}
    </button>
  )
}

// ── Collapsible section card ──────────────────────────────────────────────────

function Section({ label, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={card}>
      <button
        type="button"
        className="v-btn" onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: '14px 16px',
          fontFamily: 'inherit', color: 'var(--text)',
        }}
      >
        <span style={{ ...sectionLabel, margin: 0, color: 'var(--accent)' }}>{label}</span>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Small building blocks ─────────────────────────────────────────────────────

function Stat({ label, value }) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: '90px',
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '10px', padding: '10px 12px',
    }}>
      <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text)' }}>{value}</p>
      <p style={{ margin: '1px 0 0', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
    </div>
  )
}

function ScoreRow({ name, detail, pts, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      padding: '9px 0', borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '14px', color: 'var(--text)' }}>
        {name}
        {detail && <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{detail}</span>}
      </span>
      <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--accent)', flexShrink: 0 }}>{pts}<span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginLeft: '3px' }}>pts</span></span>
    </div>
  )
}

function Check({ children, last }) {
  return (
    <div style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', marginBottom: last ? '12px' : '8px' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.45 }}>{children}</span>
    </div>
  )
}

function Rule({ children, last }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: last ? 0 : '11px' }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: '8px' }} />
      <span style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.5 }}>{children}</span>
    </div>
  )
}

function FieldItem({ count, name, note, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '8px 0', borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent)', minWidth: '34px' }}>{count}</span>
      <span>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{name}</span>
        {note && <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{note}</span>}
      </span>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const sectionLabel = {
  margin: '0 0 6px',
  color: 'var(--text-muted)',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const card = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  marginBottom: '10px',
  overflow: 'hidden',
}

const segWrap = {
  display: 'flex',
  gap: '3px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '3px',
  marginBottom: '18px',
}

const p = {
  margin: '0 0 10px',
  fontSize: '14px',
  lineHeight: 1.55,
  color: 'var(--text)',
}

const calloutBox = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '12px 14px',
}

const callout = {
  margin: '0 0 8px',
  fontSize: '13px',
  lineHeight: 1.5,
  color: 'var(--text-muted)',
}

const noteText = {
  margin: '10px 0 0',
  fontSize: '12px',
  lineHeight: 1.5,
  color: 'var(--text-muted)',
}
