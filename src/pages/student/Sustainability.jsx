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
      supabase
        .from('waste_log')
        .select('waste_kg')
        .gte('date', iso.p0)
        .lte('date', iso.p1),
      supabase
        .from('waste_log')
        .select('waste_kg, date')
        .gte('date', iso.w0)
        .lte('date', iso.w1),
    ])

    setMonthRows(cur.data ?? [])
    setLastMonthRows(prev.data ?? [])

    const daily = {}
    ;(week.data ?? []).forEach((r) => {
      daily[r.date] = (daily[r.date] ?? 0) + Number(r.waste_kg)
    })
    const bars = []
    for (let i = 0; i < 7; i++) {
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
    const thisMonth = monthRows.reduce(
      (s, r) => s + Number(r.waste_kg || 0),
      0,
    )
    const last = lastMonthRows.reduce(
      (s, r) => s + Number(r.waste_kg || 0),
      0,
    )
    const reduction =
      last > 0 ? Math.round(((last - thisMonth) / last) * 1000) / 10 : 0
    return {
      wasteKg: Math.round(thisMonth * 10) / 10,
      biogas: Math.round(thisMonth * BIOGAS_PER_KG * 10) / 10,
      slurry: Math.round(thisMonth * SLURRY_PER_KG * 10) / 10,
      reduction,
    }
  }, [monthRows, lastMonthRows])

  return (
    <div className="page-enter space-y-4 pb-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-dark px-4 py-4 text-white shadow-lg">
        <h1 className="text-lg font-bold">Sustainability</h1>
        <p className="text-sm text-white/85">Waste → biogas → campus farms</p>
      </div>

      {loading ? (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase text-slate-400">
                Waste (kg)
              </p>
              <p className="text-xl font-bold text-primary">{totals.wasteKg}</p>
              <p className="text-[10px] text-slate-500">This month</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase text-slate-400">
                Biogas (m³)
              </p>
              <p className="text-xl font-bold text-emerald-700">
                {totals.biogas}
              </p>
              <p className="text-[10px] text-slate-500">1 kg → 0.3 m³</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase text-slate-400">
                Slurry (kg)
              </p>
              <p className="text-xl font-bold text-amber-800">{totals.slurry}</p>
              <p className="text-[10px] text-slate-500">1 kg → 0.6 kg</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase text-slate-400">
                vs last month
              </p>
              <p className="text-xl font-bold text-admin">
                {totals.reduction}%
              </p>
              <p className="text-[10px] text-slate-500">Waste reduction</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">
              Daily waste (this week)
            </h2>
            <div className="mt-2 h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekByDay} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={28} />
                  <Tooltip />
                  <Bar dataKey="kg" fill="#1a7a52" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">
              Campus pipeline
            </h2>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-center text-[10px] text-slate-600">
              <div className="flex flex-1 min-w-[72px] flex-col items-center gap-1">
                <div className="h-10 w-10 rounded-full bg-amber-100 text-lg leading-10">
                  🍛
                </div>
                <span className="font-semibold">Food waste</span>
              </div>
              <span className="text-primary">→</span>
              <div className="flex flex-1 min-w-[72px] flex-col items-center gap-1">
                <div className="h-10 w-10 rounded-full bg-emerald-100 text-lg leading-10">
                  ⚗️
                </div>
                <span className="font-semibold">Biogas plant</span>
              </div>
              <span className="text-primary">→</span>
              <div className="flex flex-1 min-w-[72px] flex-col items-center gap-1">
                <div className="h-10 w-10 rounded-full bg-lime-100 text-lg leading-10">
                  🔥
                </div>
                <span className="font-semibold">Biogas</span>
              </div>
              <span className="text-primary">+</span>
              <div className="flex flex-1 min-w-[72px] flex-col items-center gap-1">
                <div className="h-10 w-10 rounded-full bg-stone-100 text-lg leading-10">
                  🌱
                </div>
                <span className="font-semibold">Slurry</span>
              </div>
              <span className="text-primary">→</span>
              <div className="flex flex-1 min-w-[72px] flex-col items-center gap-1">
                <div className="h-10 w-10 rounded-full bg-green-100 text-lg leading-10">
                  🚜
                </div>
                <span className="font-semibold">Agriculture</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
