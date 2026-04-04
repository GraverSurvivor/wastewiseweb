export function AnnouncementBanner({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 shadow-sm">
      <span className="mt-0.5 text-lg" aria-hidden>
        📣
      </span>
      <p className="flex-1 leading-snug">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg px-2 py-0.5 text-amber-800/80 hover:bg-amber-100"
        >
          Dismiss
        </button>
      )}
    </div>
  )
}
