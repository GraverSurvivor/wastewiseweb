import { menuForDate } from '../../data/menu'
import { MEALS, formatRange } from '../../utils/meals'

const counterTone = {
  south: 'from-amber-50 to-yellow-50 border-amber-200/80',
  north: 'from-orange-50 to-rose-50 border-orange-200/80',
}

export function MenuPage() {
  const date = new Date()
  const menu = menuForDate(date)

  return (
    <div className="page-enter space-y-4 pb-4">
      <div className="hero-surface px-5 py-5">
        <div className="relative z-10">
          <p className="section-kicker text-white/72">Kitchen lineup</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Weekly menu
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/80">
            {menu.day} with parallel South Indian and North Indian counters for every major meal.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {MEALS.map((meal) => {
          const block = menu[meal.key]
          if (!block) return null

          return (
            <section key={meal.key} className="glass-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="section-kicker">{meal.label}</p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                    {meal.label}
                  </h2>
                </div>
                <span className="soft-pill border-slate-200 bg-white/75 text-slate-600">
                  {formatRange(meal.key)} IST
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div
                  className={`rounded-[22px] border bg-gradient-to-br p-4 ${counterTone.south}`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-800">
                    South Indian counter
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {block.south}
                  </p>
                </div>
                <div
                  className={`rounded-[22px] border bg-gradient-to-br p-4 ${counterTone.north}`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-800">
                    North Indian counter
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {block.north}
                  </p>
                </div>
              </div>
            </section>
          )
        })}
      </div>

      <p className="text-center text-xs text-slate-400">
        Menu rotates automatically based on the day of the week.
      </p>
    </div>
  )
}
