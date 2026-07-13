import { useState, useEffect, useRef } from 'react'

// A small "?" affordance that reveals a one-line explanation. Works on both
// hover (desktop) and tap (mobile); closes on outside tap, Escape, or scroll.
// The tooltip is rendered with position:fixed anchored to the button, so it is
// never clipped by an ancestor's `overflow: hidden` (the dashboard cards use it).
//   <InfoTip label="Offline Queue" text="Reports saved without a connection…" />
export default function InfoTip({ label, text }) {
  const [pos, setPos] = useState(null) // { top, left } in viewport coords, or null = closed
  const wrapRef = useRef(null)
  const btnRef = useRef(null)
  const open = pos != null

  function place() {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(240, window.innerWidth * 0.74)
    const left = Math.min(r.left, window.innerWidth - width - 8)
    setPos({ top: r.bottom + 7, left: Math.max(8, left) })
  }
  function close() { setPos(null) }

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) close() }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    // Fixed coords go stale on scroll/resize — simplest correct behaviour is to close.
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <span
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}
      onMouseEnter={place}
      onMouseLeave={close}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label={label ? `${label}: ${text}` : text}
        aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (open) close(); else place() }}
        style={{
          width: '16px', height: '16px', flexShrink: 0, padding: 0,
          borderRadius: '50%', cursor: 'pointer',
          border: '1px solid var(--border)', background: 'var(--surface-2)',
          color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', lineHeight: 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'inherit',
        }}
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'fixed', top: pos.top, left: pos.left, zIndex: 1100,
            width: 'max-content', maxWidth: 'min(240px, 74vw)',
            padding: '8px 11px', borderRadius: '9px',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.28)',
            color: 'var(--text)', fontSize: '12px', fontWeight: '400',
            lineHeight: 1.45, letterSpacing: 0, textTransform: 'none',
            whiteSpace: 'normal', textAlign: 'left', cursor: 'default',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
