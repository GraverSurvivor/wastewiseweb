import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiJson } from '../../lib/api'

export function ProfilePage() {
  const { user, student, session, signOut, refreshStudent } = useAuth()
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
    if (!user || !session?.access_token) return
    setBusy(true)
    setMsg(null)
    try {
      await apiJson('/student/profile', {
        method: 'POST',
        token: session.access_token,
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
    if (!student || !session?.access_token || !from || !to) return
    if (from > to) {
      setMsg({ type: 'err', text: 'From date must be before To date.' })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      await apiJson('/leave', {
        method: 'POST',
        token: session.access_token,
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
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Profile</h1>
        <p className="text-xs text-slate-500">{user?.email}</p>
      </div>

      {msg && (
        <div
          className={`rounded-xl px-3 py-2 text-sm ${
            msg.type === 'ok'
              ? 'bg-emerald-50 text-emerald-900'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      <form
        onSubmit={saveProfile}
        className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3"
      >
        <h2 className="text-sm font-semibold">Student details</h2>
        <label className="block text-xs font-medium text-slate-600">
          Name
          <input
            required
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Roll number
          <input
            required
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={roll}
            onChange={(e) => setRoll(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save profile
        </button>
      </form>

      <form
        onSubmit={submitLeave}
        className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 shadow-sm space-y-3"
      >
        <h2 className="text-sm font-semibold text-violet-900">
          Skip meals / vacation
        </h2>
        <p className="text-xs text-violet-800/90">
          Meals in this date range are auto-cancelled and show as on leave.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium text-slate-600">
            From
            <input
              type="date"
              required
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            To
            <input
              type="date"
              required
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy || !student}
          className="w-full rounded-xl bg-violet-700 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Mark leave
        </button>
      </form>

      <Link
        to="/app/complaints"
        className="block rounded-2xl border border-slate-100 bg-white p-4 text-sm font-semibold text-primary shadow-sm"
      >
        Complaints →
      </Link>

      <button
        type="button"
        onClick={() => signOut()}
        className="w-full rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-700"
      >
        Sign out
      </button>
    </div>
  )
}
