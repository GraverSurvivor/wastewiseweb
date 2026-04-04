let permission = typeof Notification !== 'undefined' ? Notification.permission : 'denied'

export async function requestNotifyPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  const r = await Notification.requestPermission()
  permission = r
  return r
}

export function scheduleMealEndReminder(mealKey, mealLabel, endTime, onFallback) {
  const ms = endTime.getTime() - Date.now()
  if (ms <= 0 || ms > 24 * 60 * 60 * 1000) return () => {}
  const t = setTimeout(() => {
    const title = 'WasteWise — Meal ending soon'
    const body = `${mealLabel} window is ending. Please finish on time to help reduce waste.`
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.svg' })
      } catch {
        onFallback?.(body)
      }
    } else {
      onFallback?.(body)
    }
  }, ms)
  return () => clearTimeout(t)
}
