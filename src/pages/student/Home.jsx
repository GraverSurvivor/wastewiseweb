import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiJson } from '../../lib/api'
import { AnnouncementBanner } from '../../components/AnnouncementBanner'
import { MealCardsSkeleton } from '../../components/Skeleton'
import {
  MEALS,
  formatRange,
  isBookingClosed,
  canCancelBooking,
  toISODateLocal,
} from '../../utils/meals'
import { requestNotifyPermission, scheduleMealEndReminder } from '../../utils/notifications'

function todayInRange(isoDate, from, to) {
  return isoDate >= from && isoDate <= to
}

export function StudentHome() {
  const { student, supabase, session } = useAuth()
  const [bookings, setBookings] = useState([])
  const [leaveRows, setLeaveRows] = useState([])
  const [announcement, setAnnouncement] = useState(null)
  const [stats, setStats] = useState({
    attended: 0,
    noshow: 0,
    guests: 0,
  })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [confirmMeal, setConfirmMeal] = useState(null)
  const [bannerDismissed, setBannerDismissed] = useState(() =>
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('ww_banner_dismissed')
      : null,
  )

  const today = useMemo(() => toISODateLocal(new Date()), [])

  const onLeaveToday = useMemo(() => {
    return leaveRows.some((r) => todayInRange(today, r.from_date, r.to_date))
  }, [leaveRows, today])

  const load = useCallback(async () => {
    if (!supabase || !student?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const isoStart = toISODateLocal(startOfMonth)
    const isoEnd = toISODateLocal(endOfMonth)

    const [
      bRes,
      lRes,
      aRes,
      attRes,
      nsRes,
      gRes,
    ] = await Promise.all([
      supabase
        .from('bookings')
        .select('*')
        .eq('student_id', student.id)
        .eq('date', today),
      supabase
        .from('leave_requests')
        .select('*')
        .eq('student_id', student.id),
      supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', student.id)
        .eq('status', 'attended')
        .gte('date', isoStart)
        .lte('date', isoEnd),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', student.id)
        .eq('status', 'no_show')
        .gte('date', isoStart)
        .lte('date', isoEnd),
      supabase
        .from('guest_passes')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', student.id)
        .gte('created_at', startOfMonth.toISOString()),
    ])

    if (bRes.data) setBookings(bRes.data)
    if (lRes.data) setLeaveRows(lRes.data)
    if (aRes.data) setAnnouncement(aRes.data)
    setStats({
      attended: attRes.count ?? 0,
      noshow: nsRes.count ?? 0,
      guests: gRes.count ?? 0,
    })
    setLoading(false)
  }, [supabase, student?.id, today])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    requestNotifyPermission()
  }, [])

  useEffect(() => {
    const cleanups = []
    const now = new Date()
    for (const m of MEALS) {
      const meal = MEALS.find((x) => x.key === m.key)
      if (!meal) continue
      const end = new Date(now)
      end.setHours(meal.end.h, meal.end.m, 0, 0)
      cleanups.push(
        scheduleMealEndReminder(m.key, meal.label, end, (msg) => {
          if (typeof window !== 'undefined') window.alert(msg)
        }),
      )
    }
    return () => cleanups.forEach((fn) => fn())
  }, [])

  const bookingByMeal = useMemo(() => {
    const map = {}
    bookings.forEach((b) => {
      map[b.meal_type] = b
    })
    return map
  }, [bookings])

  const bookMeal = async (mealKey) => {
    if (!session?.access_token || !student || onLeaveToday || isBookingClosed(mealKey))
      return
    setBusy(mealKey)
    try {
      await apiJson('/bookings/book', {
        method: 'POST',
        token: session.access_token,
        body: { meal_type: mealKey, date: today },
      })
      await load()
    } catch (e) {
      window.alert(e?.message || 'Could not book meal.')
    } finally {
      setBusy(null)
      setConfirmMeal(null)
    }
  }

  const cancelMeal = async (mealKey) => {
    if (!session?.access_token || !canCancelBooking(mealKey)) return
    const row = bookingByMeal[mealKey]
    if (!row?.id) return
    setBusy(mealKey)
    try {
      await apiJson('/bookings/cancel', {
        method: 'POST',
        token: session.access_token,
        body: { meal_type: mealKey, date: today },
      })
      await load()
    } catch (e) {
      window.alert(e?.message || 'Could not cancel.')
    } finally {
      setBusy(null)
    }
  }

  if (!student) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-medium">Complete your profile</p>
        <p className="mt-1 text-amber-900/80">
          Add your details to book meals and use the mess.
        </p>
        <Link
          to="/app/profile"
          className="mt-3 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Go to profile
        </Link>
      </div>
    )
  }

  const showBanner =
    announcement?.message &&
    bannerDismissed !== announcement.id &&
    typeof announcement.id !== 'undefined'

  return (
    <div className="space-y-4 pb-4">
      {showBanner && (
        <AnnouncementBanner
          message={announcement.message}
          onDismiss={() => {
            setBannerDismissed(announcement.id)
            localStorage.setItem('ww_banner_dismissed', String(announcement.id))
          }}
        />
      )}

      <header className="rounded-2xl bg-primary px-4 py-4 text-white shadow-lg shadow-primary/20">
        <p className="text-sm text-white/85">Hello,</p>
        <h1 className="text-xl font-bold tracking-tight">{student.name}</h1>
        <p className="text-sm text-white/90">{student.roll_number}</p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          Today&apos;s meals
        </h2>
        {loading ? (
          <MealCardsSkeleton />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {MEALS.map((m) => {
              const row = bookingByMeal[m.key]
              const closed = isBookingClosed(m.key)
              const leave = onLeaveToday
              let statusLabel = 'Not booked'
              let tone =
                'border-slate-100 bg-white text-slate-800'
              if (leave) {
                statusLabel = 'On leave'
                tone = 'border-violet-200 bg-violet-50 text-violet-900'
              } else if (row?.status === 'booked') {
                statusLabel = 'Booked'
                tone = 'border-primary/25 bg-primary/5 text-primary'
              } else if (row?.status === 'attended') {
                statusLabel = 'Attended'
                tone = 'border-emerald-200 bg-emerald-50 text-emerald-900'
              } else if (row?.status === 'no_show') {
                statusLabel = 'No-show'
                tone = 'border-rose-200 bg-rose-50 text-rose-900'
              } else if (row?.status === 'cancelled') {
                statusLabel = 'Cancelled'
              }
              if (!leave && !row && closed) {
                statusLabel = 'Booking closed'
                tone = 'border-slate-200 bg-slate-100 text-slate-600'
              }

              const canBook =
                !leave &&
                !closed &&
                (!row || row.status === 'cancelled') &&
                row?.status !== 'attended'

              const showCancel =
                row?.status === 'booked' && canCancelBooking(m.key) && !leave

              return (
                <div
                  key={m.key}
                  className={`rounded-2xl border p-4 shadow-sm transition ${tone}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold capitalize">{m.label}</p>
                      <p className="text-xs text-slate-500">
                        {formatRange(m.key)} IST
                      </p>
                    </div>
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row?.status !== 'booked' &&
                      row?.status !== 'attended' && (
                      <button
                        type="button"
                        disabled={!canBook || busy === m.key}
                        onClick={() => setConfirmMeal(m.key)}
                        className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {row?.status === 'cancelled'
                          ? 'Book again'
                          : 'Book'}
                      </button>
                    )}
                    {showCancel && (
                      <button
                        type="button"
                        disabled={busy === m.key}
                        onClick={() => cancelMeal(m.key)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">This month</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-slate-50 py-3">
            <p className="text-lg font-bold text-primary">{stats.attended}</p>
            <p className="text-[10px] text-slate-500">Meals attended</p>
          </div>
          <div className="rounded-xl bg-slate-50 py-3">
            <p className="text-lg font-bold text-rose-600">{stats.noshow}</p>
            <p className="text-[10px] text-slate-500">No-shows</p>
          </div>
          <div className="rounded-xl bg-slate-50 py-3">
            <p className="text-lg font-bold text-admin">{stats.guests}</p>
            <p className="text-[10px] text-slate-500">Guest passes</p>
          </div>
        </div>
      </section>

      <p className="text-center text-xs text-slate-400">
        Menu &amp; impact → use bottom navigation
      </p>

      {confirmMeal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-[390px] rounded-2xl bg-white p-4 shadow-xl">
            <p className="font-semibold text-slate-900">Confirm booking</p>
            <p className="mt-1 text-sm text-slate-600">
              Book {MEALS.find((x) => x.key === confirmMeal)?.label} for today?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium"
                onClick={() => setConfirmMeal(null)}
              >
                No
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white"
                onClick={() => bookMeal(confirmMeal)}
              >
                Yes, book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
