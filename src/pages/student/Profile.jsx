import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiJson } from '../../lib/api'

export function ProfilePage() {
  const { user, student, signOut, refreshStudent, getAccessToken } = useAuth()
  const [name, setName] = useState(student?.name ?? '')
  const [roll, setRoll] = useState(student?.roll_number ?? '')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setName(student?.name ?? '')
    setRoll(student?.roll_number ?? '')
  }, [student])

  const saveProfile = async (e) => {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setMsg(null)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        setMsg({ type: 'err', text: 'Your session expired. Sign in again to continue.' })
        return
      }
      await apiJson('/student/profile', {
        method: 'POST',
        token: accessToken,
        body: { name: name.trim(), roll_number: roll.trim() },
      })
      await refreshStudent()
      setMsg({ type: 'ok', text: 'Profile saved.' })
    } catch (err) {
      setMsg({
        type: 'err',
        text: err?.message || 'Could not save profile.',
      })
    } finally {
      setBusy(false)
    }
  }

  const submitLeave = async (e) => {
    e.preventDefault()
    if (!student || !from || !to) return
    if (from > to) {
      setMsg({ type: 'err', text: 'From date must be before To date.' })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        setMsg({ type: 'err', text: 'Your session expired. Sign in again to continue.' })
        return
      }
      await apiJson('/leave', {
        method: 'POST',
        token: accessToken,
        body: { from_date: from, to_date: to },
      })
      setMsg({
        type: 'ok',
        text: 'Leave saved. Meals in this range are cancelled.',
      })
      setFrom('')
      setTo('')
    } catch (err) {
      setMsg({
        type: 'err',
        text: err?.message || 'Could not save leave.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-enter space-y-4 pb-4">
      <div className="hero-surface px-5 py-5">
        <div className="relative z-10">
          <p className="section-kicker text-white/72">Identity and settings</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Profile
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/80">{user?.email}</p>
        </div>
      </div>

      {msg && (
        <div
          className={`rounded-[24px] border px-4 py-3 text-sm shadow-sm ${
            msg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={saveProfile} className="glass-surface space-y-4 p-5">
        <div>
          <p className="section-kicker">Student identity</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Personal details
          </h2>
        </div>
        <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Name
          <input
            required
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Roll number
          <input
            required
            className="form-input"
            value={roll}
            onChange={(e) => setRoll(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy} className="primary-button w-full">
          Save profile
        </button>
      </form>

      <form onSubmit={submitLeave} className="glass-surface space-y-4 p-5">
        <div>
          <p className="section-kicker">Time away</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Skip meals or mark vacation
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Meals in this range are auto-cancelled and will show as leave for the selected dates.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            From
            <input
              type="date"
              required
              className="form-input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            To
            <input
              type="date"
              required
              className="form-input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy || !student}
          className="secondary-button w-full border-violet-200 bg-violet-50 text-violet-900"
        >
          Mark leave
        </button>
      </form>

      <Link to="/app/complaints" className="glass-surface block p-5">
        <p className="section-kicker">Support</p>
        <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
          Complaints desk
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Report food quality, hygiene, or mess issues and track the ticket status.
        </p>
      </Link>

      <button
        type="button"
        onClick={() => signOut()}
        className="secondary-button w-full"
      >
        Sign out
      </button>
    </div>
  )
}
