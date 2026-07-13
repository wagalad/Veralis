import { useState, useEffect, useLayoutEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

// An interactive coach-mark tour: an animated spotlight moves across the real
// nav tabs while a callout with an arrow explains each one. Anchoring to the
// nav (always mounted, present on mobile bottom-bar and desktop sidebar alike)
// keeps every target stable, so the highlight lines up on any screen size.
//
// `target` is a selector scoped to `.app-nav`; a null target renders a centered
// card (used for the welcome / wrap-up steps).
const STEPS = [
  {
    target: null,
    emoji: '👋',
    title: 'Welcome to Veralis',
    body: "Your team's shared VEX scouting pool. Here's a 20-second tour of what each tab does.",
  },
  {
    target: 'a[href="/"]',
    emoji: '📡',
    title: 'Home · Live Event Mode',
    body: 'Load your event to see your match schedule, peek at any team’s scouting, and watch a live countdown to when you should queue.',
  },
  {
    target: 'a[href="/search"]',
    emoji: '🔎',
    title: 'Search any team',
    body: 'Look up any VEX team for their record, skills, OpenSkill rating, awards — plus your own team’s notes on them.',
  },
  {
    target: 'a[href="/scout"]',
    emoji: '📋',
    title: 'Scout in seconds',
    body: 'Log how a robot plays with a few taps. Works offline — reports sync automatically once you’re back online.',
  },
  {
    target: 'a[href="/my-team"]',
    emoji: '👥',
    title: 'My Team',
    body: 'Create a team or join with an 8-character invite code. Everyone shares the same scouting log.',
  },
  {
    target: 'a[href="/rules"]',
    emoji: '📖',
    title: 'Rules & Calculator',
    body: 'A plain-language guide to this season’s game, plus a live match-score calculator for strategy.',
  },
  {
    target: 'a[href="/settings"]',
    emoji: '⚙️',
    title: 'You’re all set',
    body: 'Theme, two-factor security, and sign-out live here — and you can replay this tour any time from “How to use Veralis”.',
  },
]

const SPOT_PAD = 8
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

// Given the spotlight rect (viewport coords) or null, decide where the callout
// sits and which edge its arrow points from.
function placeCallout(spot) {
  const vw = window.innerWidth, vh = window.innerHeight
  const W = Math.min(320, vw - 24)
  if (!spot) {
    return { arrow: null, width: W, style: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' } }
  }
  const cx = spot.left + spot.width / 2
  // Desktop sidebar tab (narrow, hugging the left edge) → callout to the right.
  if (spot.left < 160 && spot.width < 220) {
    const top = Math.min(Math.max(spot.top, 12), vh - 240)
    return {
      arrow: { side: 'left', offset: Math.max(16, spot.top + spot.height / 2 - top) },
      width: W, style: { top, left: spot.left + spot.width + 16 },
    }
  }
  // Bottom bar (mobile) → callout above the tab.
  if (spot.top > vh * 0.6) {
    const left = Math.min(Math.max(cx - W / 2, 12), vw - W - 12)
    return {
      arrow: { side: 'bottom', offset: Math.max(16, Math.min(W - 16, cx - left)) },
      width: W, style: { bottom: vh - spot.top + 16, left },
    }
  }
  // Otherwise → callout below the target.
  const left = Math.min(Math.max(cx - W / 2, 12), vw - W - 12)
  return {
    arrow: { side: 'top', offset: Math.max(16, Math.min(W - 16, cx - left)) },
    width: W, style: { top: spot.top + spot.height + 16, left },
  }
}

function Arrow({ arrow }) {
  if (!arrow) return null
  const base = {
    position: 'absolute', width: '12px', height: '12px',
    background: 'var(--surface)', transform: 'rotate(45deg)',
  }
  if (arrow.side === 'top') {
    return <span style={{ ...base, top: '-6px', left: arrow.offset - 6, borderTop: '1px solid var(--border)', borderLeft: '1px solid var(--border)' }} />
  }
  if (arrow.side === 'bottom') {
    return <span style={{ ...base, bottom: '-6px', left: arrow.offset - 6, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }} />
  }
  // left
  return <span style={{ ...base, left: '-6px', top: arrow.offset - 6, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)' }} />
}

export function OnboardingModal({ open, onClose }) {
  const [i, setI] = useState(0)
  const [spot, setSpot] = useState(null)
  const step = STEPS[i]
  const isLast = i === STEPS.length - 1

  useEffect(() => { if (open) setI(0) }, [open])

  // Measure the current step's target (re-measured on step change + resize).
  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      if (!step.target) { setSpot(null); return }
      const el = document.querySelector(`.app-nav ${step.target}`)
      if (!el) { setSpot(null); return }
      const r = el.getBoundingClientRect()
      setSpot({
        top: r.top - SPOT_PAD, left: r.left - SPOT_PAD,
        width: r.width + SPOT_PAD * 2, height: r.height + SPOT_PAD * 2,
      })
    }
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure) }
  }, [open, i, step])

  // Esc to close + lock background scroll while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!open) return null

  const next = () => (isLast ? onClose() : setI(n => n + 1))
  const back = () => setI(n => Math.max(0, n - 1))
  const co = placeCallout(spot)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      {/* Click-catcher — swallows page clicks; tapping the dimmed area advances */}
      <div onClick={next} style={{ position: 'absolute', inset: 0 }} />

      {/* Spotlight: a transparent hole punched with a huge box-shadow. Animating
          its geometry glides the highlight from one tab to the next. */}
      {spot ? (
        <div
          style={{
            position: 'fixed', top: spot.top, left: spot.left, width: spot.width, height: spot.height,
            borderRadius: '12px', boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
            outline: '2px solid var(--accent)', outlineOffset: 0, pointerEvents: 'none',
            transition: `top 0.42s ${EASE}, left 0.42s ${EASE}, width 0.42s ${EASE}, height 0.42s ${EASE}`,
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', pointerEvents: 'none' }} />
      )}

      {/* Callout — re-keyed per step so it fades/slides in on each transition */}
      <div
        key={i}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', ...co.style, width: co.width,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '18px 18px 16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
          animation: `vTourIn 0.32s ${EASE}`,
        }}
      >
        <Arrow arrow={co.arrow} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '24px', lineHeight: 1 }}>{step.emoji}</span>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '-0.01em' }}>{step.title}</h2>
        </div>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--text-muted)' }}>{step.body}</p>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '5px', margin: '16px 0 14px' }}>
          {STEPS.map((_, n) => (
            <span
              key={n}
              onClick={() => setI(n)}
              style={{
                height: '6px', flex: n === i ? '0 0 20px' : '0 0 6px', borderRadius: '3px', cursor: 'pointer',
                background: n === i ? 'var(--accent)' : 'var(--border)',
                transition: `flex-basis 0.2s ${EASE}, background 0.2s`,
              }}
            />
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: '4px 2px' }}
          >
            {isLast ? 'Close' : 'Skip'}
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {i > 0 && (
              <button
                type="button"
                className="v-btn v-btn-ghost"
                onClick={back}
                style={{ height: '42px', padding: '0 16px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="v-btn v-btn-accent"
              onClick={next}
              style={{ height: '42px', padding: '0 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
            >
              {isLast ? 'Get started' : 'Next'}
            </button>
          </div>
        </div>
      </div>

      {/* Opacity-only entrance so it never fights the centered step's transform */}
      <style>{`@keyframes vTourIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  )
}

// Shows the tour exactly once per user (per device), on first authenticated
// entry. Dismissing it records the flag so it never auto-opens again.
export function FirstRunTour() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  const storageKey = user ? `veralis-onboarded-${user.id}` : null

  useEffect(() => {
    if (!storageKey) return
    try {
      if (!localStorage.getItem(storageKey)) setOpen(true)
    } catch { /* private mode / storage blocked — just skip the tour */ }
  }, [storageKey])

  function close() {
    setOpen(false)
    try { if (storageKey) localStorage.setItem(storageKey, '1') } catch { /* ignore */ }
  }

  return <OnboardingModal open={open} onClose={close} />
}
