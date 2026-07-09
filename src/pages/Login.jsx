import { useState, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { supabase } from '../lib/supabase'

// Public hCaptcha site key (safe to ship). The real key is domain-locked to
// veralis.app in production; hCaptcha's universal test key is used in dev.
const HCAPTCHA_SITEKEY = import.meta.env.PROD
  ? '4462ebd8-ea3e-44e0-b1ae-c544f670fe08'
  : '10000000-ffff-ffff-ffff-000000000001'

export default function Login() {
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(null)
  const [captchaToken, setCaptchaToken] = useState(null)
  const [showPw, setShowPw] = useState(false)
  const captchaRef = useRef(null)
  const navigate = useNavigate()

  async function handleOAuth(provider) {
    setError(null)
    setOauthLoading(provider)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/my-team' },
    })
    if (error) setError(error.message)
    setOauthLoading(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const options = { captchaToken }
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password, options })
        if (error) throw error
        setSuccess('Check your email to confirm your account, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password, options })
        if (error) throw error
        navigate('/my-team')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      // hCaptcha tokens are single-use — reset so a retry gets a fresh one.
      captchaRef.current?.resetCaptcha()
      setCaptchaToken(null)
      setLoading(false)
    }
  }

  const isSignUp = mode === 'signup'
  const submitDisabled = loading || !captchaToken

  return (
    <div style={{
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
    }}>
      {/* Logo + App name */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <img src="/logo-mark.png" alt="Veralis" width="132" height="100" decoding="async"
          style={{ width: '132px', height: '100px', objectFit: 'contain', display: 'block', margin: '0 auto 10px' }} />
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>
          {isSignUp ? 'Start scouting with your team in minutes.' : 'Sign in to your scouting pool.'}
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* OAuth buttons */}
        <button
          type="button"
          className="v-btn v-btn-ghost"
          onClick={() => handleOAuth('google')}
          disabled={!!oauthLoading}
          style={{ ...oauthBtn, opacity: oauthLoading && oauthLoading !== 'google' ? 0.5 : 1 }}
        >
          <GoogleIcon />
          {oauthLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <button
          type="button"
          className="v-btn"
          onClick={() => handleOAuth('apple')}
          disabled={!!oauthLoading}
          style={{ ...oauthBtn, background: '#fff', color: '#000', opacity: oauthLoading && oauthLoading !== 'apple' ? 0.5 : 1 }}
        >
          <AppleIcon color="#000" />
          {oauthLoading === 'apple' ? 'Redirecting…' : 'Continue with Apple'}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>or continue with email</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoFocus
            autoComplete="email"
            style={inputStyle}
          />
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={isSignUp ? 8 : undefined}
              style={{ ...inputStyle, paddingRight: '64px' }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', top: 0, right: 0, height: '54px', padding: '0 14px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600',
              }}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          {isSignUp && (
            <p style={{ margin: '-2px 2px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Use at least 8 characters.
            </p>
          )}

          {error && (
            <p style={{ margin: 0, fontSize: '14px', color: '#f87171', padding: '10px 14px', background: 'rgba(248,113,113,0.1)', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)' }}>
              {error}
            </p>
          )}
          {success && (
            <p style={{ margin: 0, fontSize: '14px', color: '#4ade80', padding: '10px 14px', background: 'rgba(74,222,128,0.1)', borderRadius: '8px', border: '1px solid rgba(74,222,128,0.3)' }}>
              {success}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <HCaptcha
              ref={captchaRef}
              sitekey={HCAPTCHA_SITEKEY}
              theme="dark"
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
            />
          </div>

          <button
            type="submit"
            className="v-btn v-btn-accent"
            disabled={submitDisabled}
            style={{
              height: '54px',
              background: submitDisabled ? 'var(--surface-2)' : 'var(--accent)',
              color: submitDisabled ? 'var(--text-muted)' : '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: submitDisabled ? 'default' : 'pointer',
              marginTop: '2px',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          className="v-btn v-btn-ghost"
          onClick={() => { setMode(isSignUp ? 'signin' : 'signup'); setError(null); setSuccess(null) }}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', padding: '8px', marginTop: '4px' }}
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>

        <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
          By continuing you agree to our{' '}
          <Link to="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Terms</Link>
          {' '}and{' '}
          <Link to="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

function AppleIcon({ color = '#fff' }) {
  return (
    <svg width="16" height="18" viewBox="0 0 814 1000" fill={color}>
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-127.4C46.3 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.1 0 128.4 46.4 172.5 46.4 42.1 0 108.2-49 187.8-49 30.5 0 110.1 2.6 168.1 74.4zm-244.8-169.5c31.7-37.5 54.4-89.7 54.4-141.9 0-7.1-.6-14.3-1.9-20.1-51.5 1.9-112.9 34.4-149.3 77.5-28.2 32.7-55.1 84.9-55.1 137.8 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 46.4 0 102.9-30.7 136.4-72.7z"/>
    </svg>
  )
}

const oauthBtn = {
  height: '54px',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1.5px solid var(--border)',
  borderRadius: '12px',
  fontSize: '15px',
  fontWeight: '600',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  width: '100%',
  transition: 'opacity 0.15s',
}

const inputStyle = {
  height: '54px',
  padding: '0 16px',
  background: 'var(--surface-2)',
  border: '1.5px solid var(--border)',
  borderRadius: '10px',
  color: 'var(--text)',
  fontSize: '16px',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
}
