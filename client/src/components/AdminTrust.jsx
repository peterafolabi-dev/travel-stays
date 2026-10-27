import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ExternalLink, Flag, Loader2, Mail, Pause, Reply, ShieldCheck, Undo2, X } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { fetchRefundsDue, markRefunded } from '../lib/admin'
import { formatNaira } from '../lib/format'
import {
  CONTACT_SUBJECTS,
  documentUrl,
  fetchContactMessages,
  fetchOpenReports,
  markMessageHandled,
  fetchPendingVerifications,
  idTypeLabel,
  reportCategoryLabel,
  resolveReport,
  reviewVerification,
} from '../lib/safety'

function timeAgo(value) {
  const hours = Math.round((Date.now() - new Date(value).getTime()) / 3600000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

function Thumb({ label, url, pdf }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group relative grid aspect-4/3 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-stone-200"
    >
      {!url ? (
        <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
      ) : pdf ? (
        <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-700">
          <ExternalLink className="h-4 w-4" /> Open PDF
        </span>
      ) : (
        <img src={url} alt={label} className="h-full w-full object-cover transition group-hover:scale-105" />
      )}
      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{label}</span>
    </a>
  )
}

// The ID and the selfie side by side, so the admin can check the faces match.
function DocPair({ idPath, selfiePath }) {
  const { data, error } = useAsync(
    () => Promise.all([documentUrl(idPath), documentUrl(selfiePath)]),
    `${idPath}|${selfiePath}`,
  )
  const [idUrl, selfieUrl] = data ?? []

  if (error) return <p className="mt-3 text-sm text-red-700">Could not load the photos: {error}</p>
  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 gap-2">
        <Thumb label="ID" url={idUrl} pdf={idPath.toLowerCase().endsWith('.pdf')} />
        <Thumb label="Selfie" url={selfieUrl} />
      </div>
      <p className="mt-2 text-xs text-stone-500">Does the face in the selfie match the ID, and does the name match the account?</p>
    </div>
  )
}

// Admin dashboard: ID verification queue + open reports.
export default function AdminTrust({ onChange }) {
  const toast = useToast()
  const verifications = useAsync(fetchPendingVerifications, 'verifications')
  const reports = useAsync(fetchOpenReports, 'reports')
  const [busy, setBusy] = useState(null)

  async function run(id, action, success) {
    setBusy(id)
    try {
      await action()
      toast.show(success)
      verifications.reload()
      reports.reload()
      onChange?.()
    } catch (err) {
      toast.show({ type: 'error', title: 'Something went wrong', description: err.message })
    }
    setBusy(null)
  }

  function review(v, approve) {
    let reason = null
    if (!approve) {
      reason = window.prompt('Why is this being rejected? (shown to the user)', 'The photo is not clear enough.')
      if (reason === null) return
    }
    run(v.id, () => reviewVerification(v.id, approve, reason), {
      title: approve ? `${v.full_name || 'User'} is now verified` : 'Request rejected',
      description: approve ? 'The Verified badge now shows on their listings and tours.' : 'They can send new documents.',
    })
  }

  function resolve(r, pause) {
    run(r.id, () => resolveReport(r.id, pause), {
      title: pause ? `${r.target_type === 'tour' ? 'Tour' : 'Listing'} paused` : 'Report dismissed',
      description: pause ? 'It is hidden from search until the owner fixes it.' : r.target_title,
    })
  }

  const pending = verifications.data ?? []
  const open = reports.data ?? []

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-900/5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-stone-900">
            <ShieldCheck className="h-5 w-5 text-emerald-700" /> ID verification
          </h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{pending.length} waiting</span>
        </div>
        <p className="text-sm text-stone-500">Check the ID matches the selfie and the account name.</p>
        {verifications.error && <p className="mt-4 text-sm text-red-700">{verifications.error}</p>}
        <ul className="mt-4 space-y-3">
          {pending.map((v) => (
            <li key={v.id} className="rounded-xl bg-stone-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-stone-900">
                    {v.full_name || 'No name'} <span className="text-xs font-semibold capitalize text-stone-500">· {v.role}</span>
                  </p>
                  <p className="text-xs text-stone-500">
                    {v.email} · {idTypeLabel(v.id_type)} · {timeAgo(v.created_at)}
                  </p>
                </div>
              </div>
              <DocPair idPath={v.id_doc_path} selfiePath={v.selfie_path} />
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy === v.id}
                  onClick={() => review(v, false)}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:ring-stone-900 disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Reject
                </button>
                <button
                  disabled={busy === v.id}
                  onClick={() => review(v, true)}
                  className="flex items-center gap-1 rounded-full bg-emerald-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Approve
                </button>
              </div>
            </li>
          ))}
          {!verifications.loading && !pending.length && <li className="text-sm text-stone-500">Nothing to review.</li>}
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-900/5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-stone-900">
            <Flag className="h-5 w-5 text-red-600" /> Reports
          </h2>
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">{open.length} open</span>
        </div>
        <p className="text-sm text-stone-500">Pause anything unsafe; it leaves search straight away.</p>
        {reports.error && <p className="mt-4 text-sm text-red-700">{reports.error}</p>}
        <ul className="mt-4 space-y-3">
          {open.map((r) => (
            <li key={r.id} className="rounded-xl bg-stone-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {r.target_type === 'guest' ? (
                    <p className="font-medium text-stone-900">{r.target_title}</p>
                  ) : (
                    <Link
                      to={`/${r.target_type === 'tour' ? 'tours' : 'listings'}/${r.target_id}`}
                      className="font-medium text-stone-900 hover:underline"
                    >
                      {r.target_title}
                    </Link>
                  )}
                  <p className="text-xs text-stone-500">
                    {r.target_type === 'guest'
                      ? 'Guest'
                      : `${r.target_type === 'tour' ? 'Tour' : 'Listing'} by ${r.owner_name || 'unknown'}`}{' '}
                    · reported by {r.reporter_name || 'a user'} · {timeAgo(r.created_at)}
                  </p>
                </div>
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">{reportCategoryLabel(r.category)}</span>
              </div>
              {r.details && <p className="mt-2 whitespace-pre-line text-sm text-stone-700">"{r.details}"</p>}
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy === r.id}
                  onClick={() => resolve(r, false)}
                  className="rounded-full px-3 py-1.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:ring-stone-900 disabled:opacity-50"
                >
                  Dismiss
                </button>
                {r.target_status === 'active' && (
                  <button
                    disabled={busy === r.id}
                    onClick={() => resolve(r, true)}
                    className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <Pause className="h-4 w-4" /> Pause {r.target_type}
                  </button>
                )}
              </div>
            </li>
          ))}
          {!reports.loading && !open.length && <li className="text-sm text-stone-500">No open reports.</li>}
        </ul>
      </section>
      <MessagesPanel />
    </div>
  )
}

// Messages sent through the Help centre's contact form (migration 014).
function MessagesPanel() {
  const toast = useToast()
  const messages = useAsync(fetchContactMessages, 'contact-messages')
  const [busy, setBusy] = useState(null)
  const list = messages.data ?? []

  async function handled(m) {
    setBusy(m.id)
    try {
      await markMessageHandled(m.id)
      toast.show({ title: 'Marked as handled', description: `Message from ${m.name}` })
      messages.reload()
    } catch (err) {
      toast.show({ type: 'error', title: 'Something went wrong', description: err.message })
    }
    setBusy(null)
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-900/5 lg:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-stone-900">
          <Mail className="h-5 w-5 text-sky-700" /> Messages
        </h2>
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">{list.length} open</span>
      </div>
      <p className="text-sm text-stone-500">Sent through the contact form in the Help centre. Reply by email, then mark as handled.</p>
      {messages.error && <p className="mt-4 text-sm text-red-700">{messages.error}</p>}
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {list.map((m) => (
          <li key={m.id} className="flex flex-col rounded-xl bg-stone-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-stone-900">{m.name}</p>
                <p className="truncate text-xs text-stone-500">
                  {m.email} · {timeAgo(m.created_at)}
                  {m.booking_ref && ` · booking ${m.booking_ref}`}
                </p>
              </div>
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
                {CONTACT_SUBJECTS.find((s) => s.value === m.subject)?.label ?? m.subject}
              </span>
            </div>
            <p className="mt-2 flex-1 whitespace-pre-line text-sm text-stone-700">{m.message}</p>
            <div className="mt-3 flex gap-2">
              <a
                href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message to Travel & Stays')}`}
                className="flex items-center gap-1 rounded-full bg-emerald-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-900"
              >
                <Reply className="h-4 w-4" /> Reply by email
              </a>
              <button
                disabled={busy === m.id}
                onClick={() => handled(m)}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:ring-stone-900 disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Mark handled
              </button>
            </div>
          </li>
        ))}
        {!messages.loading && !list.length && <li className="text-sm text-stone-500">No new messages.</li>}
      </ul>
    </section>
  )
}
