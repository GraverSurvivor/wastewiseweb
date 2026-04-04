import { menuForDate } from '../../data/menu'
import { MEALS, formatRange } from '../../utils/meals'

export function MenuPage() {
  const d = new Date()
  const menu = menuForDate(d)

  return (
    <div className="page-enter space-y-4 pb-4">
      <div className="rounded-2xl bg-primary px-4 py-3 text-white shadow-md">
        <h1 className="text-lg font-bold">Weekly menu</h1>
        <p className="text-sm text-white/85">
          {menu.day} • South Indian &amp; North Indian counters
        </p>
      </div>
      <div className="space-y-3">
        {MEALS.map((m) => {
          const block = menu[m.key]
          if (!block) return null
          return (
            <div
              key={m.key}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold capitalize text-slate-900">
                  {m.label}
                </h2>
                <span className="text-[10px] font-medium text-slate-400">
                  {formatRange(m.key)} IST
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="rounded-xl bg-amber-50/80 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-amber-800">
                    South Indian
                  </p>
                  <p className="text-slate-800">{block.south}</p>
                </div>
                <div className="rounded-xl bg-orange-50/80 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-orange-800">
                    North Indian
                  </p>
                  <p className="text-slate-800">{block.north}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-center text-xs text-slate-400">
        Menu rotates automatically by day of the week.
      </p>
    </div>
  )
}
