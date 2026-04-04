import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../../context/AuthContext'
import { apiJson } from '../../lib/api'
import { Skeleton } from '../../components/Skeleton'
import { MEALS, toISODateLocal } from '../../utils/meals'

export function AdminDashboard() {
  const { user, supabase, session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [bookingsToday, setBookingsToday] = useState([])
  const [complaints, setComplaints] = useState([])
  const [guestToday, setGuestToday] = useState([])
  const [announcement, setAnnouncement] = useState('')
  const [wasteForm, setWasteForm] = useState({
    breakfast: '',
    lunch: '',
    snacks: '',
    dinner: '',
  })
  const [weekStats, setWeekStats] = useState({ attended: 0, noshow: 0 })
  const [monthStats, setMonthStats] = useState({ attended: 0, noshow: 0 })

  const today = useMemo(() => toISODateLocal(new Date()), [])

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    setLoading(true)
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(now.getDate() - 7)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [bRes, cRes, gRes, wk, mo] = await Promise.all([
      supabase.from('bookings').select('*').eq('date', today),
      supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('guest_passes').select('*').eq('date', today),
      supabase
        .from('bookings')
        .select('status')
        .gte('date', toISODateLocal(weekAgo))
        .lte('date', today),
      supabase
        .from('bookings')
        .select('status')
        .gte('date', toISODateLocal(monthStart))
        .lte('date', today),
    ])

    setBookingsToday(bRes.data ?? [])
    const complaintsRaw = cRes.data ?? []
    const guestRaw = gRes.data ?? []
    const studentIds = [
      ...new Set([
        ...complaintsRaw.map((c) => c.student_id),
        ...guestRaw.map((g) => g.student_id),
      ]),
    ]
    let studentMap = {}
    if (studentIds.length) {
      const { data: studs } = await supabase
        .from('students')
        .select('id, name, roll_number')
        .in('id', studentIds)
      studentMap = Object.fromEntries((studs ?? []).map((s) => [s.id, s]))
    }
    setComplaints(
      complaintsRaw.map((c) => ({
        ...c,
        students: studentMap[c.student_id],
      })),
    )
    setGuestToday(
      guestRaw.map((g) => ({
        ...g,
        students: studentMap[g.student_id],
      })),
    )

    const agg = (rows) =>
      rows.reduce(
        (a, r) => {
          if (r.status === 'attended') a.attended += 1
          if (r.status === 'no_show') a.noshow += 1
          return a
        },
        { attended: 0, noshow: 0 },
      )
    setWeekStats(agg(wk.data ?? []))
    setMonthStats(agg(mo.data ?? []))
    setLoading(false)
  }, [supabase, today])

  useEffect(() => {
    load()
  }, [load])

  const mealStats = useMemo(() => {
    const base = MEALS.map((m) => ({
      meal: m.label,
      booked: 0,
      attended: 0,
      noshow: 0,
    }))
    const idx = Object.fromEntries(MEALS.map((m, i) => [m.key, i]))
    bookingsToday.forEach((b) => {
      const i = idx[b.meal_type]
      if (i === undefined) return
      if (b.status === 'booked') base[i].booked += 1
      if (b.status === 'attended') base[i].attended += 1
      if (b.status === 'no_show') base[i].noshow += 1
    })
    return base
  }, [bookingsToday])

  const barData = mealStats.map((m) => ({
    name: m.meal,
    Booked: m.booked,
    Attended: m.attended,
    'No-show': m.noshow,
  }))

  const pushAnnouncement = async () => {
    if (!session?.access_token || !user || !announcement.trim()) return
    try {
      await apiJson('/admin/announcements', {
        method: 'POST',
        token: session.access_token,
        body: { message: announcement.trim() },
      })
      setAnnouncement('')
    } catch (e) {
      window.alert(e?.message || 'Could not push announcement.')
    }
  }

  const saveWaste = async (e) => {
    e.preventDefault()
    if (!session?.access_token || !user) return
    const entries = []
    for (const m of MEALS) {
      const v = wasteForm[m.key]
      if (v === '' || v === undefined) continue
      const n = Number(v)
      if (Number.isNaN(n)) continue
      entries.push({ meal_type: m.key, waste_kg: n })
    }
    if (entries.length === 0) return
    try {
      await apiJson('/admin/waste-log', {
        method: 'POST',
        token: session.access_token,
        body: { date: today, entries },
      })
      setWasteForm({ breakfast: '', lunch: '', snacks: '', dinner: '' })
    } catch (err) {
      window.alert(err?.message || 'Could not save waste log.')
    }
  }

  const setComplaintStatus = async (id, status) => {
    if (!session?.access_token) return
    try {
      await apiJson(`/admin/complaints/${id}/status`, {
        method: 'PATCH',
        token: session.access_token,
        body: { status },
      })
      await load()
    } catch (e) {
      window.alert(e?.message || 'Could not update complaint.')
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-admin px-4 py-3 text-white shadow-md">
        <h1 className="text-lg font-bold">Mess control room</h1>
        <p className="text-sm text-white/85">{today}</p>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">
              Live headcount (today)
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 pr-2">Meal</th>
                    <th className="py-2">Booked</th>
                    <th className="py-2">Attended</th>
                    <th className="py-2">No-shows</th>
                  </tr>
                </thead>
                <tbody>
                  {mealStats.map((m) => (
                    <tr key={m.meal} className="border-b border-slate-100">
                      <td className="py-2 pr-2 font-medium text-slate-800">
                        {m.meal}
                      </td>
                      <td className="py-2 text-primary">{m.booked}</td>
                      <td className="py-2 text-emerald-700">{m.attended}</td>
                      <td className="py-2 text-rose-600">{m.noshow}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="px-1 text-sm font-semibold text-slate-800">
              Bookings by meal (today)
            </h2>
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={barData}
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={72}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Booked" fill="#1a7a52" />
                  <Bar dataKey="Attended" fill="#059669" />
                  <Bar dataKey="No-show" fill="#e11d48" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Week summary</h2>
              <p className="mt-2 text-2xl font-bold text-primary">
                {weekStats.attended}
                <span className="text-sm font-normal text-slate-500">
                  {' '}
                  attended
                </span>
              </p>
              <p className="text-sm text-rose-600">
                {weekStats.noshow} no-shows
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Month summary</h2>
              <p className="mt-2 text-2xl font-bold text-admin">
                {monthStats.attended}
                <span className="text-sm font-normal text-slate-500">
                  {' '}
                  attended
                </span>
              </p>
              <p className="text-sm text-rose-600">
                {monthStats.noshow} no-shows
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
            <h2 className="text-sm font-semibold">Broadcast</h2>
            <textarea
              className="min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Announcement to all students (banner on home)"
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
            />
            <button
              type="button"
              onClick={pushAnnouncement}
              className="rounded-xl bg-admin px-4 py-2 text-sm font-semibold text-white"
            >
              Push announcement
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Guest passes today</h2>
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm">
              {guestToday.length === 0 && (
                <li className="text-slate-500">No passes for today.</li>
              )}
              {guestToday.map((g) => (
                <li
                  key={g.id}
                  className="rounded-xl bg-slate-50 px-3 py-2 text-slate-800"
                >
                  <span className="font-medium">{g.guest_name}</span> —{' '}
                  {g.students?.name} ({g.students?.roll_number}) • {g.meal_type}{' '}
                  • <span className="text-admin">{g.payment_status}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Daily waste log (kg)</h2>
            <form onSubmit={saveWaste} className="mt-2 grid gap-2 sm:grid-cols-2">
              {MEALS.map((m) => (
                <label key={m.key} className="text-xs font-medium text-slate-600">
                  {m.label}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm"
                    placeholder="kg"
                    value={wasteForm[m.key]}
                    onChange={(e) =>
                      setWasteForm((f) => ({ ...f, [m.key]: e.target.value }))
                    }
                  />
                </label>
              ))}
              <button
                type="submit"
                className="sm:col-span-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white"
              >
                Save waste entries
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Complaints</h2>
            <ul className="mt-2 space-y-3 text-sm">
              {complaints.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{c.title}</p>
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                      value={c.status}
                      onChange={(e) =>
                        setComplaintStatus(c.id, e.target.value)
                      }
                    >
                      <option value="open">Open</option>
                      <option value="acknowledged">Acknowledged</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <p className="text-slate-600">{c.description}</p>
                  <p className="text-[10px] text-slate-400">
                    {c.students?.name} • {c.students?.roll_number}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
