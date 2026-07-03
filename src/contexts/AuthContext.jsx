import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = still loading
  const [mfaRequired, setMfaRequired] = useState(false)

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
      if (session?.user) refreshMfa()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      // Defer Supabase calls out of the auth-state callback to avoid the auth lock.
      if (session?.user) setTimeout(refreshMfa, 0)
      else setMfaRequired(false)
    })

    return () => subscription.unsubscribe()
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
