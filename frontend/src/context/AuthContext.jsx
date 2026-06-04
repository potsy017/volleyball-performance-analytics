import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
/** Opt-in local dev only — set in frontend/.env.local (gitignored). Off by default. */
const authDisabled = import.meta.env.VITE_AUTH_DISABLED === 'true'

export const supabase =
  authDisabled || !supabaseUrl || !supabaseAnonKey
    ? null
    : createClient(supabaseUrl, supabaseAnonKey)

const DEV_USER = { id: 'dev-user', email: 'dev@local' }

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null) // 'coach' | 'athlete'
  const [loading, setLoading] = useState(true)

  async function fetchRole(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    return data?.role ?? 'athlete'
  }

  useEffect(() => {
    if (authDisabled) {
      setUser(DEV_USER)
      setRole('coach')
      setLoading(false)
      return
    }

    if (!supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        setRole(await fetchRole(session.user.id))
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user)
        setRole(await fetchRole(session.user.id))
      } else {
        setUser(null)
        setRole(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    if (authDisabled) {
      setUser(DEV_USER)
      setRole('coach')
    }
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, authDisabled, signIn, signOut, supabase }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
