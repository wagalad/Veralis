import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

// Public marketing landing shown at "/" for logged-out visitors.
// Themed through the app's CSS vars (--bg, --surface, --accent, …) so it
// tracks light/dark automatically. Designed dark-first: the scene is a scout
// in a loud competition venue, phone out between matches, deciding picks.

const MONO = "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace"
const RED = 'var(--accent)'
// Brighter, theme-aware red for small text so it clears WCAG AA on the dark ground.
const EYEBROW = 'var(--lz-eyebrow)'

// Reveal-on-scroll: adds .is-visible once an element enters the viewport.
function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('is-visible'); io.disconnect() } },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

function Reveal({ children, delay = 0, style, className = '' }) {
  const ref = useReveal()
  return (
    <div ref={ref} className={`lz-reveal ${className}`.trim()} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  )
}

function Eyebrow({ children, color = 'var(--text-muted)' }) {
  return (
    <p style={{ margin: 0, fontFamily: MONO, fontSize: '12px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color }}>
      {children}
    </p>
  )
}

export default function Landing() {
  return (
    <div className="lz" style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100%', overflowX: 'hidden' }}>
      <Nav />
      <Hero />
      <LogoStrip />
      <Steps />
      <Features />
      <OpenSkillBand />
      <Trust />
      <FinalCta />
      <Footer />
    </div>
  )
}

// ── Top nav ───────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in oklch, var(--bg) 82%, transparent)', backdropFilter: 'saturate(140%) blur(10px)', borderBottom: '1px solid var(--border)' }}>
      <div className="lz-wrap" style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Wordmark />
        <nav style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to="/login" className="lz-link" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', padding: '11px 12px' }}>
            Sign in
          </Link>
          <Link to="/login?mode=signup" className="lz-cta" style={{ fontSize: '14px', fontWeight: 700, color: '#fff', background: RED, textDecoration: 'none', padding: '9px 16px', borderRadius: '9px' }}>
            Get started
          </Link>
        </nav>
      </div>
    </header>
  )
}

function Wordmark({ size = 20 }) {
  // Mark asset is 900x680 (ratio 1.324); set both dims so it reserves space (no CLS).
  const h = Math.round(size * 1.5)
  const w = Math.round(h * 1.324)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', fontWeight: 800, fontSize: `${size}px`, letterSpacing: '-0.02em' }}>
      <img src="/logo-mark.png" alt="Veralis logo" width={w} height={h} decoding="async"
        style={{ height: `${h}px`, width: `${w}px`, display: 'block', marginTop: '-1px' }} />
      Veralis
    </span>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section style={{ position: 'relative' }}>
      {/* ambient red glow behind the headline */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(90% 60% at 22% 8%, color-mix(in oklch, var(--accent) 16%, transparent), transparent 60%)', pointerEvents: 'none' }} />
      <div className="lz-wrap" style={{ position: 'relative', padding: 'clamp(56px, 9vw, 104px) 20px clamp(48px, 6vw, 72px)' }}>
        <div className="lz-hero-grid">
          <div>
            <Reveal>
              <Eyebrow color={EYEBROW}>Scouting for VEX teams</Eyebrow>
            </Reveal>
            <Reveal delay={60}>
              <h1 style={{ margin: '18px 0 0', fontSize: 'clamp(34px, 6.4vw, 68px)', lineHeight: 1.03, fontWeight: 850, letterSpacing: '-0.03em', textWrap: 'balance' }}>
                Win alliance selection before the first match.
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p style={{ margin: '22px 0 0', fontSize: 'clamp(16px, 1.9vw, 19px)', lineHeight: 1.55, color: 'var(--text-muted)', maxWidth: '48ch' }}>
                Veralis turns your whole team into one scouting operation. Track every
                match live, log structured reports on the teams you watch, and rank
                them with a real skill rating, all from your phone in the pits.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '32px' }}>
                <Link to="/login?mode=signup" className="lz-cta" style={{ fontSize: '16px', fontWeight: 700, color: '#fff', background: RED, textDecoration: 'none', padding: '15px 26px', borderRadius: '11px' }}>
                  Start scouting free
                </Link>
                <a href="#how" className="lz-cta" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none', padding: '15px 24px', borderRadius: '11px' }}>
                  See how it works
                </a>
              </div>
            </Reveal>
            <Reveal delay={240}>
              <p style={{ margin: '18px 0 0', fontFamily: MONO, fontSize: '12.5px', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
                Free for teams · Works offline · Private to your roster
              </p>
            </Reveal>
          </div>

          <Reveal delay={140}>
            <HeroMock />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// A live "Time to Queue" mock that echoes the real Live Event Mode feature.
function HeroMock() {
  const [secs, setSecs] = useState(277)
  useEffect(() => {
    const id = setInterval(() => setSecs(s => (s <= 1 ? 312 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [])
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  const urgent = secs <= 300

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 24px 60px -30px rgba(0,0,0,0.55)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Live event</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#22c55e' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e' }} />
          Online
        </span>
      </div>

      <div style={{ textAlign: 'center', padding: '26px 18px 22px', background: 'radial-gradient(120% 90% at 50% -10%, color-mix(in oklch, var(--accent) 12%, transparent), transparent 70%)' }}>
        <p style={{ margin: 0, fontFamily: MONO, fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Time to queue</p>
        <p style={{ margin: '8px 0 6px', fontSize: '58px', fontWeight: 850, lineHeight: 1, letterSpacing: '-0.03em', color: RED, fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</p>
        {/* Fixed height so the card doesn't jump when the pill toggles across 5:00. */}
        <div style={{ minHeight: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {urgent && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 11px', borderRadius: '999px', background: 'color-mix(in oklch, #f59e0b 16%, transparent)', color: '#f59e0b', fontWeight: 700, fontSize: '11.5px' }}>⚠ Leave now</span>
          )}
        </div>
        <p style={{ margin: '10px auto 0', fontSize: '13px', color: 'var(--text-muted)', maxWidth: '30ch' }}>
          Head to the field queue for <b style={{ color: 'var(--text)' }}>Qualifier 41</b>.
        </p>
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }}>
        <MockRow team="16858A" tag="Elite · 88" allies="vs 2000B, 9791" />
        <MockRow team="10833A" tag="Strong · 71" allies="with 24C" divider />
        <MockRow team="21101R" tag="Solid · 58" allies="vs 315P, 88" divider />
      </div>
    </div>
  )
}

function MockRow({ team, tag, allies, divider }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderTop: divider ? '1px solid var(--border)' : 'none' }}>
      <span style={{ fontWeight: 800, fontSize: '14px', width: '58px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{team}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: '12.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{allies}</span>
      <span style={{ fontFamily: MONO, fontSize: '11.5px', fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>{tag}</span>
    </div>
  )
}

// ── Credibility strip ───────────────────────────────────────────────────────

function LogoStrip() {
  const items = ['V5RC', 'VEX U', 'VEX IQ', 'Offline-first', 'Private by team']
  return (
    <div className="lz-wrap" style={{ padding: '0 20px 8px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px', alignItems: 'center', justifyContent: 'center', padding: '22px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        {items.map(i => (
          <span key={i} style={{ fontFamily: MONO, fontSize: '12.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{i}</span>
        ))}
      </div>
    </div>
  )
}

// ── How it works ────────────────────────────────────────────────────────────

function Steps() {
  const steps = [
    ['01', 'Create your team', 'Sign up and start a team, or join yours with a code. Every scout you invite shares one synced pool of reports.'],
    ['02', 'Load your event', 'Pick your competition and Veralis pulls your full match schedule and the teams you will face.'],
    ['03', 'Scout every match', 'Log drivetrain, scoring, autonomous, reliability and a quick note in seconds, right from the stands.'],
    ['04', 'Pick with proof', 'Sort by skill rating and past reports at alliance selection, instead of gut feel and half-remembered matches.'],
  ]
  return (
    <section id="how" style={{ padding: 'clamp(56px, 8vw, 96px) 0' }}>
      <div className="lz-wrap">
        <Reveal>
          <Eyebrow>How it works</Eyebrow>
          <h2 style={{ margin: '14px 0 0', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 820, letterSpacing: '-0.025em', maxWidth: '20ch', textWrap: 'balance' }}>
            From first match to final pick, in one app.
          </h2>
        </Reveal>
        <div className="lz-steps" style={{ marginTop: '40px' }}>
          {steps.map(([n, title, body], i) => (
            <Reveal key={n} delay={i * 70}>
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontFamily: MONO, fontSize: '13px', fontWeight: 700, color: EYEBROW, letterSpacing: '0.08em' }}>{n}</span>
                <div style={{ height: '1px', background: 'var(--border)', margin: '14px 0 16px' }} />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 750, letterSpacing: '-0.01em' }}>{title}</h3>
                <p style={{ margin: '8px 0 0', fontSize: '14px', lineHeight: 1.55, color: 'var(--text-muted)' }}>{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Feature bento ───────────────────────────────────────────────────────────

function Features() {
  return (
    <section style={{ padding: '0 0 clamp(56px, 8vw, 96px)' }}>
      <div className="lz-wrap">
        <Reveal>
          <Eyebrow>What is inside</Eyebrow>
          <h2 style={{ margin: '14px 0 34px', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 820, letterSpacing: '-0.025em', maxWidth: '22ch', textWrap: 'balance' }}>
            Everything a scouting lead needs, nothing they do not.
          </h2>
        </Reveal>

        <div className="lz-bento">
          <Reveal style={{ height: '100%' }}>
            <FeatureTile
              title="Live Event Mode"
              body="Your match schedule with a countdown to when you queue. It follows the real event, so a late match reads 'queue now' instead of vanishing."
            >
              <MiniSchedule />
            </FeatureTile>
          </Reveal>

          <Reveal delay={60} style={{ height: '100%' }}>
            <FeatureTile
              title="Structured reports"
              body="Drivetrain, intake, scoring, autonomous, reliability and a short note. Consistent fields mean every scout logs the same thing."
            >
              <ChipRow chips={['Tank', 'Roller intake', 'High goal', 'Auto: yes', '★★★★☆']} />
            </FeatureTile>
          </Reveal>

          <Reveal delay={120} style={{ height: '100%' }}>
            <FeatureTile
              title="Works offline"
              body="Venue Wi-Fi dies, you keep scouting. Reports save on device and sync themselves the moment you reconnect."
            >
              <SyncPill />
            </FeatureTile>
          </Reveal>

          <Reveal delay={60} className="lz-span-2" style={{ height: '100%' }}>
            <FeatureTile
              title="Search any team"
              body="Pull up any team's win-loss record, skills scores, awards and full event history before you ever face them, across V5RC, VEX U and IQ."
            >
              <SearchPreview />
            </FeatureTile>
          </Reveal>

          <Reveal delay={120} style={{ height: '100%' }}>
            <FeatureTile
              title="Private to your team"
              body="Your scouting data is walled off to your roster. Other teams never see your notes, ratings or picks."
            >
              <LockRow />
            </FeatureTile>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function FeatureTile({ title, body, children, className }) {
  return (
    <div className={className} style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', gap: '16px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 780, letterSpacing: '-0.015em' }}>{title}</h3>
        <p style={{ margin: '9px 0 0', fontSize: '14px', lineHeight: 1.55, color: 'var(--text-muted)' }}>{body}</p>
      </div>
      <div style={{ marginTop: 'auto' }}>{children}</div>
    </div>
  )
}

function MiniSchedule() {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '11px', overflow: 'hidden' }}>
      {[['Q38', 'played', 'W 142-97'], ['Q41', 'queue now', ''], ['Q47', '18 min', '']].map(([m, s, r], i) => {
        const now = s === 'queue now'
        return (
          <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 13px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontWeight: 800, fontSize: '13px', width: '34px', fontVariantNumeric: 'tabular-nums' }}>{m}</span>
            <span style={{ flex: 1, fontFamily: MONO, fontSize: '11.5px', color: now ? EYEBROW : 'var(--text-muted)', fontWeight: now ? 700 : 500 }}>{s}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{r}</span>
          </div>
        )
      })}
    </div>
  )
}

function ChipRow({ chips }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
      {chips.map(c => (
        <span key={c} style={{ fontSize: '12px', fontWeight: 600, padding: '5px 10px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}>{c}</span>
      ))}
    </div>
  )
}

function SyncPill() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '11px', padding: '13px 15px' }}>
      <span style={{ color: '#22c55e', fontWeight: 800, fontSize: '15px' }}>✓</span>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>3 reports synced when you reconnected</span>
    </div>
  )
}

function SearchPreview() {
  const rows = [
    ['16858A', '63% win', 'Skills 380', '68 awards'],
    ['24C', '58% win', 'Skills 291', '12 awards'],
  ]
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '11px', overflow: 'hidden' }}>
      {rows.map(([team, ...stats], i) => (
        <div key={team} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 15px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
          <span style={{ fontWeight: 800, fontSize: '14px', width: '62px', fontVariantNumeric: 'tabular-nums' }}>{team}</span>
          {stats.map(s => (
            <span key={s} style={{ fontFamily: MONO, fontSize: '11.5px', color: 'var(--text-muted)' }}>{s}</span>
          ))}
        </div>
      ))}
    </div>
  )
}

function LockRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '11px', padding: '13px 15px' }}>
      <LockIcon />
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Row-level isolation, enforced server-side</span>
    </div>
  )
}

// ── OpenSkill differentiator band ───────────────────────────────────────────

function OpenSkillBand() {
  return (
    <section style={{ padding: 'clamp(24px, 4vw, 40px) 0 clamp(56px, 8vw, 96px)' }}>
      <div className="lz-wrap">
        <Reveal>
          <div style={{ position: 'relative', overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: 'clamp(28px, 4.5vw, 52px)' }}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(80% 120% at 100% 0%, color-mix(in oklch, var(--accent) 14%, transparent), transparent 55%)', pointerEvents: 'none' }} />
            <div className="lz-hero-grid" style={{ position: 'relative', alignItems: 'center' }}>
              <div>
                <Eyebrow color={EYEBROW}>OpenSkill ratings</Eyebrow>
                <h2 style={{ margin: '16px 0 0', fontSize: 'clamp(26px, 3.6vw, 40px)', fontWeight: 830, letterSpacing: '-0.025em', textWrap: 'balance' }}>
                  Rank a team before you ever see their robot.
                </h2>
                <p style={{ margin: '18px 0 0', fontSize: '16px', lineHeight: 1.6, color: 'var(--text-muted)', maxWidth: '46ch' }}>
                  Veralis rates every team with OpenSkill, the same Bayesian system
                  used in competitive matchmaking. It reads real match results and
                  the strength of who they played, so you get one honest number for
                  this season and last, not just raw win percentage.
                </p>
                <Link to="/login?mode=signup" className="lz-cta" style={{ display: 'inline-block', marginTop: '28px', fontSize: '15px', fontWeight: 700, color: '#fff', background: RED, textDecoration: 'none', padding: '13px 22px', borderRadius: '10px' }}>
                  Try it on your rivals
                </Link>
              </div>
              <RatingCard />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function RatingCard() {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 800, fontSize: '17px', fontVariantNumeric: 'tabular-nums' }}>16858A</span>
        <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>OpenSkill</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '14px' }}>
        <span style={{ fontSize: '46px', fontWeight: 850, lineHeight: 1, letterSpacing: '-0.02em', color: '#22c55e', fontVariantNumeric: 'tabular-nums' }}>88</span>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>/ 100</span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', color: '#22c55e', background: 'color-mix(in oklch, #22c55e 15%, transparent)', border: '1px solid color-mix(in oklch, #22c55e 40%, transparent)' }}>Elite</span>
      </div>
      <div style={{ marginTop: '14px', height: '7px', borderRadius: '4px', background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: '88%', background: '#22c55e', borderRadius: '4px' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Last season</span>
        <span style={{ fontSize: '16px', fontWeight: 800, color: '#84cc16', fontVariantNumeric: 'tabular-nums' }}>74</span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Strong</span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: '#22c55e' }}>▲ 14</span>
      </div>
    </div>
  )
}

// ── Trust strip ─────────────────────────────────────────────────────────────

function Trust() {
  return (
    <section style={{ padding: '0 0 clamp(56px, 8vw, 96px)' }}>
      <div className="lz-wrap">
        <div className="lz-trust">
          <Reveal>
            <TrustCard icon={<BoltIcon />} title="Built for the pit, not the desk" body="Big touch targets, one-hand reach and a countdown you can read across the stands. Every action is two taps or fewer." />
          </Reveal>
          <Reveal delay={70}>
            <TrustCard icon={<LockIcon />} title="Your data stays yours" body="Scouting notes are isolated per team and never shared. No ads, no selling data, no other team peeking at your board." />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function TrustCard({ icon, title, body }) {
  return (
    <div style={{ height: '100%', display: 'flex', gap: '15px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px' }}>
      <span style={{ flexShrink: 0, width: '40px', height: '40px', display: 'grid', placeItems: 'center', borderRadius: '10px', background: 'color-mix(in oklch, var(--accent) 12%, transparent)', color: RED }}>{icon}</span>
      <div>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 760, letterSpacing: '-0.01em' }}>{title}</h3>
        <p style={{ margin: '7px 0 0', fontSize: '14px', lineHeight: 1.55, color: 'var(--text-muted)' }}>{body}</p>
      </div>
    </div>
  )
}

// ── Final CTA ────────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section style={{ padding: '0 0 clamp(64px, 9vw, 110px)' }}>
      <div className="lz-wrap">
        <Reveal>
          <div style={{ position: 'relative', overflow: 'hidden', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '22px', padding: 'clamp(44px, 7vw, 80px) 24px' }}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(70% 120% at 50% 0%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <h2 style={{ margin: 0, fontSize: 'clamp(30px, 5vw, 52px)', fontWeight: 850, letterSpacing: '-0.03em', textWrap: 'balance' }}>
                Your next event starts scouting itself.
              </h2>
              <p style={{ margin: '18px auto 0', fontSize: '17px', color: 'var(--text-muted)', maxWidth: '44ch', lineHeight: 1.55 }}>
                Set up your team in two minutes and walk into the next competition with a real board.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '30px' }}>
                <Link to="/login?mode=signup" className="lz-cta" style={{ fontSize: '16px', fontWeight: 700, color: '#fff', background: RED, textDecoration: 'none', padding: '15px 28px', borderRadius: '11px' }}>
                  Start scouting free
                </Link>
                <Link to="/login" className="lz-cta" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', background: 'var(--bg)', border: '1px solid var(--border)', textDecoration: 'none', padding: '15px 26px', borderRadius: '11px' }}>
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)' }}>
      <div className="lz-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between', padding: '28px 20px' }}>
        <Wordmark size={17} />
        <nav style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <a href="#how" className="lz-link" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>How it works</a>
          <Link to="/privacy" className="lz-link" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy</Link>
          <Link to="/terms" className="lz-link" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>Terms</Link>
          <Link to="/login" className="lz-link" style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </nav>
      </div>
      <div className="lz-wrap" style={{ padding: '0 20px 26px' }}>
        <p style={{ margin: 0, fontFamily: MONO, fontSize: '11.5px', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
          © {new Date().getFullYear()} Veralis · Independent scouting tool, not affiliated with or endorsed by VEX Robotics or the RECF.
        </p>
      </div>
    </footer>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9z" />
    </svg>
  )
}
