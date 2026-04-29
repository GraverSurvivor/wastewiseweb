import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../../context/AuthContext'
import { Skeleton } from '../../components/Skeleton'
import { toISODateLocal } from '../../utils/meals'

const BIOGAS_PER_KG = 0.3
const SLURRY_PER_KG = 0.6

export function SustainabilityPage() {
  const { supabase } = useAuth()
  const [loading, setLoading] = useState(true)
  const [monthRows, setMonthRows] = useState([])
  const [lastMonthRows, setLastMonthRows] = useState([])
  const [weekByDay, setWeekByDay] = useState([])

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    const day = now.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + mondayOffset)
    weekStart.setHours(0, 0, 0, 0)

    const iso = {
      m0: toISODateLocal(monthStart),
      m1: toISODateLocal(monthEnd),
      p0: toISODateLocal(prevStart),
      p1: toISODateLocal(prevEnd),
      w0: toISODateLocal(weekStart),
      w1: toISODateLocal(now),
    }

    const [cur, prev, week] = await Promise.all([
      supabase
        .from('waste_log')
        .select('waste_kg, date, meal_type')
        .gte('date', iso.m0)
        .lte('date', iso.m1),
      supabase.from('waste_log').select('waste_kg').gte('date', iso.p0).lte('date', iso.p1),
      supabase.from('waste_log').select('waste_kg, date').gte('date', iso.w0).lte('date', iso.w1),
    ])

    setMonthRows(cur.data ?? [])
    setLastMonthRows(prev.data ?? [])

    const daily = {}
    ;(week.data ?? []).forEach((row) => {
      daily[row.date] = (daily[row.date] ?? 0) + Number(row.waste_kg)
    })

    const bars = []
    for (let i = 0; i < 7; i += 1) {
      const dt = new Date(weekStart)
      dt.setDate(weekStart.getDate() + i)
      const key = toISODateLocal(dt)
      const label = dt.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
      })
      bars.push({ label, kg: Math.round((daily[key] ?? 0) * 10) / 10 })
    }
    setWeekByDay(bars)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    const thisMonth = monthRows.reduce((sum, row) => sum + Number(row.waste_kg || 0), 0)
    const last = lastMonthRows.reduce((sum, row) => sum + Number(row.waste_kg || 0), 0)
    const reduction = last > 0 ? Math.round(((last - thisMonth) / last) * 1000) / 10 : 0
    return {
      wasteKg: Math.round(thisMonth * 10) / 10,
      biogas: Math.round(thisMonth * BIOGAS_PER_KG * 10) / 10,
      slurry: Math.round(thisMonth * SLURRY_PER_KG * 10) / 10,
      reduction,
    }
  }, [lastMonthRows, monthRows])

  return (
    <div className="page-enter space-y-4 pb-4">
      <div className="hero-surface px-5 py-5">
        <div className="relative z-10">
          <p className="section-kicker text-white/72">Sustainability loop</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Waste to energy
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/80">
            See how the mess waste stream turns into measurable campus impact through biogas and agricultural reuse.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-[28px]" />
          <Skeleton className="h-56 w-full rounded-[28px]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="metric-card">
              <p className="section-kicker">Waste</p>
              <p className="mt-2 text-2xl font-bold text-primary">{totals.wasteKg}</p>
              <p className="mt-1 text-xs text-slate-500">kg this month</p>
            </div>
            <div className="metric-card">
              <p className="section-kicker">Biogas</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{totals.biogas}</p>
              <p className="mt-1 text-xs text-slate-500">m3 generated</p>
            </div>
            <div className="metric-card">
              <p className="section-kicker">Slurry</p>
              <p className="mt-2 text-2xl font-bold text-amber-800">{totals.slurry}</p>
              <p className="mt-1 text-xs text-slate-500">kg equivalent</p>
            </div>
            <div className="metric-card">
              <p className="section-kicker">Vs last month</p>
              <p className="mt-2 text-2xl font-bold text-admin">{totals.reduction}%</p>
              <p className="mt-1 text-xs text-slate-500">waste reduction</p>
            </div>
          </div>

          <div className="glass-surface p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="section-kicker">Weekly chart</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  Daily waste this week
                </h2>
              </div>
            </div>
            <div className="mt-4 h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekByDay} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbe4ef" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={28} />
                  <Tooltip />
                  <Bar dataKey="kg" fill="#1a7a52" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-surface p-4">
            <p className="section-kicker">Impact pipeline</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              How waste returns to campus value
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {[
                ['Food waste', 'Kitchen leftovers move into the recovery stream.'],
                ['Biogas plant', 'Organic waste is processed for useful fuel.'],
                ['Energy and slurry', 'Gas powers utility use while slurry supports soil.'],
                ['Campus agriculture', 'Recovered output supports green operations.'],
              ].map(([title, desc]) => (
                <div key={title} className="metric-card">
                  <p className="text-sm font-bold text-slate-900">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
