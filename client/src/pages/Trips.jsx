import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, CalendarDays, Clock, Compass, Luggage, MapPin, Star, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { fetchMyTrips } from '../lib/bookings'
import { cancelTourBooking, fetchMyTourBookings } from '../lib/tours'
import { formatLongDate, formatShortDate, formatTime, todayISO } from '../lib/dates'
import { formatNaira } from '../lib/format'
import { ease, fadeUp, stagger } from '../lib/motion'
import { ListingCover } from '../components/ListingCard'
import StarRating from '../components/StarRating'
import { Alert } from '../components/AuthShell'
import TypeWriter from '../components/TypeWriter'

const TABS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'tours', label: 'Tours' },
]

const TOUR_STATUS = {
  pending: { label: 'Awaiting guide', className: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Completed', className: 'bg-stone-100 text-stone-700' },
  declined: { label: 'Declined', className: 'bg-stone-100 text-stone-600' },
  cancelled: { label: 'Cancelled', className: 'bg-stone-100 text-stone-600' },
}

function TourBookingCard({ booking, onCancel, busy }) {
  const tour = booking.tour ?? { id: booking.tour_id, title: 'Tour no longer available', city: '' }
  const past = booking.tour_date < todayISO()
  const status = past && booking.status === 'confirmed' ? TOUR_STATUS.completed : TOUR_STATUS[booking.status]
  const canCancel = !past && ['pending', 'confirmed'].includes(booking.status)

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-900/5 sm:flex-row">
      <Link to={`/tours/${tour.id}`} className="relative aspect-video shrink-0 overflow-hidden sm:aspect-auto sm:w-56">
        <ListingCover listing={tour} className="transition-transform duration-700 hover:scale-105" />
      </Link>
      <div className="flex flex-1 flex-col justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link to={`/tours/${tour.id}`} className="font-semibold tracking-tight text-stone-900 hover:underline">
              {tour.title}
            </Link>
            {tour.city && (
              <p className="mt-1 flex items-center gap-1 text-sm text-stone-500">
                <MapPin className="h-3.5 w-3.5" /> {tour.city}
                {tour.meeting_point && booking.status === 'confirmed' && ` · Meet at ${tour.meeting_point}`}
              </p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-600">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-emerald-800" /> {formatLongDate(booking.tour_date)}
          </span>
          {tour.start_time && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-emerald-800" /> {formatTime(tour.start_time)}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-emerald-800" /> {booking.people} {booking.people === 1 ? 'person' : 'people'}
          </span>
          <span className="ml-auto font-semibold text-stone-900">{formatNaira(booking.total)}</span>
        </div>
        {canCancel && (
          <button
            disabled={busy}
            onClick={() => onCancel(booking)}
            className="w-fit rounded-full px-4 py-2 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 transition hover:ring-stone-900 disabled:opacity-50"
          >
            Cancel booking
          </button>
        )}
      </div>
    </div>
  )
}

const STATUS_STYLES = {
  pending: { label: 'Awaiting host', className: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Completed', className: 'bg-stone-100 text-stone-700' },
  declined: { label: 'Declined', className: 'bg-stone-100 text-stone-600' },
  cancelled: { label: 'Cancelled', className: 'bg-stone-100 text-stone-600' },
}

function groupTrips(trips) {
  const today = todayISO()
  const ended = (t) => ['cancelled', 'declined'].includes(t.status)
  return {
    upcoming: trips.filter((t) => !ended(t) && t.check_out >= today).reverse(), // soonest first
    past: trips.filter((t) => !ended(t) && t.check_out < today),
    cancelled: trips.filter(ended),
  }
}

function TripCard({ trip, isPast }) {
  const status = isPast && trip.status === 'confirmed' ? STATUS_STYLES.completed : STATUS_STYLES[trip.status]
  const listing = trip.listing ?? { id: trip.listing_id, title: 'Listing no longer available', city: '' }

  return (
    <Link
      to={`/trips/${trip.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-900/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-stone-900/10 sm:flex-row"
    >
      <div className="relative aspect-video shrink-0 overflow-hidden sm:aspect-auto sm:w-56">
        <ListingCover listing={listing} className="transition-transform duration-700 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-5 sm:p-6">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold tracking-tight text-stone-900">{listing.title}</h3>
            <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
              {trip.status === 'confirmed' && !isPast && (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    trip.payment_status === 'paid' ? 'bg-emerald-800 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {trip.payment_status === 'paid' ? 'Paid' : 'Payment due'}
                </span>
              )}
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
            </span>
          </div>
          {listing.city && (
            <p className="mt-1 flex items-center gap-1 text-sm text-stone-500">
              <MapPin className="h-3.5 w-3.5" /> {listing.city}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-600">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-emerald-800" />
            {formatShortDate(trip.check_in)} – {formatShortDate(trip.check_out)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-emerald-800" />
            {trip.guests} {trip.guests === 1 ? 'guest' : 'guests'}
          </span>
          <span className="ml-auto font-semibold text-stone-900">{formatNaira(trip.total)}</span>
        </div>
        {trip.status === 'confirmed' && trip.payment_status !== 'paid' && !isPast && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-emerald-900">
            Pay now <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        )}
        {isPast && ['confirmed', 'completed'].includes(trip.status) &&
          (trip.review ? (
            <span className="flex items-center gap-2 text-sm text-stone-500">
              <StarRating value={trip.review.rating} size="h-4 w-4" /> You reviewed this stay
            </span>
          ) : (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 transition group-hover:bg-amber-300">
              <Star className="h-4 w-4 fill-current" /> Leave a review
            </span>
          ))}
      </div>
    </Link>
  )
}

function EmptyTab({ tab }) {
  const copy = {
    upcoming: { title: 'No trips booked… yet', text: 'Time to dust off your bags and plan your next escape.' },
    past: { title: 'No past trips', text: 'Your completed stays will appear here.' },
    cancelled: { title: 'Nothing cancelled', text: 'Cancelled or declined bookings would show up here.' },
    tours: { title: 'No tours booked yet', text: 'Food walks, hikes and cultural days, led by local guides.' },
  }[tab]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-dashed border-stone-300 bg-white/60 px-6 py-16 text-center"
    >
      <motion.span
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-800"
      >
        {tab === 'tours' ? <Compass className="h-8 w-8" strokeWidth={1.5} /> : <Luggage className="h-8 w-8" strokeWidth={1.5} />}
      </motion.span>
      <h2 className="mt-6 font-display text-2xl text-stone-900">{copy.title}</h2>
      <p className="mt-2 text-stone-500">{copy.text}</p>
      {tab === 'tours' && (
        <Link
          to="/stays?mode=tours"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
        >
          Explore tours <ArrowRight className="h-4 w-4" />
        </Link>
      )}
      {tab === 'upcoming' && (
        <Link
          to="/stays"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
        >
          Find a stay <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </motion.div>
  )
}

export default function Trips() {
  const { user } = useAuth()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const { data: trips, loading, error } = useAsync(() => fetchMyTrips(user.id), user.id)
  const tourBookings = useAsync(() => fetchMyTourBookings(user.id), user.id)
  const [tab, setTab] = useState(TABS.some((t) => t.value === searchParams.get('tab')) ? searchParams.get('tab') : 'upcoming')
  const [busy, setBusy] = useState(null)
  const groups = { ...groupTrips(trips ?? []), tours: tourBookings.data ?? [] }
  const shown = groups[tab]

  async function cancelTour(booking) {
    if (!window.confirm('Cancel this tour booking? No payment was taken for it, so cancelling is free.')) return
    setBusy(booking.id)
    try {
      await cancelTourBooking(booking.id)
      toast.show({ title: 'Tour booking cancelled', description: 'Your places have been released.' })
      tourBookings.reload()
    } catch (err) {
      toast.show({ type: 'error', title: 'Could not cancel', description: err.message })
    }
    setBusy(null)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <motion.div variants={stagger(0.08)} initial="hidden" animate="show">
        <motion.p variants={fadeUp} className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-800">
          Your travels
        </motion.p>
        <motion.h1 variants={fadeUp} className="mt-2 font-display text-5xl font-medium tracking-tight text-stone-900">
          My <em className="text-emerald-800"><TypeWriter text="trips." /></em>
        </motion.h1>
        <motion.p variants={fadeUp} className="mt-2 text-stone-500">
          Every stay you've booked, all in one place.
        </motion.p>
      </motion.div>

      <div className="mt-8 inline-flex rounded-full bg-stone-200/70 p-1" role="tablist">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              tab === value ? 'text-stone-900' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {tab === value && (
              <motion.span
                layoutId="trips-tab"
                className="absolute inset-0 rounded-full bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">
              {label}
              {trips && groups[value].length > 0 && (
                <span className="ml-1.5 text-stone-400">{groups[value].length}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-8">
        {error && <Alert>Could not load your trips: {error}</Alert>}

        {loading && !trips ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="shimmer h-40 rounded-2xl" />
            ))}
          </div>
        ) : (
          trips && (
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease }}
                className="space-y-4"
              >
                {shown.length === 0 ? (
                  <EmptyTab tab={tab} />
                ) : tab === 'tours' ? (
                  shown.map((b) => <TourBookingCard key={b.id} booking={b} onCancel={cancelTour} busy={busy === b.id} />)
                ) : (
                  shown.map((trip) => <TripCard key={trip.id} trip={trip} isPast={tab === 'past'} />)
                )}
              </motion.div>
            </AnimatePresence>
          )
        )}
      </div>
    </div>
  )
}
