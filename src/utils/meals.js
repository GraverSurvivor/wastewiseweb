export const MEALS = [
  {
    key: 'breakfast',
    label: 'Breakfast',
    start: { h: 7, m: 30 },
    end: { h: 9, m: 0 },
  },
  {
    key: 'lunch',
    label: 'Lunch',
    start: { h: 12, m: 0 },
    end: { h: 14, m: 0 },
  },
  {
    key: 'snacks',
    label: 'Snacks',
    start: { h: 16, m: 30 },
    end: { h: 17, m: 30 },
  },
  {
    key: 'dinner',
    label: 'Dinner',
    start: { h: 19, m: 30 },
    end: { h: 21, m: 30 },
  },
]

function atToday(d, { h, m }) {
  const x = new Date(d)
  x.setHours(h, m, 0, 0)
  return x
}

/** First instant when booking is no longer allowed (2h before meal start). */
export function bookingCutoff(mealKey, day = new Date()) {
  const meal = MEALS.find((m) => m.key === mealKey)
  if (!meal) return new Date(day)
  const start = atToday(day, meal.start)
  return new Date(start.getTime() - 2 * 60 * 60 * 1000)
}

export function isBookingClosed(mealKey, now = new Date()) {
  return now >= bookingCutoff(mealKey, now)
}

export function canCancelBooking(mealKey, now = new Date()) {
  return now < bookingCutoff(mealKey, now)
}

export function mealWindowStart(mealKey, day = new Date()) {
  const meal = MEALS.find((m) => m.key === mealKey)
  if (!meal) return day
  return atToday(day, meal.start)
}

export function mealWindowEnd(mealKey, day = new Date()) {
  const meal = MEALS.find((m) => m.key === mealKey)
  if (!meal) return day
  return atToday(day, meal.end)
}

/** Meal currently in serving window, or null if none. */
export function getActiveServingMeal(now = new Date()) {
  for (const m of MEALS) {
    const a = atToday(now, m.start)
    const b = atToday(now, m.end)
    if (now >= a && now <= b) return m.key
  }
  return null
}

export function formatRange(mealKey) {
  const meal = MEALS.find((m) => m.key === mealKey)
  if (!meal) return ''
  const pad = (n) => String(n).padStart(2, '0')
  const fmt = ({ h, m }) => `${pad(h)}:${pad(m)}`
  return `${fmt(meal.start)}–${fmt(meal.end)}`
}

export function toISODateLocal(d) {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}
