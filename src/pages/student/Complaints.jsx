import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiForm } from '../../lib/api'
import { EmptyState } from '../../components/EmptyState'
import { Skeleton } from '../../components/Skeleton'
import { Inbox } from '../../components/icons/Icons'

const statusLabel = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

export function ComplaintsPage() {
  const { student, supabase, session } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !student?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('complaints')
      .select('*')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }, [supabase, student?.id])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (e) => {
    e.preventDefault()
    if (!session?.access_token || !student || !title.trim()) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('title', title.trim())
      fd.append('description', description.trim() || '-')
      if (file) fd.append('photo', file)
      await apiForm('/complaints', {
        token: session.access_token,
        formData: fd,
      })
      setTitle('')
      setDescription('')
      setFile(null)
      await load()
    } catch (err) {
      window.alert(err?.message || 'Could not submit complaint.')
    } finally {
      setBusy(false)
    }
  }

  if (!student) {
    return (
      <p className="text-sm text-slate-600">
        <Link to="/app/profile" className="text-primary underline">
          Complete profile
        </Link>{' '}
        first.
      </p>
    )
  }

  return (
    <div className="page-enter mx-auto max-w-[390px] space-y-4 pb-24">
      <Link to="/app/profile" className="text-sm font-medium text-primary underline">
        ← Profile
      </Link>
      <h1 className="text-lg font-bold">Complaints</h1>

      <form
        onSubmit={submit}
        className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3"
      >
        <input
          required
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="min-h-[88px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Describe the issue"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <label className="block text-xs font-medium text-slate-600">
          Photo (optional)
          <input
            type="file"
            accept="image/*"
            className="mt-1 w-full text-xs"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white"
        >
          Submit complaint
        </button>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Your tickets</h2>
        {loading ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No complaints yet"
            description="Mess hygiene, food quality — we're listening."
          />
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <li
                key={c.id}
                className="rounded-2xl border border-slate-100 bg-white p-3 text-sm shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{c.title}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      c.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : c.status === 'acknowledged'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {statusLabel(c.status)}
                  </span>
                </div>
                <p className="mt-1 text-slate-600">{c.description}</p>
                {c.photo_url && (
                  <img
                    src={c.photo_url}
                    alt=""
                    className="mt-2 max-h-40 rounded-lg object-cover"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
