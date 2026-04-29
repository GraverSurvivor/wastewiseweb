import { Link, Outlet } from 'react-router-dom'

export function AdminLayout() {
  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/admin" className="text-sm font-semibold tracking-[0.18em] uppercase text-white/90">
            WasteWise Admin
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link
              to="/scanner"
              className="interactive-button rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/90 hover:bg-white/16"
            >
              Scanner
            </Link>
            <Link
              to="/app"
              className="interactive-button rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/90 hover:bg-white/16"
            >
              Student app
            </Link>
          </div>
        </div>
      </header>
      <main className="content-shell max-w-5xl sm:px-4">
        <Outlet />
      </main>
    </div>
  )
}
