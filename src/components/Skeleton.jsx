export function Skeleton({ className = '', rounded = 'rounded-xl' }) {
  return (
    <div
      className={`animate-pulse bg-[linear-gradient(110deg,rgba(226,232,240,0.95),rgba(241,245,249,0.98),rgba(226,232,240,0.95))] ${rounded} ${className}`}
      aria-hidden
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="glass-surface space-y-3 p-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-16 w-full" rounded="rounded-lg" />
    </div>
  )
}

export function MealCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
