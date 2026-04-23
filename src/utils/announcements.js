export function getAnnouncementExpiry(announcement) {
  if (!announcement) return null

  if (announcement.expires_at) {
    const explicitExpiry = new Date(announcement.expires_at)
    return Number.isNaN(explicitExpiry.getTime()) ? null : explicitExpiry
  }

  if (announcement.created_at && announcement.duration_days) {
    const derivedExpiry = new Date(announcement.created_at)
    derivedExpiry.setDate(
      derivedExpiry.getDate() + Number(announcement.duration_days),
    )
    return Number.isNaN(derivedExpiry.getTime()) ? null : derivedExpiry
  }

  return null
}

export function isAnnouncementActive(announcement, referenceDate = new Date()) {
  const expiry = getAnnouncementExpiry(announcement)
  if (!expiry) return true
  return expiry.getTime() > referenceDate.getTime()
}

export function formatAnnouncementDate(dateValue) {
  if (!dateValue) return 'Not set'

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return 'Not set'

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
