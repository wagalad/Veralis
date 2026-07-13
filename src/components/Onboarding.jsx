import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

// A short, skippable tour shown once on a user's first entry, and re-openable
// any time from Settings › How to use. Content mirrors the five bottom-nav tabs.
const STEPS = [
  {
    emoji: '👋',
    title: 'Welcome to Veralis',
    body: "Your team's shared VEX scouting pool — everyone sees the same reports in real time. Here's a 30-second tour.",
  },
  {
    emoji: '📡',
    title: 'Home · Live Event Mode',
    body: 'Load your event to see your match schedule, tap any team for a quick scouting peek, and watch a live countdown to when you should queue.',
  },
  {
    emoji: '🔎',
    title: 'Search any team',
    body: 'Look up any VEX team for their record, skills scores, OpenSkill rating, awards — plus your own team’s scouting notes on them.',
  },
  {
    emoji: '📋',
    title: 'Scout in seconds',
    body: 'Log how a robot plays with a few taps. It works offline — reports save on your phone and sync automatically once you’re back online.',
  },
  {
    emoji: '👥',
    title: 'My Team',
    body: 'Create a team or join one with an 8-character invite code. Every member shares the same scouting log, and admins manage the roster.',
  },
  {
    emoji: '📖',
    title: 'Rules & Calculator',
    body: 'A plain-language reference for this season’s game, plus a live match-score calculator for strategy. That’s it — you’re all set!',
  },
]

export function OnboardingModal({ open, onClose }) {
  const [step, setStep] = useState(0)

  // Reset to the first step whenever the modal is (re)opened.
  useEffect(() => { if (open) setStep(0) }, [open])

  // Esc to close; lock background scroll while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  const isLast = step === STEPS.length - 1
  const s = STEPS[step]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How to use Veralis"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '420px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '18px', padding: '26px 24px 20px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
        }}
      >
        {/* Skip */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: '2px 4px' }}
          >
            {isLast ? 'Close' : 'Skip'}
          </button>
        </div>

        <div style={{ fontSize: '40px', lineHeight: 1, marginBottom: '14px' }}>{s.emoji}</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: '800', letterSpacing: '-0.01em' }}>{s.title}</h2>
        <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.55, color: 'var(--text-muted)' }}>{s.body}</p>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '6px', margin: '22px 0 18px' }}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                height: '6px', flex: i === step ? '0 0 22px' : '0 0 6px',
                borderRadius: '3px',
                background: i === step ? 'var(--accent)' : 'var(--border)',
                transition: 'flex-basis 0.2s, background 0.2s',
              }}
            />
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {step > 0 && (
            <button
              type="button"
              className="v-btn v-btn-ghost"
              onClick={() => setStep(s => s - 1)}
              style={{ height: '48px', padding: '0 18px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '11px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            className="v-btn v-btn-accent"
            onClick={() => (isLast ? onClose() : setStep(s => s + 1))}
            style={{ flex: 1, height: '48px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '11px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}
          >
            {isLast ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
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
