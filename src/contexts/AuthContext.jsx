import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { identifyUser, resetUser, trackLogin, trackSignup } from '../lib/analytics'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = still loading
  const [mfaRequired, setMfaRequired] = useState(false)
  // The last user id we've identified to analytics this session. Guards against
  // onAuthStateChange firing repeatedly for the same user (tab refocus, token
  // refresh) — we identify / count a login at most once per real sign-in.
  const identifiedRef = useRef(null)

  // Tie the current user to their analytics profile. For OAuth we also classify
  // signup vs. login here, since the redirect means we can't do it at the button.
  // Email signup/login are tracked in the Login form (before email confirmation),
  // so we skip provider === 'email' to avoid double-counting.
  function syncAnalytics(event, session) {
    const u = session?.user
    if (u) {
      if (identifiedRef.current === u.id) return
      identifiedRef.current = u.id
      identifyUser(u, {
        display_name: u.user_metadata?.full_name ?? u.user_metadata?.name,
        provider: u.app_metadata?.provider,
      })
      const provider = u.app_metadata?.provider
      if (event === 'SIGNED_IN' && provider && provider !== 'email') {
        const isNew = Date.now() - new Date(u.created_at).getTime() < 60_000
        if (isNew) trackSignup(provider)
        else trackLogin(provider)
      }
    } else if (identifiedRef.current) {
      identifiedRef.current = null
      resetUser()
    }
  }

  // True when the user has 2FA enabled but hasn't entered a code yet this
  // session (session is at AAL1 while AAL2 is available).
  async function refreshMfa() {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data) { setMfaRequired(false); return }
    setMfaRequired(data.currentLevel === 'aal1' && data.nextLevel === 'aal2')
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      syncAnalytics('INITIAL_SESSION', session)
      if (session?.user) refreshMfa()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      syncAnalytics(event, session)
      // Defer Supabase calls out of the auth-state callback to avoid the auth lock.
      if (session?.user) setTimeout(refreshMfa, 0)
      else setMfaRequired(false)
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading: user === undefined, mfaRequired, recheckMfa: refreshMfa, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
