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
  const highlights = [
    { value: '1 tap', label: 'Meal booking' },
    { value: 'Live', label: 'Waste tracking' },
    { value: 'Smart', label: 'Campus alerts' },
  ]

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
      <div className="app-shell page-enter px-4 py-8">
        <div className="relative z-10 mx-auto w-full max-w-[440px] space-y-5">
          <div className="hero-surface px-5 py-6">
            <div className="relative z-10">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/18 text-2xl font-bold text-white shadow-lg shadow-slate-950/10">
                W
              </div>
              <p className="section-kicker text-white/72">Account recovery</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
                Reset your password
              </h1>
              <p className="mt-2 max-w-sm text-sm leading-6 text-white/78">
                We will send a secure reset link to your RVCE email so you can get back into the app quickly.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleForgotPassword}
            className="glass-surface space-y-4 p-5"
          >
            <div>
              <p className="section-kicker">Recovery email</p>
              <p className="mt-1 text-sm text-slate-600">
                Enter the same campus email you use for booking meals.
              </p>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              College email
              <input
                type="email"
                required
                className="form-input"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you.name@rvce.edu.in"
              />
            </label>
            {displayError && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {displayError}
              </p>
            )}
            {successMsg && (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                {successMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="primary-button w-full"
            >
              {pending ? 'Sending...' : 'Send reset link'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForgot(false)
                clearErrors()
              }}
              className="secondary-button w-full"
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
      <div className="app-shell page-enter px-4 py-8">
        <div className="relative z-10 mx-auto w-full max-w-[1080px]">
          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <section className="space-y-5">
              <div className="hero-surface px-5 py-6 sm:px-7 sm:py-7">
                <div className="relative z-10">
                  <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/18 text-3xl font-bold text-white shadow-lg shadow-slate-950/10">
                    W
                  </div>
                  <p className="section-kicker text-white/72">RVCE Mess Experience</p>
                  <h1 className="mt-2 max-w-xl text-4xl font-bold tracking-tight text-white sm:text-[2.8rem]">
                    WasteWiseWeb
                  </h1>
                  <p className="mt-3 max-w-xl text-base leading-7 text-white/80">
                    A cleaner, smarter mess platform for booking meals, reducing waste, and keeping students and wardens on the same page.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {highlights.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-white/15 bg-white/12 px-4 py-3 backdrop-blur"
                      >
                        <p className="text-xl font-bold text-white">{item.value}</p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-white/65">
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="metric-card">
                  <p className="section-kicker">Why it stands out</p>
                  <h2 className="mt-2 text-lg font-bold text-slate-900">
                    Designed around campus flow
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Students can act in seconds, while admins still get the control room visibility they need.
                  </p>
                </div>
                <div className="metric-card">
                  <p className="section-kicker">Built for action</p>
                  <h2 className="mt-2 text-lg font-bold text-slate-900">
                    Booking, complaints, waste insights
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    One product experience ties together meal operations, accountability, and sustainability.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-4 lg:pt-2">
              {!supabaseConfigured && (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
                  Configure Supabase env vars to enable sign-in.
                </div>
              )}

              {successMsg && (
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm">
                  {successMsg}
                </div>
              )}

              <div className="glass-surface p-5 sm:p-6">
                <div className="flex rounded-[22px] border border-slate-200/70 bg-slate-100/85 p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin')
                      clearErrors()
                    }}
                    className={`interactive-button flex-1 rounded-2xl py-3 text-sm font-semibold ${
                      mode === 'signin'
                        ? 'bg-white text-primary shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]'
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
                    className={`interactive-button flex-1 rounded-2xl py-3 text-sm font-semibold ${
                      mode === 'register'
                        ? 'bg-white text-primary shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]'
                        : 'text-slate-600'
                    }`}
                  >
                    Register
                  </button>
                </div>

                <form onSubmit={submit} className="mt-5 space-y-4">
                  <div>
                    <p className="section-kicker">
                      {mode === 'signin' ? 'Welcome back' : 'Create your account'}
                    </p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                      {mode === 'signin'
                        ? 'Access your meal dashboard'
                        : 'Join the smart mess experience'}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Use your official RVCE email to keep bookings, complaints, and attendance linked to the right profile.
                    </p>
                  </div>

                  {mode === 'register' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Full name
                        <input
                          required
                          className="form-input"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Arjun Sharma"
                        />
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Roll number
                        <input
                          required
                          className="form-input"
                          value={roll}
                          onChange={(e) => setRoll(e.target.value)}
                          placeholder="1RV22CS001"
                        />
                      </label>
                    </div>
                  )}

                  <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    College email
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      className="form-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you.name@rvce.edu.in"
                    />
                  </label>

                  <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Password
                    <input
                      type="password"
                      required
                      autoComplete={
                        mode === 'signin' ? 'current-password' : 'new-password'
                      }
                      className="form-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="........"
                    />
                  </label>

                  {mode === 'signin' && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgot(true)
                          clearErrors()
                        }}
                        className="interactive-button text-xs font-semibold uppercase tracking-[0.16em] text-primary"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {displayError && (
                    <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                      {displayError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={pending}
                    className="primary-button w-full"
                  >
                    {pending
                      ? 'Please wait...'
                      : mode === 'signin'
                        ? 'Sign in'
                        : 'Create account'}
                  </button>
                </form>
              </div>

              <div className="glass-surface p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="section-kicker">Restricted access</p>
                    <h3 className="mt-1 text-xl font-bold text-slate-900">
                      Continue as Admin / Warden
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Admin access stays separate from the student flow and only works for accounts marked as admin in Supabase.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openAdminModal}
                    className="admin-button min-w-[220px]"
                  >
                    Open admin mode
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Admin accounts are controlled in Supabase by setting{' '}
                  <code className="rounded bg-slate-100 px-1">profiles.role</code> to{' '}
                  <code className="rounded bg-slate-100 px-1">admin</code>.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>

      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/52 px-4 backdrop-blur-md">
          <div className="page-enter w-full max-w-md rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_32px_90px_-34px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker text-admin">Admin mode</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  Enter admin details
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Sign in with an account that already has{' '}
                  <code className="rounded bg-slate-100 px-1">profiles.role = admin</code>{' '}
                  in Supabase.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAdminModal}
                className="secondary-button px-3 py-2 text-xs"
                aria-label="Close admin sign in"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAdminSignIn} className="mt-6 space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Admin email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="form-input focus:ring-admin/20"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="warden@rvce.edu.in"
                />
              </label>

              <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Password
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  className="form-input focus:ring-admin/20"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="........"
                />
              </label>

              {adminError && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {adminError}
                </p>
              )}

              <button
                type="submit"
                disabled={adminPending}
                className="admin-button w-full"
              >
                {adminPending ? 'Checking admin access...' : 'Enter admin dashboard'}
              </button>

              <button
                type="button"
                onClick={closeAdminModal}
                className="secondary-button w-full"
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
