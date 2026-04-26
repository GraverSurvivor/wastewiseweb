import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiForm } from '../../lib/api'
import { EmptyState } from '../../components/EmptyState'
import { Skeleton } from '../../components/Skeleton'
import { Inbox } from '../../components/icons/Icons'

const statusLabel = (status) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1) : ''

const formatTicketTime = (value) => {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function ComplaintsPage() {
  const { student, supabase, session } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)

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
      <Link
        to="/app/profile"
        className="text-sm font-medium text-primary underline"
      >
        Back to profile
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
            description="Mess hygiene, food quality - we are listening."
          />
        ) : (
          <ul className="space-y-2">
            {items.map((ticket) => (
              <li
                key={ticket.id}
                className="rounded-2xl border border-slate-100 bg-white p-3 text-sm shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{ticket.title}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Submitted {formatTicketTime(ticket.created_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      ticket.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : ticket.status === 'acknowledged'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Status: {statusLabel(ticket.status)}
                  </span>
                </div>

                <p className="mt-1 line-clamp-3 text-slate-600">
                  {ticket.description}
                </p>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(ticket)}
                    className="interactive-button rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary"
                  >
                    Open ticket
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-[390px] rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Ticket details
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {selectedTicket.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {statusLabel(selectedTicket.status)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Submitted
                </p>
                <p className="mt-1 text-slate-800">
                  {formatTicketTime(selectedTicket.created_at)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Description
                </p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">
                  {selectedTicket.description}
                </p>
              </div>

              {selectedTicket.photo_url && (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Attached photo
                  </p>
                  <img
                    src={selectedTicket.photo_url}
                    alt="Complaint attachment"
                    className="mt-2 max-h-72 w-full rounded-xl object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
