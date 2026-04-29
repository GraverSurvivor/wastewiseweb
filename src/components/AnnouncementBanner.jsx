export function AnnouncementBanner({ message, meta, onDismiss }) {
  if (!message) return null

  return (
    <div className="glass-surface mb-3 flex items-start gap-3 px-4 py-3 text-sm text-amber-950">
      <span
        className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-[linear-gradient(135deg,#fff5c4,#ffe18a)] text-sm font-bold text-amber-900 shadow-sm"
        aria-hidden
      >
        !
      </span>
      <div className="flex-1">
        <p className="font-medium leading-snug text-slate-900">{message}</p>
        {meta && <p className="mt-1 text-xs text-slate-500">{meta}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="secondary-button shrink-0 px-3 py-2 text-xs"
        >
          Dismiss
        </button>
      )}
    </div>
  )
}
