import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, BedDouble, Compass, MapPin, SearchX, UtensilsCrossed } from 'lucide-react'
import SearchBar from '../components/SearchBar'
import DiscoveryToggle from '../components/DiscoveryToggle'
import Reveal from '../components/Reveal'
import { ListingGrid } from '../components/ListingCard'
import { useListings } from '../hooks/useListings'
import { useAsync } from '../hooks/useAsync'
import { TOUR_CATEGORIES, fetchTours } from '../lib/tours'
import { CATEGORY_ICONS, TourGrid } from '../components/TourCard'
import { DESTINATIONS, PROPERTY_TYPES, propertyLabel } from '../lib/constants'
import { fadeUp, stagger } from '../lib/motion'
import TypeWriter from '../components/TypeWriter'

const sorters = {
  newest: () => 0, // already ordered newest-first by the query
  'price-asc': (a, b) => (a.price_per_night ?? 0) - (b.price_per_night ?? 0),
  'price-desc': (a, b) => (b.price_per_night ?? 0) - (a.price_per_night ?? 0),
}

const typeOptions = [{ value: '', label: 'All stays' }, ...PROPERTY_TYPES]

// Each discovery tab has its own heading.
const HEADINGS = {
  stays: {
    eyebrow: 'Explore stays',
    lead: 'Find your next',
    accent: 'stay.',
    sub: 'Apartments, guesthouses, hotel rooms and whole homes across Nigeria.',
  },
  tours: {
    eyebrow: 'Tours & experiences',
    lead: 'Discover local',
    accent: 'experiences.',
    sub: 'Food tours, hikes and cultural days led by guides who know their city.',
  },
  trips: {
    eyebrow: 'Combined trips',
    lead: 'Plan the',
    accent: 'whole trip.',
    sub: 'Your stay and your tours together, in one simple itinerary.',
  },
}

function headingFor(mode, city) {
  const base = HEADINGS[mode] ?? HEADINGS.stays
  if (!city) return base
  const noun = { stays: 'Stays', tours: 'Tours', trips: 'Trips' }[mode] ?? 'Stays'
  return { ...base, eyebrow: `Destination · ${base.eyebrow.replace('Explore ', '')}`, lead: `${noun} in`, accent: city }
}

const tripSteps = [
  { icon: BedDouble, day: 'Day 1', title: 'Check in to your stay', text: 'Your apartment in Calabar is ready.' },
  { icon: Compass, day: 'Day 2', title: 'Join a guided tour', text: 'A morning hike to Agbokim Waterfalls.' },
  { icon: UtensilsCrossed, day: 'Day 3', title: 'Food tour, then check out', text: 'Everything on one itinerary.' },
]

// Tours tab: real tours for the destination, filtered by category.
function ToursResults({ city }) {
  const [category, setCategory] = useState('')
  const { data, loading, error } = useAsync(() => fetchTours({ city, category }), `${city}|${category}`)
  const tours = data ?? []
  const options = [{ value: '', label: 'All tours' }, ...TOUR_CATEGORIES]

  return (
    <>
      <Reveal delay={0.2} className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
          {options.map((option) => {
            const active = category === option.value
            const Icon = CATEGORY_ICONS[option.value]
            return (
              <button
                key={option.value}
                onClick={() => setCategory(option.value)}
                className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'text-white' : 'bg-white text-stone-600 ring-1 ring-stone-900/5 hover:text-stone-900'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tour-pill"
                    className="absolute inset-0 rounded-full bg-emerald-800"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                {Icon && <Icon className="relative h-4 w-4" />}
                <span className="relative">{option.label}</span>
              </button>
            )
          })}
        </div>
        {!loading && (
          <p className="text-sm text-stone-500">
            <span className="font-semibold text-stone-900">{tours.length}</span> {tours.length === 1 ? 'tour' : 'tours'}
          </p>
        )}
      </Reveal>

      <div className="mt-10">
        <TourGrid tours={tours} loading={loading} error={error} skeletons={4} />
      </div>

      {!loading && !error && tours.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-white px-6 py-16 text-center ring-1 ring-stone-900/5"
        >
          <Compass className="mx-auto h-12 w-12 text-emerald-800" strokeWidth={1.5} />
          <h2 className="mt-5 font-display text-3xl tracking-tight text-stone-900">
            {city ? `No tours in ${city} yet` : 'No tours match that filter'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-stone-500">
            Local guides are joining every week. Know your city well? Share it with travellers.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/signup?role=guide"
              className="rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              Become a guide
            </Link>
            <Link
              to={city ? `/stays?city=${encodeURIComponent(city)}` : '/stays'}
              className="rounded-full px-6 py-3 text-sm font-semibold text-stone-900 ring-1 ring-stone-300 transition hover:ring-stone-900"
            >
              Browse stays{city ? ` in ${city}` : ''}
            </Link>
          </div>
        </motion.div>
      )}
    </>
  )
}

// Combined trips tab: a place to stay and things to do in the same city.
function CombinedTrip({ city }) {
  const stays = useListings({ city, limit: 4 })
  const tours = useAsync(() => fetchTours({ city, limit: 4 }), `trip|${city}`)
  const withCity = (mode) => {
    const params = new URLSearchParams()
    if (city) params.set('city', city)
    if (mode) params.set('mode', mode)
    return `/stays${params.size ? `?${params}` : ''}`
  }

  return (
    <div className="space-y-14">
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="grid gap-3 rounded-2xl bg-white p-5 ring-1 ring-stone-900/5 sm:grid-cols-3"
      >
        {tripSteps.map(({ icon: Icon, day, title, text }) => (
          <motion.div key={day} variants={fadeUp} className="flex items-center gap-4 rounded-xl bg-stone-50 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-white">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">{day}</p>
              <p className="text-sm font-semibold text-stone-900">{title}</p>
              <p className="text-xs text-stone-500">{text}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-3xl tracking-tight text-stone-900">
            1. Where to <em className="text-emerald-800">stay</em>
          </h2>
          <Link to={withCity('')} className="flex items-center gap-1 text-sm font-semibold text-emerald-800 hover:text-emerald-900">
            All stays <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6">
          <ListingGrid listings={stays.listings} loading={stays.loading} error={stays.error} skeletons={4} />
          {!stays.loading && !stays.listings.length && <p className="text-stone-500">No stays here yet.</p>}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-3xl tracking-tight text-stone-900">
            2. Things to <em className="text-emerald-800">do</em>
          </h2>
          <Link to={withCity('tours')} className="flex items-center gap-1 text-sm font-semibold text-emerald-800 hover:text-emerald-900">
            All tours <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6">
          <TourGrid tours={tours.data ?? []} loading={tours.loading} error={tours.error} skeletons={4} />
          {!tours.loading && !tours.data?.length && <p className="text-stone-500">No tours here yet.</p>}
        </div>
      </section>
    </div>
  )
}

// Zero results: explain why, offer one-click fixes and other places to try.
function EmptyState({ city, guests, type, onRemove }) {
  const otherCities = DESTINATIONS.filter((d) => d.city.toLowerCase() !== city.toLowerCase()).slice(0, 4)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white px-6 py-16 text-center ring-1 ring-stone-900/5 sm:px-12"
    >
      <motion.span
        animate={{ rotate: [0, -8, 8, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
        className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50"
      >
        <SearchX className="h-9 w-9 text-emerald-800" />
      </motion.span>
      <h2 className="mt-6 font-display text-3xl tracking-tight text-stone-900">
        {city ? `Nothing in ${city} just yet` : 'No stays match those filters'}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-stone-500">
        {city
          ? `We're still welcoming hosts in ${city}. Try loosening a filter, or explore somewhere nearby.`
          : 'Try loosening a filter or two — the right place might be one click away.'}
      </p>

      {(guests || type || city) && (
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {type && (
            <button
              onClick={() => onRemove('type')}
              className="rounded-full px-4 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-300 transition hover:ring-stone-900"
            >
              Show all types, not just {propertyLabel(type).toLowerCase()}s
            </button>
          )}
          {guests && (
            <button
              onClick={() => onRemove('guests')}
              className="rounded-full px-4 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-300 transition hover:ring-stone-900"
            >
              Remove the {guests}-guest filter
            </button>
          )}
          <Link
            to="/stays"
            className="rounded-full bg-emerald-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            Clear all filters
          </Link>
        </div>
      )}

      <div className="mx-auto mt-12 max-w-2xl border-t border-stone-100 pt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Or try another destination</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {otherCities.map(({ city: name, note }) => (
            <Link
              key={name}
              to={`/stays?city=${encodeURIComponent(name)}`}
              className="group rounded-xl bg-stone-50 p-4 text-left ring-1 ring-stone-900/5 transition hover:bg-emerald-50 hover:ring-emerald-800/20"
            >
              <MapPin className="h-4 w-4 text-emerald-800" />
              <p className="mt-2 text-sm font-semibold text-stone-900">{name}</p>
              <p className="text-xs text-stone-500">{note}</p>
            </Link>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export default function Stays() {
  const [searchParams, setSearchParams] = useSearchParams()
  const city = searchParams.get('city') ?? ''
  const guests = searchParams.get('guests') ?? ''
  const type = searchParams.get('type') ?? ''
  const mode = searchParams.get('mode') ?? 'stays'
  const heading = headingFor(mode, city)
  const [sort, setSort] = useState('newest')

  const { listings, loading, error } = useListings({ city, guests, type })
  const sorted = [...listings].sort(sorters[sort])

  // Pass the chosen dates and guests on to each listing's booking box.
  const carried = new URLSearchParams()
  for (const key of ['checkin', 'checkout', 'guests']) {
    if (searchParams.get(key)) carried.set(key, searchParams.get(key))
  }
  const bookingSearch = carried.size ? `?${carried}` : ''

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      {/* Hero card: heading, discovery tabs and search grouped together */}
      <Reveal className="relative z-20 rounded-3xl bg-white/70 px-4 py-8 text-center shadow-xl shadow-stone-900/5 ring-1 ring-stone-900/5 backdrop-blur-md sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div className="absolute -top-24 left-1/2 h-48 w-160 -translate-x-1/2 rounded-full bg-emerald-100/60 blur-3xl" />
        </div>
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-800">
            <TypeWriter text={heading.eyebrow} speed={40} delay={0} />
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl">
            {heading.lead} <em className="text-emerald-800"><TypeWriter text={heading.accent} /></em>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-stone-500">{heading.sub}</p>

          <div className="mt-6">
            <DiscoveryToggle value={mode} onChange={(value) => setParam('mode', value === 'stays' ? '' : value)} />
          </div>

          <div className="mx-auto mt-5 max-w-5xl text-left">
            {/* key= resets the form fields when the URL search changes */}
            <SearchBar key={searchParams.toString()} initial={Object.fromEntries(searchParams)} mode={mode} />
          </div>
        </div>
      </Reveal>

      {mode === 'tours' ? (
        <div className="mt-10">
          <ToursResults key={city} city={city} />
        </div>
      ) : mode === 'trips' ? (
        <div className="mt-10">
          <CombinedTrip city={city} />
        </div>
      ) : (
        <>
          <Reveal delay={0.2} className="mt-10 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
              {typeOptions.map((option) => {
                const active = type === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() => setParam('type', option.value)}
                    className={`relative shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                      active ? 'text-white' : 'bg-white text-stone-600 ring-1 ring-stone-900/5 hover:text-stone-900'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="type-pill"
                        className="absolute inset-0 rounded-full bg-emerald-800"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className="relative">{option.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between gap-4 lg:justify-end">
              {loading ? (
                <span className="shimmer h-4 w-24 rounded-full" aria-label="Loading results" />
              ) : (
                <p className="text-sm text-stone-500">
                  <span className="font-semibold text-stone-900">{listings.length}</span>{' '}
                  {listings.length === 1 ? 'place' : 'places'}
                  {guests ? ` for ${guests}+ guests` : ''}
                </p>
              )}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-stone-900 ring-1 ring-stone-900/10 outline-none"
                aria-label="Sort stays"
              >
                <option value="newest">Newest first</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
            </div>
          </Reveal>

          <div className="mt-10">
            <ListingGrid listings={sorted} loading={loading} error={error} search={bookingSearch} />
          </div>

          {!loading && !error && listings.length === 0 && (
            <EmptyState city={city} guests={guests} type={type} onRemove={(key) => setParam(key, '')} />
          )}
        </>
      )}
    </div>
  )
}
