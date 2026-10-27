import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, BedDouble, CalendarX, Clock, Grid2x2, Home, MapPin, ScrollText, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { useListings } from '../hooks/useListings'
import { fetchListing } from '../lib/listings'
import { AMENITIES, CANCELLATION_NOTE, HOUSE_RULES, INDOOR_CAMERAS, SAFETY_FEATURES, cancellationPolicy, propertyLabel } from '../lib/constants'
import { formatTime } from '../lib/dates'
import { ease, fadeUp, stagger } from '../lib/motion'
import { ListingCover, ListingGrid, Rating, TrustBadges } from '../components/ListingCard'
import Lightbox from '../components/Lightbox'
import BookingWidget from '../components/BookingWidget'
import Reveal from '../components/Reveal'
import SaveButton from '../components/SaveButton'
import ShareButton from '../components/ShareButton'
import NotFound from './NotFound'
import TypeWriter from '../components/TypeWriter'
import ListingReviews from '../components/ListingReviews'
import ReportButton from '../components/ReportButton'

function AmenitiesSection({ listing }) {
  const offered = AMENITIES.filter((a) => listing.amenities?.includes(a.value))
  if (!offered.length) return null

  return (
    <Reveal className="mt-12 border-t border-black/5 pt-10">
      <h2 className="font-display text-2xl text-ink">What this place offers</h2>
      <div className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {offered.map(({ value, label, icon: Icon }) => (
          <div key={value} className="flex items-center gap-3 text-stone-700">
            <Icon className="h-5 w-5 shrink-0 text-emerald-800" strokeWidth={1.75} />
            {label}
          </div>
        ))}
      </div>
    </Reveal>
  )
}

// What the host says the place has for safety, plus a clear notice if there
// are cameras inside.
function SafetySection({ listing }) {
  const declared = listing.safety_features ?? []
  const offered = SAFETY_FEATURES.filter((f) => declared.includes(f.value))
  const missing = SAFETY_FEATURES.filter((f) => ['smoke_alarm', 'first_aid'].includes(f.value) && !declared.includes(f.value))
  const indoorCameras = declared.includes(INDOOR_CAMERAS.value)

  return (
    <Reveal className="mt-12 border-t border-black/5 pt-10">
      <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
        <ShieldCheck className="h-6 w-6 text-emerald-700" /> Safety
      </h2>
      {offered.length ? (
        <div className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {offered.map(({ value, label, icon: Icon }) => (
            <div key={value} className="flex items-center gap-3 text-stone-700">
              <Icon className="h-5 w-5 shrink-0 text-emerald-800" strokeWidth={1.75} />
              {label}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-stone-500">The host hasn’t listed any safety features yet. Ask them before you book.</p>
      )}
      {offered.length > 0 && missing.length > 0 && (
        <p className="mt-4 text-sm text-stone-500">Not listed: {missing.map((f) => f.label.toLowerCase()).join(', ')}.</p>
      )}
      {indoorCameras && (
        <p className="mt-5 flex items-start gap-2.5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <INDOOR_CAMERAS.icon className="mt-0.5 h-4 w-4 shrink-0" />
          The host says there are cameras inside the home (never in bedrooms or bathrooms).
        </p>
      )}
      <Link to="/safety" className="mt-5 inline-block text-sm font-semibold text-emerald-800 underline-offset-4 hover:underline">
        Read our safety tips
      </Link>
    </Reveal>
  )
}

function ThingsToKnow({ listing }) {
  const rules = HOUSE_RULES.filter((r) => listing.house_rules?.includes(r.value))
  const policy = cancellationPolicy(listing.cancellation_policy)

  return (
    <Reveal className="mt-12 border-t border-black/5 pt-10">
      <h2 className="font-display text-2xl text-ink">Things to know</h2>
      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-stone-900">
            <ScrollText className="h-4 w-4 text-emerald-800" /> House rules
          </h3>
          <ul className="mt-3 space-y-2.5 text-sm text-stone-600">
            <li className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-stone-400" /> Check-in after {formatTime(listing.check_in_time || '14:00')}
            </li>
            <li className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-stone-400" /> Check-out before {formatTime(listing.check_out_time || '11:00')}
            </li>
            {rules.map(({ value, label, icon: Icon }) => (
              <li key={value} className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-stone-400" /> {label}
              </li>
            ))}
          </ul>
          {listing.extra_rules && (
            <p className="mt-3 whitespace-pre-line rounded-xl bg-stone-100/70 p-3 text-sm text-stone-600">
              {listing.extra_rules}
            </p>
          )}
        </div>
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-stone-900">
            <CalendarX className="h-4 w-4 text-emerald-800" /> Cancellation policy
          </h3>
          <p className="mt-3 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {policy.label}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{policy.text}</p>
        </div>
      </div>
    </Reveal>
  )
}

// Up to four other active stays in the same city.
function SimilarStays({ listing }) {
  const { listings, loading } = useListings({ city: listing.city, limit: 5 })
  const others = listings.filter((l) => l.id !== listing.id).slice(0, 4)
  if (!loading && !others.length) return null

  return (
    <section className="mt-20 border-t border-black/5 pt-12">
      <Reveal>
        <h2 className="font-display text-3xl tracking-tight text-ink">
          More stays in <em className="text-emerald-800">{listing.city}</em>
        </h2>
      </Reveal>
      <div className="mt-8">
        <ListingGrid listings={others} loading={loading} skeletons={4} />
      </div>
    </section>
  )
}

// Big cover photo on the left, up to four smaller photos on the right.
// Clicking any photo opens the full-screen viewer.
function Gallery({ listing, onOpen }) {
  const photos = listing.photos ?? []

  if (photos.length <= 1) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease }}
        onClick={() => photos.length && onOpen(0)}
        className="block aspect-video w-full overflow-hidden rounded-4xl md:aspect-21/9"
      >
        <ListingCover listing={listing} />
      </motion.button>
    )
  }

  const tiles = photos.slice(0, 5)
  return (
    <div className="relative">
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="grid h-80 gap-2 overflow-hidden rounded-4xl md:h-120 md:grid-cols-4 md:grid-rows-2"
      >
        {tiles.map((photo, i) => (
          <motion.button
            key={photo}
            variants={fadeUp}
            onClick={() => onOpen(i)}
            className={`group relative overflow-hidden ${i === 0 ? 'md:col-span-2 md:row-span-2' : 'hidden md:block'}`}
          >
            <ListingCover
              listing={listing}
              photo={photo}
              className="transition-transform duration-700 ease-out group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/15" />
          </motion.button>
        ))}
      </motion.div>
      <button
        onClick={() => onOpen(0)}
        className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-lg transition hover:scale-105"
      >
        <Grid2x2 className="h-4 w-4" /> Show all {photos.length} photos
      </button>
    </div>
  )
}

function Fact({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
      <Icon className="h-6 w-6 text-emerald-600" strokeWidth={1.5} />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-stone-400">{label}</p>
      <p className="mt-0.5 font-semibold text-ink">{value}</p>
    </div>
  )
}

export default function ListingDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams() // dates and guests carried over from search
  const { user } = useAuth()
  const { data: listing, loading, error } = useAsync(() => fetchListing(id), id)
  const [photoIndex, setPhotoIndex] = useState(null)

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="shimmer h-5 w-32 rounded-full" />
        <div className="shimmer mt-6 h-80 rounded-4xl md:h-120" />
        <div className="shimmer mt-10 h-10 w-1/2 rounded-full" />
        <div className="shimmer mt-4 h-5 w-1/4 rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Could not load this listing: {error}
        </div>
      </div>
    )
  }

  if (!listing) return <NotFound />

  const isOwner = user?.id === listing.host_id
  const bedrooms = `${listing.bedrooms} ${listing.bedrooms === 1 ? 'bedroom' : 'bedrooms'}`

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/stays"
          className="group inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Back to stays
        </Link>
        <div className="flex items-center gap-2">
          {!isOwner && <ReportButton targetType="listing" targetId={listing.id} className="mr-2" />}
          <ShareButton title={listing.title} />
          <SaveButton listingId={listing.id} variant="pill" />
        </div>
      </div>

      {isOwner && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex flex-col justify-between gap-3 rounded-2xl bg-emerald-50 px-5 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200 sm:flex-row sm:items-center"
        >
          <span>
            This is your listing{listing.status === 'paused' ? ' — it is paused and hidden from search.' : '.'}
          </span>
          <Link to="/host/listings" className="font-semibold underline underline-offset-4">
            Manage my listings
          </Link>
        </motion.div>
      )}

      <div className="mt-6">
        <Gallery listing={listing} onOpen={setPhotoIndex} />
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <motion.div variants={stagger(0.08, 0.2)} initial="hidden" animate="show">
            <motion.p variants={fadeUp} className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
              {propertyLabel(listing.property_type)}
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="mt-3 font-display text-4xl font-medium leading-tight tracking-tight text-ink sm:text-5xl"
            >
              <TypeWriter text={listing.title} speed={28} />
            </motion.h1>
            <motion.div variants={fadeUp} className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-stone-500">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {listing.city}, Nigeria
              </span>
              <Rating listing={listing} />
              <TrustBadges listing={listing} className="[&>span]:bg-stone-100 [&>span]:shadow-none" />
            </motion.div>
          </motion.div>

          <Reveal delay={0.1} className="mt-10 grid grid-cols-3 gap-3">
            <Fact icon={Users} label="Guests" value={`Up to ${listing.max_guests}`} />
            <Fact icon={BedDouble} label="Bedrooms" value={bedrooms} />
            <Fact icon={Home} label="Type" value={propertyLabel(listing.property_type)} />
          </Reveal>

          <Reveal className="mt-12 border-t border-black/5 pt-10">
            <h2 className="font-display text-2xl text-ink">About this place</h2>
            <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-stone-600">
              {listing.description || 'The host has not added a description yet.'}
            </p>
          </Reveal>

          <AmenitiesSection listing={listing} />
          <SafetySection listing={listing} />
          <ThingsToKnow listing={listing} />
          <ListingReviews listing={listing} isOwner={isOwner} />
        </div>

        <aside>
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease }}
            className="sticky top-24 z-10"
          >
            <BookingWidget listing={listing} initial={Object.fromEntries(searchParams)} />
          </motion.div>
        </aside>
      </div>

      <SimilarStays listing={listing} />

      <Lightbox
        photos={listing.photos ?? []}
        index={photoIndex}
        onClose={() => setPhotoIndex(null)}
        onChange={setPhotoIndex}
      />
    </div>
  )
}
