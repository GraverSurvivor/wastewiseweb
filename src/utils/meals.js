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

const BOOKING_CUTOFF_MINUTES = {
  breakfast: 120,
  lunch: 120,
  snacks: 120,
  dinner: 15,
}

const IST_OFFSET_MINUTES = 330

function shiftToIst(d) {
  return new Date(new Date(d).getTime() + IST_OFFSET_MINUTES * 60 * 1000)
}

function istDateParts(d) {
  const x = shiftToIst(d)
  return {
    year: x.getUTCFullYear(),
    month: x.getUTCMonth(),
    date: x.getUTCDate(),
  }
}

function atIstOnDay(d, { h, m }) {
  const { year, month, date } = istDateParts(d)
  return new Date(
    Date.UTC(year, month, date, h, m) - IST_OFFSET_MINUTES * 60 * 1000,
  )
}

/** First instant when booking is no longer allowed for the meal. */
export function bookingCutoff(mealKey, day = new Date()) {
  const meal = MEALS.find((m) => m.key === mealKey)
  if (!meal) return new Date(day)
  const start = atIstOnDay(day, meal.start)
  const cutoffMinutes = BOOKING_CUTOFF_MINUTES[mealKey] ?? 120
  return new Date(start.getTime() - cutoffMinutes * 60 * 1000)
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
  return atIstOnDay(day, meal.start)
}

export function mealWindowEnd(mealKey, day = new Date()) {
  const meal = MEALS.find((m) => m.key === mealKey)
  if (!meal) return day
  return atIstOnDay(day, meal.end)
}

/** Meal currently in serving window, or null if none. */
export function getActiveServingMeal(now = new Date()) {
  for (const m of MEALS) {
    const a = atIstOnDay(now, m.start)
    const b = atIstOnDay(now, m.end)
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
  const x = shiftToIst(d)
  const y = x.getUTCFullYear()
  const mo = String(x.getUTCMonth() + 1).padStart(2, '0')
  const da = String(x.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}
