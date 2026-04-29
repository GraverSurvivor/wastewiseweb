import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiJson } from '../../lib/api'
import { AnnouncementBanner } from '../../components/AnnouncementBanner'
import { MealCardsSkeleton } from '../../components/Skeleton'
import {
  MEALS,
  canCancelBooking,
  formatRange,
  isBookingClosed,
  toISODateLocal,
} from '../../utils/meals'
import {
  formatAnnouncementDate,
  getAnnouncementExpiry,
  isAnnouncementActive,
} from '../../utils/announcements'
import {
  requestNotifyPermission,
  scheduleMealEndReminder,
} from '../../utils/notifications'

function todayInRange(isoDate, from, to) {
  return isoDate >= from && isoDate <= to
}

function readDismissedAnnouncements() {
  if (typeof localStorage === 'undefined') return []

  const raw = localStorage.getItem('ww_banner_dismissed')
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    return [String(raw)]
  }

  return []
}

const mealTone = {
  breakfast: {
    card: 'from-amber-50 via-white to-orange-50 border-amber-200/80',
    badge: 'bg-amber-100 text-amber-900',
  },
  lunch: {
    card: 'from-emerald-50 via-white to-lime-50 border-emerald-200/80',
    badge: 'bg-emerald-100 text-emerald-900',
  },
  snacks: {
    card: 'from-sky-50 via-white to-cyan-50 border-sky-200/80',
    badge: 'bg-sky-100 text-sky-900',
  },
  dinner: {
    card: 'from-violet-50 via-white to-indigo-50 border-violet-200/80',
    badge: 'bg-violet-100 text-violet-900',
  },
}

function mealDescription({ leave, closed, row }) {
  if (leave) {
    return 'Leave is active for today, so this meal is automatically skipped.'
  }
  if (!row && closed) {
    return 'This booking window is already closed for today.'
  }
  if (row?.status === 'booked') {
    return 'You are booked. Keep this card handy before you head to the mess.'
  }
  if (row?.status === 'attended') {
    return 'Attendance is already marked for this meal.'
  }
  if (row?.status === 'no_show') {
    return 'This meal has already been counted as a no-show.'
  }
  if (row?.status === 'cancelled') {
    return 'You cancelled this once. You can still book it again before the cutoff.'
  }
  return 'Secure your plate early and avoid missing the meal window.'
}

export function StudentHome() {
  const { student, supabase, getAccessToken } = useAuth()
  const [bookings, setBookings] = useState([])
  const [leaveRows, setLeaveRows] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [stats, setStats] = useState({
    attended: 0,
    noshow: 0,
  })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [confirmMeal, setConfirmMeal] = useState(null)
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState(
    readDismissedAnnouncements,
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
    const accessToken = await getAccessToken()
    if (accessToken) {
      try {
        await apiJson('/bookings/reconcile', {
          method: 'POST',
          token: accessToken,
        })
      } catch {
        // Keep loading the page even if reconciliation is unavailable.
      }
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const isoStart = toISODateLocal(startOfMonth)
    const isoEnd = toISODateLocal(endOfMonth)

    const [bRes, lRes, aRes, attRes, nsRes] = await Promise.all([
      supabase.from('bookings').select('*').eq('student_id', student.id).eq('date', today),
      supabase.from('leave_requests').select('*').eq('student_id', student.id),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(20),
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
    ])

    if (bRes.data) setBookings(bRes.data)
    if (lRes.data) setLeaveRows(lRes.data)
    if (aRes.data) setAnnouncements(aRes.data.filter((item) => item?.id))
    setStats({
      attended: attRes.count ?? 0,
      noshow: nsRes.count ?? 0,
    })
    setLoading(false)
  }, [getAccessToken, student?.id, supabase, today])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!supabase || !student?.id) return

    const channel = supabase
      .channel(`student-announcements-${student.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          load()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load, student?.id, supabase])

  useEffect(() => {
    requestNotifyPermission()
  }, [])

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(
      'ww_banner_dismissed',
      JSON.stringify(dismissedAnnouncements),
    )
  }, [dismissedAnnouncements])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setAnnouncements((current) =>
        current.filter((item) => item?.id && isAnnouncementActive(item)),
      )
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const cleanups = []
    const now = new Date()
    for (const meal of MEALS) {
      const end = new Date(now)
      end.setHours(meal.end.h, meal.end.m, 0, 0)
      cleanups.push(
        scheduleMealEndReminder(meal.key, meal.label, end, (msg) => {
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

  const visibleAnnouncements = useMemo(() => {
    return announcements.filter(
      (item) =>
        item?.message &&
        isAnnouncementActive(item) &&
        !dismissedAnnouncements.includes(String(item.id)),
    )
  }, [announcements, dismissedAnnouncements])

  const bookMeal = async (mealKey) => {
    if (!student || onLeaveToday || isBookingClosed(mealKey)) return
    setBusy(mealKey)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        window.alert('Your session expired. Sign in again and try booking the meal.')
        return
      }
      await apiJson('/bookings/book', {
        method: 'POST',
        token: accessToken,
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
    if (!canCancelBooking(mealKey)) return
    const row = bookingByMeal[mealKey]
    if (!row?.id) return
    setBusy(mealKey)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        window.alert('Your session expired. Sign in again and try cancelling the meal.')
        return
      }
      await apiJson('/bookings/cancel', {
        method: 'POST',
        token: accessToken,
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
      <div className="glass-surface p-5 text-sm">
        <p className="section-kicker text-amber-700">One step left</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Complete your profile
        </h1>
        <p className="mt-2 leading-6 text-slate-600">
          Add your details to book meals, submit complaints, and use the mess without friction.
        </p>
        <Link to="/app/profile" className="primary-button mt-4 inline-flex">
          Go to profile
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      {visibleAnnouncements.map((item) => {
        const expiry = getAnnouncementExpiry(item)
        return (
          <AnnouncementBanner
            key={item.id}
            message={item.message}
            meta={
              expiry
                ? `Visible until ${formatAnnouncementDate(expiry)}`
                : 'Campus update'
            }
            onDismiss={() => {
              setDismissedAnnouncements((current) => [
                ...new Set([...current, String(item.id)]),
              ])
            }}
          />
        )
      })}

      <header className="hero-surface px-5 py-5 sm:px-6">
        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="section-kicker text-white/72">Student dashboard</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-[2rem]">
                Hello, {student.name}
              </h1>
              <p className="mt-2 text-sm text-white/82">{student.roll_number}</p>
            </div>
            <span className="soft-pill border-white/15 bg-white/12 text-white/88">
              {onLeaveToday ? 'On leave today' : 'Meals open today'}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/12 p-3 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                This month
              </p>
              <p className="mt-2 text-2xl font-bold text-white">{stats.attended}</p>
              <p className="mt-1 text-xs text-white/70">Meals attended</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/12 p-3 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                No-show
              </p>
              <p className="mt-2 text-2xl font-bold text-white">{stats.noshow}</p>
              <p className="mt-1 text-xs text-white/70">Auto-tracked this month</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/12 p-3 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                Today
              </p>
              <p className="mt-2 text-lg font-bold text-white">
                {onLeaveToday ? 'Vacation mode' : 'Ready to book'}
              </p>
              <p className="mt-1 text-xs text-white/70">Stay ahead of cutoffs</p>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="section-kicker">Daily booking</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Today's meals
            </h2>
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Quick actions
          </p>
        </div>
        {loading ? (
          <MealCardsSkeleton />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {MEALS.map((meal) => {
              const row = bookingByMeal[meal.key]
              const closed = isBookingClosed(meal.key)
              const leave = onLeaveToday
              const tone = mealTone[meal.key] ?? mealTone.breakfast
              let statusLabel = 'Not booked'

              if (leave) statusLabel = 'On leave'
              else if (row?.status === 'booked') statusLabel = 'Booked'
              else if (row?.status === 'attended') statusLabel = 'Attended'
              else if (row?.status === 'no_show') statusLabel = 'No-show'
              else if (row?.status === 'cancelled') statusLabel = 'Cancelled'
              else if (!row && closed) statusLabel = 'Booking closed'

              const canBook =
                !leave &&
                !closed &&
                (!row || row.status === 'cancelled') &&
                row?.status !== 'attended'

              const showCancel =
                row?.status === 'booked' && canCancelBooking(meal.key) && !leave

              return (
                <div
                  key={meal.key}
                  className={`elevated-surface bg-gradient-to-br p-4 transition-all duration-200 ${tone.card} ${
                    confirmMeal === meal.key || busy === meal.key
                      ? 'ring-2 ring-primary/20 shadow-md shadow-primary/10'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone.badge}`}
                      >
                        {meal.label}
                      </span>
                      <p className="mt-3 text-xl font-bold tracking-tight text-slate-900">
                        {meal.label}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        {formatRange(meal.key)} IST
                      </p>
                    </div>
                    <span className="rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                      {statusLabel}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {mealDescription({ leave, closed, row })}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {row?.status !== 'booked' && row?.status !== 'attended' && (
                      <button
                        type="button"
                        disabled={!canBook || busy === meal.key}
                        onClick={() => setConfirmMeal(meal.key)}
                        className="primary-button px-4 py-2.5 text-xs"
                      >
                        {busy === meal.key
                          ? 'Booking...'
                          : row?.status === 'cancelled'
                            ? 'Book again'
                            : 'Book meal'}
                      </button>
                    )}
                    {showCancel && (
                      <button
                        type="button"
                        disabled={busy === meal.key}
                        onClick={() => cancelMeal(meal.key)}
                        className="secondary-button px-4 py-2.5 text-xs"
                      >
                        {busy === meal.key ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="glass-surface p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="section-kicker">Your trend</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              This month
            </h2>
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Personal stats
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
          <div className="metric-card py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Attendance
            </p>
            <p className="mt-2 text-2xl font-bold text-primary">{stats.attended}</p>
            <p className="mt-1 text-xs text-slate-500">Meals attended</p>
          </div>
          <div className="metric-card py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              No-show
            </p>
            <p className="mt-2 text-2xl font-bold text-rose-600">{stats.noshow}</p>
            <p className="mt-1 text-xs text-slate-500">Auto-tracked</p>
          </div>
        </div>
      </section>

      <p className="text-center text-xs text-slate-400">
        Menu and impact: use the bottom navigation
      </p>

      {confirmMeal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-md">
          <div className="glass-surface w-full max-w-[420px] p-5 shadow-[0_34px_90px_-36px_rgba(15,23,42,0.58)]">
            <p className="section-kicker">Confirm action</p>
            <p className="mt-1 text-xl font-bold text-slate-900">Confirm booking</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Book {MEALS.find((x) => x.key === confirmMeal)?.label} for today?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="secondary-button flex-1"
                onClick={() => setConfirmMeal(null)}
              >
                No
              </button>
              <button
                type="button"
                disabled={busy === confirmMeal}
                className="primary-button flex-1"
                onClick={() => bookMeal(confirmMeal)}
              >
                {busy === confirmMeal ? 'Booking...' : 'Yes, book meal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
