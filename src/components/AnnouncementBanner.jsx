export function AnnouncementBanner({ message, meta, onDismiss }) {
  if (!message) return null

  return (
    <div className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 shadow-sm">
      <span
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-900"
        aria-hidden
      >
        !
      </span>
      <div className="flex-1">
        <p className="leading-snug">{message}</p>
        {meta && <p className="mt-1 text-xs text-amber-800/80">{meta}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="interactive-button shrink-0 rounded-lg px-2 py-0.5 text-amber-800/80 hover:bg-amber-100"
        >
          Dismiss
        </button>
      )}
    </div>
  )
}
