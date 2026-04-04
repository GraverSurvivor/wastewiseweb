import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../../context/AuthContext'
import { apiJson } from '../../lib/api'
import { EmptyState } from '../../components/EmptyState'
import { Skeleton } from '../../components/Skeleton'
import { Inbox } from '../../components/icons/Icons'
import { MEALS, GUEST_MEAL_PRICE, toISODateLocal } from '../../utils/meals'

export function GuestPassPage() {
  const { student, supabase, session } = useAuth()
  const [passes, setPasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [guestName, setGuestName] = useState('')
  const [relation, setRelation] = useState('')
  const [meal, setMeal] = useState('lunch')
  const [busy, setBusy] = useState(false)
  const today = toISODateLocal(new Date())

  const load = useCallback(async () => {
    if (!supabase || !student?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('guest_passes')
      .select('*')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })
      .limit(40)
    setPasses(data ?? [])
    setLoading(false)
  }, [supabase, student?.id])

  useEffect(() => {
    load()
  }, [load])

  const createPass = async (e) => {
    e.preventDefault()
    if (!session?.access_token || !student || !guestName.trim()) return
    setBusy(true)
    try {
      await apiJson('/guest-passes', {
        method: 'POST',
        token: session.access_token,
        body: {
          guest_name: guestName.trim(),
          relation: relation.trim() || 'Guest',
          meal_type: meal,
          date: today,
        },
      })
      setGuestName('')
      setRelation('')
      await load()
    } catch (err) {
      window.alert(err?.message || 'Could not create pass.')
    } finally {
      setBusy(false)
    }
  }

  if (!student) {
    return (
      <p className="text-sm text-slate-600">Complete your profile first.</p>
    )
  }

  const active = passes.filter((p) => p.date >= today)
  const past = passes.filter((p) => p.date < today)

  return (
    <div className="page-enter space-y-4 pb-4">
      <div className="rounded-2xl bg-admin px-4 py-3 text-white shadow-md">
        <h1 className="text-lg font-bold">Guest passes</h1>
        <p className="text-sm text-white/85">
          ₹{GUEST_MEAL_PRICE} payable at counter (sample rate)
        </p>
      </div>

      <form
        onSubmit={createPass}
        className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3"
      >
        <h2 className="text-sm font-semibold text-slate-800">New pass</h2>
        <input
          required
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          placeholder="Guest full name"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          placeholder="Relation (e.g. Parent)"
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
        />
        <label className="block text-xs font-medium text-slate-600">
          Meal slot
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
          >
            {MEALS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-500">Valid only for {today}</p>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Generate QR
        </button>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Active &amp; upcoming</h2>
        {loading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : active.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No guest passes yet"
            description="Create a pass to see the QR here."
          />
        ) : (
          <div className="space-y-3">
            {active.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
              >
                <div className="flex justify-center rounded-xl bg-slate-50 p-2">
                  <QRCodeSVG
                    value={p.qr_code}
                    size={140}
                    level="M"
                    fgColor="#1a7a52"
                    bgColor="#ffffff"
                  />
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-slate-900">{p.guest_name}</p>
                  <p className="text-slate-600">
                    {p.relation} • {p.meal_type} • {p.date}
                  </p>
                  <p className="mt-1 font-medium text-primary">
                    Pay ₹{GUEST_MEAL_PRICE} at counter
                  </p>
                  <p className="text-xs text-slate-500">
                    Payment: {p.payment_status}
                    {p.scanned_at ? ' • Entered' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Past</h2>
          <ul className="space-y-2 text-sm">
            {past.slice(0, 10).map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <span className="font-medium">{p.guest_name}</span> —{' '}
                {p.meal_type} on {p.date}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
