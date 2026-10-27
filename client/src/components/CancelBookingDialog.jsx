import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react'
import { useAsync } from '../hooks/useAsync'
import { cancelBooking, fetchCancellationQuote } from '../lib/bookings'
import { CANCELLATION_NOTE } from '../lib/constants'
import { formatNaira } from '../lib/format'
import { ease } from '../lib/motion'
import { Alert } from './AuthShell'

function Row({ label, value, tone = 'text-stone-700', strong = false }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'font-semibold' : ''} ${tone}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

// "Cancel this booking?" — shows exactly what the guest gets back under the
// listing's policy (worked out on the server) before they confirm.
export default function CancelBookingDialog({ booking, open, onClose, onCancelled }) {
  const { data: q, loading, error } = useAsync(
    () => (open ? fetchCancellationQuote(booking.id) : Promise.resolve(null)),
    `${booking.id}:${open}`,
  )
  const [agreed, setAgreed] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  function close() {
    setAgreed(false)
    setCancelError('')
    onClose()
  }

  async function confirm() {
    setCancelError('')
    setCancelling(true)
    try {
      await cancelBooking(booking.id)
      setAgreed(false)
      onCancelled(q)
    } catch (err) {
      setCancelError(err.message)
    }
    setCancelling(false)
  }

  const nonRefundable = q?.paid && q.refund === 0

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-stone-950/60 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.3, ease }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="cancel-title" className="font-display text-2xl text-stone-900">
                Cancel this booking?
              </h2>
              <button type="button" onClick={close} className="rounded-full p-1.5 hover:bg-stone-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            {loading && !q ? (
              <div className="mt-6 space-y-3">
                <div className="shimmer h-20 rounded-2xl" />
                <div className="shimmer h-32 rounded-2xl" />
              </div>
            ) : error ? (
              <div className="mt-6">
                <Alert>Could not work out your refund: {error}</Alert>
              </div>
            ) : q && !q.can_cancel ? (
              <div className="mt-6 space-y-4 text-sm text-stone-600">
                <Alert>This booking can no longer be cancelled online — check-in day has arrived or passed.</Alert>
                <p>
                  If something has gone wrong with your stay, please{' '}
                  <Link to="/help#contact" className="font-semibold text-emerald-800 underline">
                    contact support
                  </Link>{' '}
                  with your booking reference.
                </p>
              </div>
            ) : q && !q.paid ? (
              <div className="mt-6 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <p>
                  <strong>Free cancellation.</strong> You haven’t paid for this booking yet, so nothing is charged. The
                  dates will be released for other guests.
                </p>
              </div>
            ) : q ? (
              <div className="mt-6 space-y-4">
                <div
                  className={`rounded-2xl p-5 text-center ring-1 ${
                    nonRefundable ? 'bg-red-50 ring-red-200' : 'bg-emerald-50 ring-emerald-200'
                  }`}
                >
                  <p className={`text-sm font-semibold ${nonRefundable ? 'text-red-800' : 'text-emerald-900'}`}>
                    {nonRefundable ? 'This booking is non-refundable now' : 'You’ll get back'}
                  </p>
                  <p className={`mt-1 font-display text-4xl ${nonRefundable ? 'text-red-700' : 'text-emerald-800'}`}>
                    {formatNaira(q.refund)}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">of the {formatNaira(q.total_paid)} you paid</p>
                </div>

                <div className="space-y-2 rounded-2xl bg-stone-50 p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Refunded</p>
                  <Row label="Nightly cost" value={formatNaira(q.nights_refund)} />
                  <Row label="Cleaning fee" value={formatNaira(q.cleaning_refund)} />
                  <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-stone-400">Non-refundable</p>
                  {q.nights_kept > 0 && <Row label="Nightly cost" value={formatNaira(q.nights_kept)} tone="text-red-700" />}
                  <Row label="Service fee" value={formatNaira(q.service_fee_kept)} tone="text-red-700" />
                </div>

                <p className="flex items-start gap-2 text-sm text-stone-600">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  {q.rule}
                </p>
                <p className="text-xs leading-relaxed text-stone-500">
                  {CANCELLATION_NOTE} Refunds go back to the card you paid with, usually within 5–10 working days.
                </p>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 text-sm text-stone-700 ring-1 ring-stone-200">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-red-600"
                  />
                  <span>
                    I understand that {nonRefundable ? 'I won’t get any money back' : `I’ll get back ${formatNaira(q.refund)}`}{' '}
                    and that this can’t be undone.
                  </span>
                </label>
              </div>
            ) : null}

            {cancelError && (
              <div className="mt-4">
                <Alert>{cancelError}</Alert>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={close}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-stone-800 ring-1 ring-stone-300 transition hover:ring-stone-900"
              >
                Keep my booking
              </button>
              {q?.can_cancel && (
                <button
                  type="button"
                  onClick={confirm}
                  disabled={cancelling || (q.paid && !agreed)}
                  className="flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                  {cancelling ? 'Cancelling…' : 'Cancel booking'}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
