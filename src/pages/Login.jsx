import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, isRvceEmail } from '../context/AuthContext'
import { apiJson } from '../lib/api'

export function Login() {
  const {
    signIn,
    signUp,
    supabase,
    supabaseConfigured,
    authError,
    setAuthError,
  } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname

  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [roll, setRoll] = useState('')
  const [adminIntent, setAdminIntent] = useState(
    () => location.state?.adminIntent === true,
  )
  const [localError, setLocalError] = useState(null)
  const [pending, setPending] = useState(false)

  const clearErrors = () => {
    setLocalError(null)
    setAuthError(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    clearErrors()
    const em = email.trim().toLowerCase()
    if (!isRvceEmail(em)) {
      setLocalError(
        'Only RVCE college email (@rvce.edu.in) can sign in or register.',
      )
      return
    }
    if (!supabaseConfigured) {
      setLocalError('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
      return
    }
    setPending(true)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(em, password)
        if (error) return
        if (adminIntent) navigate('/admin', { replace: true })
        else navigate(from && from !== '/login' ? from : '/app', { replace: true })
      } else {
        if (!name.trim() || !roll.trim()) {
          setLocalError('Name and roll number are required to register.')
          return
        }
        const { data, error } = await signUp(em, password, {
          full_name: name.trim(),
          roll_number: roll.trim(),
        })
        if (error) return
        const sess = data.session ?? (await supabase.auth.getSession()).data.session // After registration, the user might need to confirm their email before the session is active
        const u = sess?.user
        const token = sess?.access_token //ACCESS THE TOKEN HERE
        console.log("TOKEN FROM SUPABASE:", token)  // ✅ ADD THIS LINE HERE
        if (u && token) {
          try {
            await apiJson('/student/profile', {
              method: 'POST',
              token: token,
              body: { name: name.trim(), roll_number: roll.trim() },
            })
          } catch {
            setLocalError(
              'Account created but profile sync failed. Is the Python API running?',
            )
            return
          }
        } else if (!u) {
          setLocalError(
            'Check your email to confirm your account (or disable email confirmation in Supabase for dev), then sign in.',
          )
          return
        }
        if (adminIntent) navigate('/admin', { replace: true })
        else navigate('/app', { replace: true })
      }
    } finally {
      setPending(false)
    }
  }

  const displayError = localError || authError

  return (
    <div className="page-enter min-h-[100dvh] bg-gradient-to-b from-primary/15 via-white to-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-[390px] space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white shadow-lg shadow-primary/25">
            W
          </div>
          <h1 className="text-2xl font-bold text-slate-900">WasteWiseWeb</h1>
          <p className="mt-1 text-sm text-slate-600">
            RVCE Mess — book meals, cut waste
          </p>
        </div>

        {!supabaseConfigured && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Configure Supabase env vars to enable sign-in.
          </div>
        )}

        <div className="flex rounded-2xl bg-slate-100/90 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('signin')
              clearErrors()
            }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
              mode === 'signin'
                ? 'bg-white text-primary shadow-sm'
                : 'text-slate-600'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register')
              clearErrors()
            }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
              mode === 'register'
                ? 'bg-white text-primary shadow-sm'
                : 'text-slate-600'
            }`}
          >
            Register
          </button>
        </div>

        <form
          onSubmit={submit}
          className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50"
        >
          {mode === 'register' && (
            <>
              <label className="block text-xs font-medium text-slate-600">
                Full name
                <input
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Arjun Sharma"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Roll number
                <input
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
                  value={roll}
                  onChange={(e) => setRoll(e.target.value)}
                  placeholder="1RV22CS001"
                />
              </label>
            </>
          )}
          <label className="block text-xs font-medium text-slate-600">
            College email
            <input
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you.name@rvce.edu.in"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Password
            <input
              type="password"
              required
              autoComplete={
                mode === 'signin' ? 'current-password' : 'new-password'
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {displayError && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {displayError}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 transition hover:bg-primary-dark disabled:opacity-60"
          >
            {pending
              ? 'Please wait…'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setAdminIntent(true)
            }}
            className="w-full rounded-2xl border-2 border-admin bg-admin px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-admin-dark"
          >
            Continue as Admin / Warden
          </button>
          {adminIntent && (
            <p className="text-center text-xs text-slate-500">
              Admin mode: after sign in you must have an admin profile in
              Supabase (<code className="rounded bg-slate-100 px-1">profiles.role</code>
              ).
            </p>
          )}
        </div>

        <p className="text-center text-xs text-slate-400">
          <Link to="/scanner" className="underline hover:text-slate-600">
            Open gate scanner
          </Link>
        </p>
      </div>
    </div>
  )
}
