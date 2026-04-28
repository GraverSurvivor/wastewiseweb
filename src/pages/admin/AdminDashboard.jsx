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
import {
  formatAnnouncementDate,
  getAnnouncementExpiry,
  isAnnouncementActive,
} from '../../utils/announcements'

const EMPTY_WASTE_FORM = {
  breakfast: '',
  lunch: '',
  snacks: '',
  dinner: '',
}

function wasteFormFromRows(rows) {
  const next = { ...EMPTY_WASTE_FORM }

  for (const row of rows ?? []) {
    if (!row?.meal_type || !(row.meal_type in next)) continue
    next[row.meal_type] = String(row.waste_kg ?? '')
  }

  return next
}

function announcementStatus(announcement) {
  return isAnnouncementActive(announcement) ? 'Active' : 'Expired'
}

export function AdminDashboard() {
  const { user, supabase, getAccessToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [bookingsToday, setBookingsToday] = useState([])
  const [complaints, setComplaints] = useState([])
  const [announcement, setAnnouncement] = useState('')
  const [announcementDays, setAnnouncementDays] = useState('1')
  const [announcementHistory, setAnnouncementHistory] = useState([])
  const [pushingAnnouncement, setPushingAnnouncement] = useState(false)
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState(null)
  const [wasteForm, setWasteForm] = useState(EMPTY_WASTE_FORM)
  const [savingWaste, setSavingWaste] = useState(false)
  const [wasteMessage, setWasteMessage] = useState(null)
  const [weekStats, setWeekStats] = useState({ attended: 0, noshow: 0 })
  const [monthStats, setMonthStats] = useState({ attended: 0, noshow: 0 })

  const today = useMemo(() => toISODateLocal(new Date()), [])
  const load = useCallback(async () => {
    if (!supabase || !user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    const accessToken = await getAccessToken()
    if (accessToken) {
      try {
        await apiJson('/bookings/reconcile', {
          method: 'POST',
          token: accessToken,
        })
      } catch {
        // Keep the dashboard usable even if reconciliation is temporarily unavailable.
      }
    }

    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(now.getDate() - 7)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [bookingsRes, complaintsRes, announcementsRes, wasteRes, weekRes, monthRes] =
      await Promise.all([
        supabase.from('bookings').select('*').eq('date', today),
        supabase
          .from('complaints')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('announcements')
          .select('*')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('waste_log')
          .select('meal_type, waste_kg')
          .eq('date', today),
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

    setBookingsToday(bookingsRes.data ?? [])
    setAnnouncementHistory(announcementsRes.data ?? [])
    setWasteForm(wasteFormFromRows(wasteRes.data))

    const complaintsRaw = complaintsRes.data ?? []
    const studentIds = [...new Set(complaintsRaw.map((item) => item.student_id))]
    let studentMap = {}

    if (studentIds.length) {
      const { data: students } = await supabase
        .from('students')
        .select('id, name, roll_number')
        .in('id', studentIds)

      studentMap = Object.fromEntries((students ?? []).map((s) => [s.id, s]))
    }

    setComplaints(
      complaintsRaw.map((item) => ({
        ...item,
        students: studentMap[item.student_id],
      })),
    )

    const aggregate = (rows) =>
      rows.reduce(
        (acc, row) => {
          if (row.status === 'attended') acc.attended += 1
          if (row.status === 'no_show') acc.noshow += 1
          return acc
        },
        { attended: 0, noshow: 0 },
      )

    setWeekStats(aggregate(weekRes.data ?? []))
    setMonthStats(aggregate(monthRes.data ?? []))
    setLoading(false)
  }, [supabase, today, user?.id])

  useEffect(() => {
    load()
  }, [load])

  const mealStats = useMemo(() => {
    const base = MEALS.map((meal) => ({
      meal: meal.label,
      totalBooked: 0,
      pending: 0,
      attended: 0,
      noshow: 0,
    }))
    const indexByMeal = Object.fromEntries(MEALS.map((meal, idx) => [meal.key, idx]))

    bookingsToday.forEach((booking) => {
      const idx = indexByMeal[booking.meal_type]
      if (idx === undefined) return
      if (booking.status !== 'cancelled') base[idx].totalBooked += 1
      if (booking.status === 'booked') base[idx].pending += 1
      if (booking.status === 'attended') base[idx].attended += 1
      if (booking.status === 'no_show') base[idx].noshow += 1
    })

    return base
  }, [bookingsToday])

  const barData = mealStats.map((meal) => ({
    name: meal.meal,
    'Total booked': meal.totalBooked,
    Pending: meal.pending,
    Attended: meal.attended,
    'No-show': meal.noshow,
  }))

  const pushAnnouncement = async () => {
    if (!user || !announcement.trim()) return

    const duration = Number(announcementDays)
    if (!Number.isInteger(duration) || duration < 1 || duration > 365) {
      window.alert('Choose a valid announcement duration between 1 and 365 days.')
      return
    }

    setPushingAnnouncement(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        window.alert('Your admin session expired. Sign in again to continue.')
        return
      }
      await apiJson('/admin/announcements', {
        method: 'POST',
        token: accessToken,
        body: {
          message: announcement.trim(),
          duration_days: duration,
        },
      })
      setAnnouncement('')
      setAnnouncementDays('1')
      await load()
    } catch (error) {
      window.alert(error?.message || 'Could not push announcement.')
    } finally {
      setPushingAnnouncement(false)
    }
  }

  const deleteAnnouncement = async (announcementId) => {
    if (!announcementId) return

    const confirmed = window.confirm(
      'Delete this announcement now? It will be removed from the student app immediately.',
    )
    if (!confirmed) return

    setDeletingAnnouncementId(announcementId)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        window.alert('Your admin session expired. Sign in again to continue.')
        return
      }
      await apiJson(`/admin/announcements/${announcementId}`, {
        method: 'DELETE',
        token: accessToken,
      })
      setAnnouncementHistory((current) =>
        current.filter((item) => item.id !== announcementId),
      )
    } catch (error) {
      window.alert(error?.message || 'Could not delete announcement.')
    } finally {
      setDeletingAnnouncementId(null)
    }
  }

  const saveWaste = async (e) => {
    e.preventDefault()
    if (!user) return

    const entries = []
    for (const meal of MEALS) {
      const value = wasteForm[meal.key]
      if (value === '' || value === undefined) continue
      const numberValue = Number(value)
      if (Number.isNaN(numberValue) || numberValue < 0) continue
      entries.push({ meal_type: meal.key, waste_kg: numberValue })
    }

    if (entries.length === 0) {
      setWasteMessage({
        type: 'error',
        text: 'Enter at least one valid waste value in kilograms.',
      })
      return
    }

    setSavingWaste(true)
    setWasteMessage(null)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        setWasteMessage({
          type: 'error',
          text: 'Your admin session expired. Sign in again to continue.',
        })
        return
      }
      await apiJson('/admin/waste-log', {
        method: 'POST',
        token: accessToken,
        body: { date: today, entries },
      })
      await load()
      setWasteMessage({
        type: 'success',
        text: 'Today’s waste entries were saved successfully.',
      })
    } catch (error) {
      setWasteMessage({
        type: 'error',
        text: error?.message || 'Could not save waste log.',
      })
    } finally {
      setSavingWaste(false)
    }
  }

  const setComplaintStatus = async (id, status) => {
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        window.alert('Your admin session expired. Sign in again to continue.')
        return
      }
      await apiJson(`/admin/complaints/${id}/status`, {
        method: 'PATCH',
        token: accessToken,
        body: { status },
      })
      await load()
    } catch (error) {
      window.alert(error?.message || 'Could not update complaint.')
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
            <p className="mt-1 text-xs text-slate-500">
              Total booked includes students who are still pending, already attended, or later marked no-show.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 pr-2">Meal</th>
                    <th className="py-2">Total booked</th>
                    <th className="py-2">Pending</th>
                    <th className="py-2">Attended</th>
                    <th className="py-2">No-shows</th>
                  </tr>
                </thead>
                <tbody>
                  {mealStats.map((meal) => (
                    <tr key={meal.meal} className="border-b border-slate-100">
                      <td className="py-2 pr-2 font-medium text-slate-800">
                        {meal.meal}
                      </td>
                      <td className="py-2 font-semibold text-admin">{meal.totalBooked}</td>
                      <td className="py-2 text-primary">{meal.pending}</td>
                      <td className="py-2 text-emerald-700">{meal.attended}</td>
                      <td className="py-2 text-rose-600">{meal.noshow}</td>
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
                  <Bar dataKey="Total booked" fill="#14532d" />
                  <Bar dataKey="Pending" fill="#1a7a52" />
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

          <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Broadcast</h2>
            <textarea
              className="min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Announcement to all students (banner on home)"
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
            />
            <label className="block text-xs font-medium text-slate-600">
              Show this announcement for how many days?
              <input
                type="number"
                min="1"
                max="365"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={announcementDays}
                onChange={(e) => setAnnouncementDays(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={pushAnnouncement}
              disabled={pushingAnnouncement || !announcement.trim()}
              className="interactive-button rounded-xl bg-admin px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pushingAnnouncement ? 'Pushing...' : 'Push announcement'}
            </button>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">
                  Your previous announcements
                </h3>
                <span className="text-xs text-slate-500">
                  {announcementHistory.length} shown
                </span>
              </div>

              <ul className="mt-3 space-y-2 text-sm">
                {announcementHistory.length === 0 && (
                  <li className="rounded-xl bg-white px-3 py-2 text-slate-500">
                    No announcements posted yet.
                  </li>
                )}

                {announcementHistory.map((item) => {
                  const expiry = getAnnouncementExpiry(item)
                  const active = isAnnouncementActive(item)

                  return (
                    <li
                      key={item.id}
                      className="rounded-xl bg-white px-3 py-3 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              active
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {announcementStatus(item)}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Posted {formatAnnouncementDate(item.created_at)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteAnnouncement(item.id)}
                          disabled={deletingAnnouncementId === item.id}
                          className="interactive-button rounded-lg border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingAnnouncementId === item.id
                            ? 'Deleting...'
                            : 'Delete'}
                        </button>
                      </div>
                      <p className="mt-2 text-slate-800">{item.message}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Visible for {item.duration_days || 1} day
                        {Number(item.duration_days || 1) > 1 ? 's' : ''} until{' '}
                        {formatAnnouncementDate(expiry)}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Daily waste log (kg)</h2>
            <p className="mt-1 text-xs text-slate-500">
              Saved values for today stay visible here, so you can confirm or update them.
            </p>
            {wasteMessage && (
              <div
                className={`mt-3 rounded-xl px-3 py-2 text-sm ${
                  wasteMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900'
                    : 'bg-rose-50 text-rose-800'
                }`}
              >
                {wasteMessage.text}
              </div>
            )}
            <form onSubmit={saveWaste} className="mt-2 grid gap-2 sm:grid-cols-2">
              {MEALS.map((meal) => (
                <label
                  key={meal.key}
                  className="text-xs font-medium text-slate-600"
                >
                  {meal.label}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm"
                    placeholder="kg"
                    value={wasteForm[meal.key]}
                    onChange={(e) => {
                      setWasteMessage(null)
                      setWasteForm((current) => ({
                        ...current,
                        [meal.key]: e.target.value,
                      }))
                    }}
                  />
                </label>
              ))}
              <button
                type="submit"
                disabled={savingWaste}
                className="sm:col-span-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingWaste ? 'Saving...' : 'Save waste entries'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Complaints</h2>
            <ul className="mt-2 space-y-3 text-sm">
              {complaints.map((complaint) => (
                <li
                  key={complaint.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {complaint.title}
                    </p>
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                      value={complaint.status}
                      onChange={(e) =>
                        setComplaintStatus(complaint.id, e.target.value)
                      }
                    >
                      <option value="open">Open</option>
                      <option value="acknowledged">Acknowledged</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <p className="text-slate-600">{complaint.description}</p>
                  <p className="text-[10px] text-slate-400">
                    {complaint.students?.name || 'Student'} -{' '}
                    {complaint.roll_number || complaint.students?.roll_number || 'Unknown roll number'}
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
