import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import { motion } from 'motion/react'
import { ArrowRight, BadgeCheck, CalendarDays, Hourglass, MapPin, Users, XCircle } from 'lucide-react'
import PayButton from '../components/PayButton'
import TripSafety from '../components/TripSafety'
import CancelBookingDialog from '../components/CancelBookingDialog'
import ReviewForm, { YourReview } from '../components/ReviewForm'
import { useAsync } from '../hooks/useAsync'
import { fetchBooking } from '../lib/bookings'
import { formatLongDate, todayISO } from '../lib/dates'
import { formatNaira } from '../lib/format'
import { ease, fadeUp, stagger } from '../lib/motion'
import { ListingCover } from '../components/ListingCard'
import { Alert } from '../components/AuthShell'
import NotFound from './NotFound'
import TypeWriter from '../components/TypeWriter'

// A check mark that draws itself, with a small burst of dots around it.
function ConfirmedMark() {
  return (
    <div className="relative mx-auto h-24 w-24 text-emerald-700">
      {Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-emerald-500"
            initial={{ x: '-50%', y: '-50%', opacity: 0, scale: 0 }}
            animate={{
              x: `calc(-50% + ${Math.cos(angle) * 64}px)`,
              y: `calc(-50% + ${Math.sin(angle) * 64}px)`,
              opacity: [0, 1, 0],
              scale: [0, 1, 0.5],
            }}
            transition={{ delay: 0.75, duration: 0.9, ease }}
          />
        )
      })}
      <svg viewBox="0 0 52 52" className="h-full w-full">
        <motion.circle
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease }}
        />
        <motion.path
          d="M15 27l7 7 15-15"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.5, duration: 0.4, ease }}
        />
      </svg>
    </div>
  )
}

function StatusIcon({ icon: Icon, tone }) {
  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      className={`mx-auto grid h-24 w-24 place-items-center rounded-full ${tone}`}
    >
      <Icon className="h-10 w-10" strokeWidth={1.5} />
    </motion.span>
  )
}

// What happened to the money when a booking was cancelled (see migration 015).
function cancelledText(booking) {
  const refund = formatNaira(booking.refund_amount ?? 0)
  if (booking.payment_status === 'refund_pending') {
    return `A refund of ${refund} is on its way to the card you paid with (usually 5–10 working days).`
  }
  if (booking.payment_status === 'refunded') return `${refund} was refunded to the card you paid with.`
  if (booking.refund_amount === 0) return 'This booking was non-refundable when you cancelled it, so no money was returned.'
  return 'This booking was cancelled before any payment, so nothing was charged. The dates are free again.'
}

function statusContent(booking) {
  const city = booking.listing?.city ?? 'your stay'
  switch (booking.status) {
    case 'confirmed':
      return {
        mark: <ConfirmedMark />,
        title: (
          <>
            You're going to <em className="text-emerald-800"><TypeWriter text={`${city}!`} /></em>
          </>
        ),
        text: 'Your stay is confirmed and these dates are now yours.',
      }
    case 'pending':
      return {
        mark: <StatusIcon icon={Hourglass} tone="bg-amber-100 text-amber-700" />,
        title: (
          <>
            Request <em className="text-emerald-800"><TypeWriter text="sent." /></em>
          </>
        ),
        text: "The host will review your request soon. We're holding your dates until they respond.",
      }
    case 'declined':
      return {
        mark: <StatusIcon icon={XCircle} tone="bg-stone-100 text-stone-500" />,
        title: 'Request declined',
        text: "The host couldn't accept this time, and the dates have been released. Try another stay?",
      }
    case 'cancelled':
      return {
        mark: <StatusIcon icon={XCircle} tone="bg-stone-100 text-stone-500" />,
        title: 'Booking cancelled',
        text: cancelledText(booking),
      }
    default:
      return {
        mark: <ConfirmedMark />,
        title: 'Stay completed',
        text: 'We hope you had a wonderful time.',
      }
  }
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800" strokeWidth={1.75} />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">{label}</p>
        <p className="font-medium text-stone-900">{value}</p>
      </div>
    </div>
  )
}

export default function BookingConfirmation() {
  const { id } = useParams()
  const { data: booking, loading, error, reload } = useAsync(() => fetchBooking(id), id)
  const [showCancel, setShowCancel] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  if (loading && !booking) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="shimmer mx-auto h-24 w-24 rounded-full" />
        <div className="shimmer mx-auto mt-8 h-10 w-2/3 rounded-full" />
        <div className="shimmer mt-12 h-72 rounded-3xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert>Could not load this booking: {error}</Alert>
      </div>
    )
  }

  if (!booking) return <NotFound />

  const { mark, title, text } = statusContent(booking)
  const canCancel = ['pending', 'confirmed'].includes(booking.status) && booking.check_in > todayISO()
  const reference = booking.id.slice(0, 8).toUpperCase()


  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6">
      <motion.div variants={stagger(0.1)} initial="hidden" animate="show" className="text-center">
        <motion.div variants={fadeUp}>{mark}</motion.div>
        <motion.h1
          variants={fadeUp}
          className="mt-8 font-display text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl"
        >
          {title}
        </motion.h1>
        <motion.p variants={fadeUp} className="mx-auto mt-3 max-w-lg text-stone-500">
          {text}
        </motion.p>
        <motion.p variants={fadeUp} className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
          Booking reference · {reference}
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8, ease }}
        className="mt-12 overflow-hidden rounded-3xl bg-white shadow-xl shadow-stone-900/5 ring-1 ring-stone-900/5 md:grid md:grid-cols-5"
      >
        <Link to={`/listings/${booking.listing_id}`} className="group relative block aspect-4/3 md:col-span-2 md:aspect-auto">
          {booking.listing && (
            <ListingCover listing={booking.listing} className="transition-transform duration-700 group-hover:scale-105" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <p className="font-display text-2xl leading-tight">{booking.listing?.title ?? 'Your stay'}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-white/80">
              <MapPin className="h-4 w-4" /> {booking.listing?.city}
            </p>
          </div>
        </Link>

        <div className="p-6 sm:p-8 md:col-span-3">
          <div className="grid gap-5 sm:grid-cols-2">
            <Detail icon={CalendarDays} label="Check in" value={formatLongDate(booking.check_in)} />
            <Detail icon={CalendarDays} label="Check out" value={formatLongDate(booking.check_out)} />
            <Detail
              icon={Users}
              label="Guests"
              value={`${booking.guests} ${booking.guests === 1 ? 'guest' : 'guests'}`}
            />
            <Detail
              icon={Hourglass}
              label="Length of stay"
              value={`${booking.nights} ${booking.nights === 1 ? 'night' : 'nights'}`}
            />
          </div>

          <div className="mt-8 space-y-2.5 border-t border-stone-100 pt-6 text-sm text-stone-600">
            <div className="flex justify-between">
              <span>
                {formatNaira(booking.price_per_night)} × {booking.nights} {booking.nights === 1 ? 'night' : 'nights'}
              </span>
              <span className="tabular-nums">{formatNaira(booking.price_per_night * booking.nights)}</span>
            </div>
            {booking.cleaning_fee > 0 && (
              <div className="flex justify-between">
                <span>Cleaning fee</span>
                <span className="tabular-nums">{formatNaira(booking.cleaning_fee)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Service fee</span>
              <span className="tabular-nums">{formatNaira(booking.service_fee)}</span>
            </div>
            <div className="flex justify-between border-t border-stone-100 pt-3 text-base font-semibold text-stone-900">
              <span>Total</span>
              <span className="tabular-nums">{formatNaira(booking.total)}</span>
            </div>
            <p className="pt-1 text-xs text-stone-400">
              {booking.payment_status === 'refund_pending'
                ? `Cancelled · refund of ${formatNaira(booking.refund_amount ?? 0)} on its way`
                : booking.payment_status === 'refunded'
                  ? `Cancelled · ${formatNaira(booking.refund_amount ?? 0)} refunded`
                  : booking.payment_status === 'paid'
                ? `Paid${booking.paid_at ? ` on ${formatLongDate(booking.paid_at.slice(0, 10))}` : ''} · Ref ${booking.payment_reference}`
                : booking.status === 'pending'
                  ? "You'll pay once the host accepts your request."
                  : booking.status === 'confirmed'
                    ? 'Payment due — pay securely below.'
                    : 'No payment was taken.'}
            </p>
          </div>
        </div>
      </motion.div>

      {booking.status === 'confirmed' && booking.payment_status !== 'paid' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6, ease }}
          className="mt-6 grid items-center gap-6 rounded-3xl bg-white p-6 shadow-xl shadow-emerald-950/5 ring-1 ring-emerald-800/15 sm:p-8 md:grid-cols-2"
        >
          <div>
            <h2 className="font-display text-2xl text-stone-900">Complete your payment</h2>
            <p className="mt-1 text-sm text-stone-500">
              Pay {formatNaira(booking.total)} to secure your stay. Payments go through Paystack and are checked by our
              server before your booking is marked as paid.
            </p>
          </div>
          <PayButton booking={booking} onPaid={reload} />
        </motion.div>
      )}

      {booking.payment_status === 'paid' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 flex items-center gap-4 rounded-3xl bg-emerald-50 p-5 ring-1 ring-emerald-200"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-800 text-white">
            <BadgeCheck className="h-6 w-6" />
          </span>
          <div className="text-sm">
            <p className="font-semibold text-emerald-900">Payment received — {formatNaira(booking.total)}</p>
            <p className="text-emerald-800/80">Reference {booking.payment_reference}. Keep this for your records.</p>
          </div>
        </motion.div>
      )}

      {['pending', 'confirmed'].includes(booking.status) && booking.check_out >= todayISO() && (
        <TripSafety booking={booking} />
      )}

      {booking.review ? (
        <YourReview review={booking.review} />
      ) : (
        ['confirmed', 'completed'].includes(booking.status) &&
        booking.check_out <= todayISO() && <ReviewForm booking={booking} onSubmitted={reload} />
      )}

      <div className="mt-8 flex flex-col-reverse items-center justify-between gap-4 sm:flex-row">
        {canCancel ? (
          <button
            onClick={() => setShowCancel(true)}
            className="text-sm font-semibold text-stone-500 underline underline-offset-4 transition hover:text-red-600"
          >
            Cancel booking
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          <Link
            to={`/listings/${booking.listing_id}`}
            className="rounded-full px-6 py-3 text-sm font-semibold text-stone-900 ring-1 ring-stone-300 transition hover:ring-stone-900"
          >
            View listing
          </Link>
          <Link
            to="/stays"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            Keep exploring <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <CancelBookingDialog
        booking={booking}
        open={showCancel}
        onClose={() => setShowCancel(false)}
        onCancelled={(q) => {
          toast.show({
            title: 'Booking cancelled',
            description: !q?.paid
              ? 'Nothing was charged.'
              : q.refund > 0
                ? `${formatNaira(q.refund)} will be refunded to your card within 5–10 working days.`
                : 'This booking was non-refundable, so no money is returned.',
          })
          navigate('/trips', { replace: true })
        }}
      />
    </div>
  )
}
