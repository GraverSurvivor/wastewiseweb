import { Link, Outlet } from 'react-router-dom'

export function AdminLayout() {
  return (
    <div className="min-h-[100dvh] bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-admin text-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-3">
          <Link to="/admin" className="font-semibold tracking-tight">
            WasteWise Admin
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link
              to="/scanner"
              className="rounded-lg bg-white/15 px-2 py-1.5 transition hover:bg-white/25"
            >
              Scanner
            </Link>
            <Link
              to="/app"
              className="rounded-lg bg-white/15 px-2 py-1.5 transition hover:bg-white/25"
            >
              Student app
            </Link>
          </div>
        </div>
      </header>
      <main className="page-enter mx-auto max-w-3xl px-3 py-4">
        <Outlet />
      </main>
    </div>
  )
}
