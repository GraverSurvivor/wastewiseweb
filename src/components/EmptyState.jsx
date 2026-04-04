export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
      {Icon && (
        <div className="mb-3 rounded-full bg-primary/10 p-3 text-primary">
          <Icon className="h-8 w-8" aria-hidden />
        </div>
      )}
      <h3 className="font-semibold text-slate-800">{title}</h3>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-slate-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
