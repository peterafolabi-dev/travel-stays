import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BedDouble,
  CalendarDays,
  Compass,
  Flag,
  Heart,
  Inbox,
  LayoutDashboard,
  Luggage,
  MapPin,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSaved } from '../context/SavedContext'
import { usePresence } from '../context/PresenceContext'
import { useAsync } from '../hooks/useAsync'
import { fetchHostBookings, fetchMyTrips } from '../lib/bookings'
import { fetchHostListings } from '../lib/listings'
import { fetchGuideTourBookings, fetchGuideTours, fetchMyTourBookings } from '../lib/tours'
import { fetchAdminStats } from '../lib/admin'
import { formatLongDate, nightsBetween, todayISO } from '../lib/dates'
import { initials } from '../lib/format'
import { fadeUp, stagger } from '../lib/motion'
import { ListingCover } from './ListingCard'
import SearchBar from './SearchBar'
import DiscoveryToggle from './DiscoveryToggle'
import TypeWriter from './TypeWriter'

const ROLE_LABELS = { traveler: 'Traveller', host: 'Host', guide: 'Tour guide', admin: 'Admin' }

const POPULAR_CITIES = ['Lagos', 'Abuja', 'Calabar', 'Port Harcourt', 'Ibadan']

const SUBTITLES = {
  traveler: 'Where to next? Pick up where you left off, or find somewhere new.',
  host: 'Here’s what’s happening with your places today.',
  guide: 'Here’s what’s happening with your tours today.',
  admin: 'A quick look at the platform. The full picture is on your dashboard.',
}

// Big app-style shortcuts, different for each role.
const TILES = {
  traveler: [
    { to: '/stays', icon: BedDouble, label: 'Find a stay', tone: 'bg-emerald-800 text-white' },
    { to: '/stays?mode=tours', icon: Compass, label: 'Book a tour', tone: 'bg-sky-50 text-sky-900' },
    { to: '/trips', icon: Luggage, label: 'My trips', tone: 'bg-amber-50 text-amber-900' },
    { to: '/saved', icon: Heart, label: 'Saved', tone: 'bg-rose-50 text-rose-900' },
  ],
  host: [
    { to: '/host/listings', icon: LayoutDashboard, label: 'My listings', tone: 'bg-emerald-800 text-white' },
    { to: '/host/listings/new', icon: Plus, label: 'List a place', tone: 'bg-sky-50 text-sky-900' },
    { to: '/profile', icon: UserRound, label: 'My profile', tone: 'bg-amber-50 text-amber-900' },
    { to: '/stays', icon: BedDouble, label: 'Browse stays', tone: 'bg-rose-50 text-rose-900' },
  ],
  guide: [
    { to: '/guide/tours', icon: LayoutDashboard, label: 'My tours', tone: 'bg-emerald-800 text-white' },
    { to: '/guide/tours/new', icon: Plus, label: 'Create a tour', tone: 'bg-sky-50 text-sky-900' },
    { to: '/profile', icon: UserRound, label: 'My profile', tone: 'bg-amber-50 text-amber-900' },
    { to: '/stays?mode=tours', icon: Compass, label: 'Browse tours', tone: 'bg-rose-50 text-rose-900' },
  ],
  admin: [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', tone: 'bg-emerald-800 text-white' },
    { to: '/stays', icon: BedDouble, label: 'Stays', tone: 'bg-sky-50 text-sky-900' },
    { to: '/stays?mode=tours', icon: Compass, label: 'Tours', tone: 'bg-amber-50 text-amber-900' },
    { to: '/safety', icon: ShieldCheck, label: 'Safety page', tone: 'bg-rose-50 text-rose-900' },
  ],
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// "today", "tomorrow", "in 5 days"
function whenLabel(isoDate) {
  const days = nightsBetween(todayISO(), isoDate)
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

const activeStatus = (s) => s === 'pending' || s === 'confirmed'

// ---------------------------------------------------------------- building blocks

function Stat({ icon: Icon, label, value, to, tone = 'emerald' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800',
    sky: 'bg-sky-50 text-sky-800',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <motion.div variants={fadeUp}>
      <Link
        to={to}
        className="flex items-center gap-4 rounded-2xl bg-white p-5 ring-1 ring-stone-900/5 transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span>
          <span className="block font-display text-3xl leading-none text-stone-900">{value ?? '—'}</span>
          <span className="mt-1 block text-sm text-stone-500">{label}</span>
        </span>
      </Link>
    </motion.div>
  )
}

// A big card for the next trip / next guest / next departure.
function Spotlight({ eyebrow, title, subtitle, place, date, to, cta, empty }) {
  if (!place) {
    return (
      <motion.div
        variants={fadeUp}
        className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-300 bg-white/60 p-10 text-center lg:col-span-2"
      >
        <p className="font-display text-2xl text-stone-900">{empty.title}</p>
        <p className="mt-1 text-stone-500">{empty.text}</p>
        <Link
          to={empty.to}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
        >
          {empty.cta} <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.div variants={fadeUp} className="lg:col-span-2">
      <Link
        to={to}
        className="group grid h-full overflow-hidden rounded-3xl bg-white ring-1 ring-stone-900/5 transition hover:shadow-xl sm:grid-cols-5"
      >
        <div className="relative aspect-video sm:col-span-2 sm:aspect-auto">
          <ListingCover listing={place} className="transition-transform duration-700 group-hover:scale-105" />
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-900">
            {whenLabel(date)}
          </span>
        </div>
        <div className="flex flex-col justify-between gap-4 p-6 sm:col-span-3 sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">{eyebrow}</p>
            <h3 className="mt-2 font-display text-3xl leading-tight text-stone-900">{title}</h3>
            {subtitle && <p className="mt-1 text-stone-500">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-600">
            {place.city && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-emerald-800" /> {place.city}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-emerald-800" /> {formatLongDate(date)}
            </span>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-emerald-800">
            {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

function VerifyNudge({ role }) {
  return (
    <motion.div
      variants={fadeUp}
      className="mb-5 flex flex-col items-start justify-between gap-4 rounded-2xl bg-emerald-900 p-6 text-white sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-4">
        <ShieldCheck className="mt-0.5 h-7 w-7 shrink-0 text-emerald-300" />
        <div>
          <p className="font-semibold">Get the Verified badge</p>
          <p className="text-sm text-emerald-50/80">
            Travellers book verified {role === 'guide' ? 'guides' : 'hosts'} more often. It takes two photos.
          </p>
        </div>
      </div>
      <Link
        to="/profile"
        className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50"
      >
        Verify my ID
      </Link>
    </motion.div>
  )
}

// ---------------------------------------------------------------- one panel per role

function TravellerPanel({ userId }) {
  const saved = useSaved()
  const trips = useAsync(() => fetchMyTrips(userId), `trips:${userId}`)
  const tours = useAsync(() => fetchMyTourBookings(userId), `tours:${userId}`)
  const today = todayISO()

  const upcoming = (trips.data ?? [])
    .filter((t) => activeStatus(t.status) && t.check_out >= today)
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
  const next = upcoming[0]
  const upcomingTours = (tours.data ?? []).filter((b) => activeStatus(b.status) && b.tour_date >= today)

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Spotlight
        eyebrow={next?.status === 'pending' ? 'Next trip · awaiting host' : 'Your next trip'}
        title={next?.listing?.title}
        subtitle={next ? `${next.guests} ${next.guests === 1 ? 'guest' : 'guests'}` : null}
        place={next?.listing}
        date={next?.check_in}
        to={next ? `/trips/${next.id}` : '/trips'}
        cta={next?.status === 'confirmed' && next.payment_status !== 'paid' ? 'Pay now' : 'View trip'}
        empty={{ title: 'No trips planned yet', text: 'Your next adventure is a search away.', to: '/stays', cta: 'Find a stay' }}
      />
      <div className="grid gap-5">
        <Stat icon={Heart} label="Saved stays" value={saved?.count} to="/saved" tone="red" />
        <Stat icon={Compass} label="Upcoming tours" value={upcomingTours.length} to="/trips?tab=tours" tone="sky" />
        <Stat icon={Luggage} label="Upcoming stays" value={upcoming.length} to="/trips" />
      </div>
    </div>
  )
}

function HostPanel({ user }) {
  const bookings = useAsync(() => fetchHostBookings(user.id), `host-bookings:${user.id}`)
  const listings = useAsync(() => fetchHostListings(user.id), `host-listings:${user.id}`)
  const today = todayISO()

  const all = bookings.data ?? []
  const requests = all.filter((b) => b.status === 'pending' && b.check_out >= today)
  const arriving = all.filter((b) => b.status === 'confirmed' && b.check_in >= today)
  const next = arriving[0] // already ordered by check-in
  const live = (listings.data ?? []).filter((l) => l.status === 'active').length

  return (
    <>
      {!user.verified && <VerifyNudge role="host" />}
      <div className="grid gap-5 lg:grid-cols-3">
        <Spotlight
          eyebrow="Next arrival"
          title={next?.guest_name}
          subtitle={next?.listing?.title}
          place={next?.listing}
          date={next?.check_in}
          to="/host/listings"
          cta="Open my listings"
          empty={{ title: 'No guests arriving yet', text: 'Confirmed bookings will show up here.', to: '/host/listings', cta: 'Manage listings' }}
        />
        <div className="grid gap-5">
          <Stat icon={Inbox} label="Requests waiting" value={requests.length} to="/host/listings" tone="amber" />
          <Stat icon={BedDouble} label="Live listings" value={live} to="/host/listings" />
          <Stat icon={Users} label="Guests coming" value={arriving.length} to="/host/listings" tone="sky" />
        </div>
      </div>
    </>
  )
}

function GuidePanel({ user }) {
  const bookings = useAsync(() => fetchGuideTourBookings(user.id), `guide-bookings:${user.id}`)
  const tours = useAsync(() => fetchGuideTours(user.id), `guide-tours:${user.id}`)
  const today = todayISO()

  const all = bookings.data ?? []
  const requests = all.filter((b) => b.status === 'pending' && b.tour_date >= today)
  const departures = all.filter((b) => b.status === 'confirmed' && b.tour_date >= today)
  const next = departures[0] // ordered by date
  const guests = departures.reduce((n, b) => n + b.people, 0)
  const live = (tours.data ?? []).filter((t) => t.status === 'active').length

  return (
    <>
      {!user.verified && <VerifyNudge role="guide" />}
      <div className="grid gap-5 lg:grid-cols-3">
        <Spotlight
          eyebrow="Next departure"
          title={next?.tour?.title}
          subtitle={next ? `${next.people} ${next.people === 1 ? 'person' : 'people'} booked` : null}
          place={next?.tour}
          date={next?.tour_date}
          to="/guide/tours"
          cta="Open my tours"
          empty={{ title: 'No departures yet', text: 'Confirmed tour bookings will show up here.', to: '/guide/tours', cta: 'Manage tours' }}
        />
        <div className="grid gap-5">
          <Stat icon={Inbox} label="Requests waiting" value={requests.length} to="/guide/tours" tone="amber" />
          <Stat icon={Compass} label="Live tours" value={live} to="/guide/tours" />
          <Stat icon={Users} label="Guests coming" value={guests} to="/guide/tours" tone="sky" />
        </div>
      </div>
    </>
  )
}

function AdminPanel() {
  const { online } = usePresence()
  const { data: s } = useAsync(fetchAdminStats, 'home-admin-stats')

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <Stat icon={Activity} label="Online now" value={online.length} to="/admin" />
      <Stat icon={Users} label="Total users" value={s?.users} to="/admin" tone="sky" />
      <Stat icon={Flag} label="Open reports" value={s?.open_reports} to="/admin" tone="red" />
      <Stat icon={BadgeCheck} label="IDs to review" value={s?.pending_verifications} to="/admin" tone="amber" />
    </div>
  )
}

// ---------------------------------------------------------------- the page

// What logged-in people see instead of the marketing landing page: a light,
// app-style dashboard with a greeting, shortcuts and a snapshot for their role.
export default function MemberHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const firstName = user.fullName.split(' ')[0]
  const role = user.role in SUBTITLES ? user.role : 'traveler'
  const today = new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="bg-sand">
      <motion.div
        variants={stagger(0.06)}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-7xl px-4 pb-6 pt-8 sm:px-6 lg:px-8"
      >
        {/* Greeting + profile card */}
        <div className="grid gap-6 lg:grid-cols-3 lg:items-end">
          <motion.div variants={fadeUp} className="lg:col-span-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-400">{today}</p>
            <h1 className="mt-2 font-display text-5xl font-medium leading-tight tracking-tight text-stone-900 sm:text-6xl">
              {greeting()}
              {firstName ? ', ' : ''}
              <em className="text-emerald-800"><TypeWriter text={firstName ? `${firstName}.` : '.'} /></em>
            </h1>
            <p className="mt-2 max-w-xl text-lg text-stone-500">{SUBTITLES[role]}</p>
          </motion.div>

          <motion.div variants={fadeUp}>
            <Link
              to="/profile"
              className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-stone-900/5 transition hover:shadow-md"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-linear-to-br from-emerald-600 to-teal-700 font-display text-xl text-white">
                {initials(user.fullName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-stone-900">{user.fullName || 'Your profile'}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-stone-500">
                  {ROLE_LABELS[role]}
                  {user.verified ? (
                    <span className="flex items-center gap-1 font-semibold text-emerald-700">
                      · <ShieldCheck className="h-3.5 w-3.5" /> Verified
                    </span>
                  ) : (
                    ['host', 'guide'].includes(role) && <span className="text-amber-700">· Not verified yet</span>
                  )}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-stone-400" />
            </Link>
          </motion.div>
        </div>

        {/* Search: stays, tours or a combined trip */}
        <motion.div variants={fadeUp} className="mt-8 space-y-4">
          <DiscoveryToggle
            value="stays"
            onChange={(mode) => navigate(mode === 'stays' ? '/stays' : `/stays?mode=${mode}`)}
          />
          <SearchBar />
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm text-stone-500">Popular:</span>
            {POPULAR_CITIES.map((city) => (
              <Link
                key={city}
                to={`/stays?city=${encodeURIComponent(city)}`}
                className="rounded-full bg-white px-4 py-1.5 text-sm text-stone-700 ring-1 ring-stone-900/10 transition hover:text-stone-900 hover:ring-stone-900/30"
              >
                {city}
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Shortcuts */}
        <motion.div variants={fadeUp} className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {TILES[role].map(({ to, icon: Icon, label, tone }) => (
            <Link
              key={to + label}
              to={to}
              className={`group flex h-32 flex-col justify-between rounded-3xl p-5 transition hover:-translate-y-1 hover:shadow-lg sm:h-36 ${tone}`}
            >
              <Icon className="h-7 w-7" strokeWidth={1.75} />
              <span className="flex items-center justify-between text-base font-semibold sm:text-lg">
                {label}
                <ArrowRight className="h-4 w-4 opacity-60 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </motion.div>

        {/* Snapshot for the role */}
        <motion.h2 variants={fadeUp} className="mt-12 font-display text-3xl tracking-tight text-stone-900">
          {role === 'admin' ? 'Platform today' : 'Coming up'}
        </motion.h2>
        <motion.div variants={fadeUp} className="mt-5">
          {role === 'host' && <HostPanel user={user} />}
          {role === 'guide' && <GuidePanel user={user} />}
          {role === 'admin' && <AdminPanel />}
          {role === 'traveler' && <TravellerPanel userId={user.id} />}
        </motion.div>

        {/* Safety reminder */}
        <motion.div
          variants={fadeUp}
          className="mt-8 flex flex-col items-start justify-between gap-3 rounded-2xl bg-white p-5 ring-1 ring-stone-900/5 sm:flex-row sm:items-center"
        >
          <p className="flex items-center gap-3 text-sm text-stone-600">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" />
            Travel safely: book and pay only in the app, share your trip with family, and call <strong>112</strong> in an emergency.
          </p>
          <Link to="/safety" className="shrink-0 text-sm font-semibold text-emerald-800 hover:underline">
            Safety tips
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}
