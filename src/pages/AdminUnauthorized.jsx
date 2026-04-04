import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function AdminUnauthorized() {
  const { signOut } = useAuth()
  return (
    <div className="page-enter mx-auto flex min-h-[100dvh] max-w-[390px] flex-col justify-center px-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h1 className="text-lg font-bold text-slate-900">Admin access only</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your account is not marked as an admin. Ask the mess office to update
          your role in Supabase (<code className="text-xs">profiles.role</code>{' '}
          → admin).
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            to="/app"
            className="block rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white"
          >
            Go to student app
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
