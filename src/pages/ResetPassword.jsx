import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ResetPassword() {
  const { supabase } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(null)
  const [pending, setPending] = useState(false)
  const [recoveryReady, setRecoveryReady] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setMsg({ type: 'err', text: 'Supabase is not configured for password reset.' })
      return
    }

    let active = true

    const checkRecoveryState = async () => {
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const hasRecoveryToken =
        hashParams.get('type') === 'recovery' || hashParams.has('access_token')

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!active) return

      if (hasRecoveryToken || session) {
        setRecoveryReady(true)
        setMsg(null)
      } else {
        setRecoveryReady(false)
        setMsg({
          type: 'err',
          text: 'Invalid or expired reset link. Please request a new one.',
        })
      }
    }

    checkRecoveryState()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setRecoveryReady(true)
        setMsg(null)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const submit = async (e) => {
    e.preventDefault()

    if (!supabase) {
      setMsg({ type: 'err', text: 'Supabase is not configured for password reset.' })
      return
    }

    if (!recoveryReady) {
      setMsg({
        type: 'err',
        text: 'Open the password reset link from your email again.',
      })
      return
    }

    if (password !== confirm) {
      setMsg({ type: 'err', text: 'Passwords do not match.' })
      return
    }

    if (password.length < 6) {
      setMsg({ type: 'err', text: 'Password must be at least 6 characters.' })
      return
    }

    setPending(true)
    setMsg(null)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setMsg({ type: 'err', text: error.message })
        return
      }

      await supabase.auth.signOut()
      setMsg({ type: 'ok', text: 'Password updated. Redirecting to login...' })
      setTimeout(() => navigate('/login', { replace: true }), 1600)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="page-enter min-h-[100dvh] bg-gradient-to-b from-primary/15 via-white to-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-[390px] space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white">
            W
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Set a new password</h1>
          <p className="mt-1 text-sm text-slate-600">
            Choose a fresh password for your account
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-lg"
        >
          <label className="block text-xs font-medium text-slate-600">
            New password
            <input
              type="password"
              required
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="........"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Confirm password
            <input
              type="password"
              required
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="........"
            />
          </label>

          {msg && (
            <p
              className={`rounded-xl px-3 py-2 text-sm ${
                msg.type === 'ok'
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {msg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !recoveryReady}
            className="interactive-button w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? 'Updating...' : 'Update password'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="interactive-button w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700"
          >
            Back to login
          </button>
        </form>
      </div>
    </div>
  )
}
