import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'

const AuthContext = createContext(null)

const RVCE_DOMAIN = '@rvce.edu.in'

export function isRvceEmail(email) {
  if (!email || typeof email !== 'string') return false
  return email.toLowerCase().trim().endsWith(RVCE_DOMAIN)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  const loadProfileAndStudent = useCallback(async (user) => {
    if (!supabase || !user) {
      setProfile(null)
      setStudent(null)
      return
    }
    const [{ data: prof }, { data: stu }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      supabase.from('students').select('*').eq('user_id', user.id).maybeSingle(),
    ])
    setProfile(prof ?? { role: 'student' })
    setStudent(stu ?? null)
  }, [])

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s?.user) loadProfileAndStudent(s.user)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s?.user) loadProfileAndStudent(s.user)
      else {
        setProfile(null)
        setStudent(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [loadProfileAndStudent])

  const signIn = useCallback(
    async (email, password) => {
      setAuthError(null)
      if (!supabase) {
        setAuthError('Supabase is not configured.')
        return { error: new Error('not configured') }
      }
      const e = email.trim().toLowerCase()
      if (!isRvceEmail(e)) {
        const err = new Error(
          `Only college email addresses (${RVCE_DOMAIN}) are allowed.`,
        )
        setAuthError(err.message)
        return { error: err }
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: e,
        password,
      })
      if (error) setAuthError(error.message)
      return { data, error }
    },
    [],
  )

const signUp = useCallback(
  async (email, password, meta) => {
    setAuthError(null)
    if (!supabase) {
      setAuthError('Supabase is not configured.')
      return { error: new Error('not configured') }
    }
    const e = email.trim().toLowerCase()
    if (!isRvceEmail(e)) {
      const err = new Error(
        `Only college email addresses (${RVCE_DOMAIN}) are allowed.`,
      )
      setAuthError(err.message)
      return { error: err }
    }

    // Check if user already exists before attempting signup
    const { data: existingUser } = await supabase
      .from('students')
      .select('email')
      .eq('email', e)
      .maybeSingle()

    if (existingUser) {
      const err = new Error('An account with this email already exists. Please sign in instead.')
      setAuthError(err.message)
      return { error: err }
    }

    const { data, error } = await supabase.auth.signUp({
      email: e,
      password,
      options: {
        data: meta,
        emailRedirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/login?verified=1`
            : undefined,
      },
    })

    // Supabase returns a fake success for existing emails
    // Detect it by checking if identities array is empty
    if (!error && data?.user?.identities?.length === 0) {
      const err = new Error('An account with this email already exists. Please sign in instead.')
      setAuthError(err.message)
      return { error: err }
    }

    if (error) setAuthError(error.message)
    return { data, error }
  },
  [],
)
const resetPassword = useCallback(async (email) => {
  setAuthError(null)
  if (!supabase) return
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    {
      redirectTo: `${window.location.origin}/reset-password`,
    }
  )
  if (error) setAuthError(error.message)
  return { error }
}, [])

  const signOut = useCallback(async () => {
    setAuthError(null)
    if (supabase) await supabase.auth.signOut()
  }, [])

  const refreshStudent = useCallback(async () => {
    if (session?.user) await loadProfileAndStudent(session.user)
  }, [session?.user, loadProfileAndStudent])

  const isAdmin = profile?.role === 'admin'

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      student,
      loading,
      authError,
      setAuthError,
      isAdmin,
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshStudent,
      supabaseConfigured,
      supabase,
    }),
    [
      session,
      profile,
      student,
      loading,
      authError,
      isAdmin,
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshStudent,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
