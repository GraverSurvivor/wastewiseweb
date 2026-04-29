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
  const { student, supabase, getAccessToken } = useAuth()
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
  }, [student?.id, supabase])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (e) => {
    e.preventDefault()
    if (!student || !title.trim()) return

    setBusy(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        window.alert('Your session expired. Sign in again and try submitting the complaint.')
        return
      }
      const fd = new FormData()
      fd.append('title', title.trim())
      fd.append('description', description.trim() || '-')
      if (file) fd.append('photo', file)

      await apiForm('/complaints', {
        token: accessToken,
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
    <div className="page-enter space-y-4 pb-24">
      <div className="hero-surface px-5 py-5">
        <div className="relative z-10">
          <p className="section-kicker text-white/72">Student support</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Complaints desk
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/80">
            Report food quality, hygiene, or mess issues and keep everything tracked in one place.
          </p>
        </div>
      </div>

      <Link to="/app/profile" className="text-sm font-semibold text-primary">
        Back to profile
      </Link>

      <form onSubmit={submit} className="glass-surface space-y-4 p-5">
        <div>
          <p className="section-kicker">Raise a ticket</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Tell the mess team what happened
          </h2>
        </div>
        <input
          required
          className="form-input mt-0"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="form-textarea mt-0"
          placeholder="Describe the issue"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Photo (optional)
          <input
            type="file"
            accept="image/*"
            className="mt-2 block w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-slate-700"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" disabled={busy} className="primary-button w-full">
          {busy ? 'Submitting...' : 'Submit complaint'}
        </button>
      </form>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="section-kicker">History</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Your tickets
            </h2>
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-24 w-full rounded-[28px]" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No complaints yet"
            description="Mess hygiene, food quality, or service issues can be reported here."
          />
        ) : (
          <ul className="space-y-3">
            {items.map((ticket) => (
              <li key={ticket.id} className="glass-surface p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold tracking-tight text-slate-900">
                      {ticket.title}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      Submitted {formatTicketTime(ticket.created_at)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      ticket.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : ticket.status === 'acknowledged'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {statusLabel(ticket.status)}
                  </span>
                </div>

                <p className="mt-3 line-clamp-3 leading-6 text-slate-600">
                  {ticket.description}
                </p>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(ticket)}
                    className="secondary-button px-4 py-2 text-xs text-primary"
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center">
          <div className="glass-surface w-full max-w-[420px] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-kicker">Ticket details</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  {selectedTicket.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="secondary-button px-3 py-2 text-xs"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="metric-card">
                <p className="section-kicker">Status</p>
                <p className="mt-2 font-semibold text-slate-900">
                  {statusLabel(selectedTicket.status)}
                </p>
              </div>

              <div className="metric-card">
                <p className="section-kicker">Submitted</p>
                <p className="mt-2 text-slate-800">
                  {formatTicketTime(selectedTicket.created_at)}
                </p>
              </div>

              <div className="metric-card">
                <p className="section-kicker">Description</p>
                <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-800">
                  {selectedTicket.description}
                </p>
              </div>

              {selectedTicket.photo_url && (
                <div className="metric-card">
                  <p className="section-kicker">Attached photo</p>
                  <img
                    src={selectedTicket.photo_url}
                    alt="Complaint attachment"
                    className="mt-3 max-h-72 w-full rounded-2xl object-cover"
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
