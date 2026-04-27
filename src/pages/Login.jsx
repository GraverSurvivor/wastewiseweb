import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, isRvceEmail } from '../context/AuthContext'
import { apiJson } from '../lib/api'

export function Login() {
  const {
    signIn,
    signOut,
    signUp,
    resetPassword,
    session,
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
  const [localError, setLocalError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [pending, setPending] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [showAdminModal, setShowAdminModal] = useState(
    () => location.state?.adminIntent === true,
  )
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState(null)
  const [adminPending, setAdminPending] = useState(false)
  const adminRedirectRef = useRef(false)

  useEffect(() => {
    if (showAdminModal && !adminEmail && email) {
      setAdminEmail(email.trim().toLowerCase())
    }
  }, [adminEmail, email, showAdminModal])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('verified') === '1') {
      setSuccessMsg('Email verified successfully. You can continue into your account now.')
      setMode('signin')
    }
  }, [location.search])

  useEffect(() => {
    const hash = location.hash.startsWith('#')
      ? location.hash.slice(1)
      : location.hash
    if (!hash) return

    const params = new URLSearchParams(hash)
    const errorDescription = params.get('error_description')
    if (!errorDescription) return

    setLocalError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')))
    setSuccessMsg(null)
    setMode('signin')
  }, [location.hash])

  useEffect(() => {
    if (!session || showAdminModal || adminRedirectRef.current) return
    navigate(from && from !== '/login' ? from : '/app', { replace: true })
  }, [from, navigate, session, showAdminModal])

  const clearErrors = () => {
    setLocalError(null)
    setAuthError(null)
    setSuccessMsg(null)
  }

  const openAdminModal = () => {
    clearErrors()
    setAdminError(null)
    setAdminPassword('')
    setAdminEmail((current) => current || email.trim().toLowerCase())
    setShowAdminModal(true)
  }

  const closeAdminModal = () => {
    setAdminError(null)
    setAdminPassword('')
    setShowAdminModal(false)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    clearErrors()
    const em = forgotEmail.trim().toLowerCase()
    if (!isRvceEmail(em)) {
      setLocalError('Please enter your RVCE college email.')
      return
    }
    setPending(true)
    try {
      const { error } = await resetPassword(em)
      if (error) {
        setLocalError(error.message)
      } else {
        setSuccessMsg('Password reset link sent. Check your college email.')
        setShowForgot(false)
        setForgotEmail('')
      }
    } finally {
      setPending(false)
    }
  }

  const handleAdminSignIn = async (e) => {
    e.preventDefault()
    setAdminError(null)
    setAuthError(null)

    const em = adminEmail.trim().toLowerCase()
    if (!isRvceEmail(em)) {
      setAdminError('Use your RVCE college email for admin sign in.')
      return
    }
    if (!adminPassword) {
      setAdminError('Enter the admin account password.')
      return
    }
    if (!supabaseConfigured) {
      setAdminError('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
      return
    }

    setAdminPending(true)
    try {
      const { data, error } = await signIn(em, adminPassword)
      if (error) {
        setAdminError(error.message)
        setAuthError(null)
        return
      }

      const userId = data?.user?.id ?? data?.session?.user?.id
      if (!userId) {
        setAdminError('Signed in, but the admin profile could not be checked.')
        return
      }

      const { data: adminProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle()

      if (profileError) {
        setAdminError(profileError.message)
        return
      }

      if (adminProfile?.role !== 'admin') {
        await signOut()
        setAdminError(
          'This account is not marked as admin in Supabase yet. Update profiles.role to admin first.',
        )
        return
      }

      adminRedirectRef.current = true
      navigate('/admin', { replace: true })
    } finally {
      setAdminPending(false)
    }
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
        navigate(from && from !== '/login' ? from : '/app', { replace: true })
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
        const sess = data.session ?? (await supabase.auth.getSession()).data.session
        const u = sess?.user
        const token = sess?.access_token
        if (u && token) {
          try {
            await apiJson('/student/profile', {
              method: 'POST',
              token,
              body: { name: name.trim(), roll_number: roll.trim() },
            })
          } catch {
            setLocalError(
              'Account created but profile sync failed. Is the Python API running?',
            )
            return
          }
        } else if (!u) {
          setSuccessMsg(
            'Account created. Please check your college email to verify your account, then sign in.',
          )
          setMode('signin')
          setPassword('')
          return
        }
        navigate('/app', { replace: true })
      }
    } finally {
      setPending(false)
    }
  }

  const displayError = localError || authError

  if (showForgot) {
    return (
      <div className="page-enter min-h-[100dvh] bg-gradient-to-b from-primary/15 via-white to-slate-50 px-4 py-10">
        <div className="mx-auto w-full max-w-[390px] space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white shadow-lg shadow-primary/25">
              W
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Reset password</h1>
            <p className="mt-1 text-sm text-slate-600">
              Enter your college email to receive a reset link
            </p>
          </div>
          <form
            onSubmit={handleForgotPassword}
            className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-lg"
          >
            <label className="block text-xs font-medium text-slate-600">
              College email
              <input
                type="email"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you.name@rvce.edu.in"
              />
            </label>
            {displayError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {displayError}
              </p>
            )}
            {successMsg && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {successMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="interactive-button w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-md disabled:opacity-60"
            >
              {pending ? 'Sending...' : 'Send reset link'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForgot(false)
                clearErrors()
              }}
              className="interactive-button w-full rounded-xl border border-slate-200 py-2.5 text-sm text-slate-600"
            >
              Back to sign in
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-enter min-h-[100dvh] bg-gradient-to-b from-primary/15 via-white to-slate-50 px-4 py-10">
        <div className="mx-auto w-full max-w-[390px] space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white shadow-lg shadow-primary/25">
              W
            </div>
            <h1 className="text-2xl font-bold text-slate-900">WasteWiseWeb</h1>
            <p className="mt-1 text-sm text-slate-600">
              RVCE Mess - book meals, cut waste
            </p>
          </div>

          {!supabaseConfigured && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Configure Supabase env vars to enable sign-in.
            </div>
          )}

          {successMsg && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {successMsg}
            </div>
          )}

          <div className="flex rounded-2xl bg-slate-100/90 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                clearErrors()
              }}
              className={`interactive-button flex-1 rounded-xl py-2.5 text-sm font-semibold ${
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
              className={`interactive-button flex-1 rounded-xl py-2.5 text-sm font-semibold ${
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
                placeholder="........"
              />
            </label>

            {mode === 'signin' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgot(true)
                    clearErrors()
                  }}
                  className="interactive-button text-xs text-primary underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {displayError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {displayError}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="interactive-button w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:bg-primary-dark disabled:opacity-60"
            >
              {pending
                ? 'Please wait...'
                : mode === 'signin'
                  ? 'Sign in'
                  : 'Create account'}
            </button>
          </form>

          <div className="space-y-3">
            <button
              type="button"
              onClick={openAdminModal}
              className="interactive-button w-full rounded-2xl border-2 border-admin bg-admin px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-admin-dark"
            >
              Continue as Admin / Warden
            </button>
            <p className="text-center text-xs text-slate-500">
              Admin accounts are controlled in Supabase by setting{' '}
              <code className="rounded bg-slate-100 px-1">profiles.role</code> to{' '}
              <code className="rounded bg-slate-100 px-1">admin</code>.
            </p>
          </div>
        </div>
      </div>

      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="page-enter w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/25">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-admin">
                  Admin mode
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Enter admin details
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Sign in with an account that already has{' '}
                  <code className="rounded bg-slate-100 px-1">profiles.role = admin</code>{' '}
                  in Supabase.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAdminModal}
                className="interactive-button rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500"
                aria-label="Close admin sign in"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAdminSignIn} className="mt-5 space-y-3">
              <label className="block text-xs font-medium text-slate-600">
                Admin email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-admin/30 focus:ring-2"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="warden@rvce.edu.in"
                />
              </label>

              <label className="block text-xs font-medium text-slate-600">
                Password
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-admin/30 focus:ring-2"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="........"
                />
              </label>

              {adminError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                  {adminError}
                </p>
              )}

              <button
                type="submit"
                disabled={adminPending}
                className="interactive-button w-full rounded-xl bg-admin py-3 text-sm font-semibold text-white shadow-md shadow-admin/25 hover:bg-admin-dark disabled:opacity-60"
              >
                {adminPending ? 'Checking admin access...' : 'Enter admin dashboard'}
              </button>

              <button
                type="button"
                onClick={closeAdminModal}
                className="interactive-button w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
