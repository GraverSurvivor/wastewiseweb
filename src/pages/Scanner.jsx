import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiJson } from '../lib/api'
import {
  MEALS,
  getActiveServingMeal,
  toISODateLocal,
} from '../utils/meals'

export function Scanner() {
  const { session, isAdmin, supabase } = useAuth()
  const [roll, setRoll] = useState('')
  const [mealOverride, setMealOverride] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const today = useMemo(() => toISODateLocal(new Date()), [])
  const activeMeal = getActiveServingMeal()
  const effectiveMeal = mealOverride || activeMeal

  const headerMealLabel = useMemo(() => {
    if (effectiveMeal) {
      return MEALS.find((meal) => meal.key === effectiveMeal)?.label ?? effectiveMeal
    }
    return 'Between meals'
  }, [effectiveMeal])

  const scanStudent = async (e) => {
    e.preventDefault()
    setResult(null)

    if (!roll.trim() || !effectiveMeal) {
      setResult({
        ok: false,
        msg: !effectiveMeal
          ? 'Pick a meal slot below - no serving window right now.'
          : 'Enter roll number.',
      })
      return
    }

    setBusy(true)
    try {
      const liveSession = supabase
        ? (await supabase.auth.getSession()).data.session
        : session
      const accessToken = liveSession?.access_token ?? session?.access_token

      if (!accessToken) {
        setResult({
          ok: false,
          msg: 'Your admin session expired. Sign in again and retry the scan.',
        })
        return
      }

      const data = await apiJson('/scanner/student', {
        method: 'POST',
        token: accessToken,
        body: {
          roll_number: roll.trim().toUpperCase(),
          meal_type: effectiveMeal,
          date: today,
        },
      })
      setResult({
        ok: data.granted,
        msg: data.message || (data.granted ? 'OK' : 'Denied'),
      })
      if (data.granted) setRoll('')
    } catch (error) {
      setResult({ ok: false, msg: error?.message || 'Request failed.' })
    } finally {
      setBusy(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 px-4 py-8 text-center text-slate-200">
        <p className="text-sm">Scanner requires an admin session.</p>
        <Link to="/login" className="mt-4 inline-block text-primary">
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="page-enter min-h-[100dvh] bg-slate-950 px-3 py-6 text-slate-100">
      <div className="mx-auto max-w-[390px] space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-white">
            Gate scanner
          </h1>
          <Link to="/admin" className="text-xs text-sky-300 underline">
            Admin
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-4 shadow-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Active meal
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">
            {headerMealLabel}
          </p>
          <label className="mt-3 block text-[10px] font-medium text-slate-400">
            Override meal (if between windows)
            <select
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
              value={mealOverride}
              onChange={(e) => setMealOverride(e.target.value)}
            >
              <option value="">Auto (serving window)</option>
              {MEALS.map((meal) => (
                <option key={meal.key} value={meal.key}>
                  {meal.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <form
          onSubmit={scanStudent}
          className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <h2 className="text-sm font-semibold text-white">Student roll / ID</h2>
          <input
            autoComplete="off"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none ring-emerald-500/40 focus:ring-2"
            placeholder="Scan or type roll number"
            value={roll}
            onChange={(e) => setRoll(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            Check booking
          </button>
        </form>

        {result && (
          <div
            className={`rounded-2xl border px-4 py-4 text-center text-sm font-semibold ${
              result.ok
                ? 'border-emerald-700 bg-emerald-950/80 text-emerald-200'
                : 'border-rose-800 bg-rose-950/80 text-rose-200'
            }`}
          >
            {result.msg}
          </div>
        )}
      </div>
    </div>
  )
}
