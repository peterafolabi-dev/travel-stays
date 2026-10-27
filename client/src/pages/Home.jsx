import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'motion/react'
import {
  ArrowRight,
  CalendarCheck,
  Compass,
  CreditCard,
  MapPin,
  Search,
  ShieldCheck,
  Pause,
  Play,
  Sparkles,
} from 'lucide-react'
import BackgroundVideo from '../components/BackgroundVideo'
import MemberHome from '../components/MemberHome'
import VideoModal from '../components/VideoModal'
import Reveal from '../components/Reveal'
import { ListingGrid } from '../components/ListingCard'
import { useListings } from '../hooks/useListings'
import { useAuth } from '../context/AuthContext'
import { PROPERTY_TYPES } from '../lib/constants'
import { images, propertyTypeImages, videos, videoReels } from '../lib/images'
import { ease, fadeUp, stagger } from '../lib/motion'
import TypeWriter, { RotatingTyper } from '../components/TypeWriter'

const cities = ['Lagos', 'Abuja', 'Calabar', 'Port Harcourt', 'Ibadan', 'Enugu', 'Uyo', 'Benin City', 'Jos', 'Kano']

const typeBlurbs = {
  apartment: 'City living, your way',
  guesthouse: 'Warm, local hospitality',
  hotel_room: 'Comfort with service',
  house: 'Room for everyone',
}

const steps = [
  { icon: Search, title: 'Search', text: 'Pick a city, your dates and how many guests are coming.' },
  { icon: CalendarCheck, title: 'Book', text: 'Choose a verified stay and pay securely in naira.' },
  { icon: Compass, title: 'Explore', text: 'Check in, settle down and add local tours to your trip.' },
]

function SectionHeading({ eyebrow, title, accent, children }) {
  return (
    <Reveal>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
        <TypeWriter text={eyebrow} speed={35} delay={0} />
      </p>
      <h2 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
        {title} <em className="text-emerald-700"><TypeWriter text={accent} /></em>
      </h2>
      {children && <p className="mt-4 max-w-xl text-stone-500">{children}</p>}
    </Reveal>
  )
}

function FloatingBadge({ icon: Icon, title, text, className, delay, drift = 12 }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, duration: 0.8, ease }}
      className={`absolute hidden xl:block ${className}`}
    >
      <motion.div
        animate={{ y: [0, -drift, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-3 pr-5 text-white shadow-2xl backdrop-blur-xl"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20">
          <Icon className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block text-xs text-white/70">{text}</span>
        </span>
      </motion.div>
    </motion.div>
  )
}

// Headline words slide up from behind a mask, one after another.
function RevealWord({ children, delay, className = '' }) {
  return (
    <span className="mr-[0.22em] inline-block overflow-hidden pb-[0.12em] align-bottom">
      <motion.span
        className={`inline-block ${className}`}
        initial={{ y: '110%' }}
        animate={{ y: 0 }}
        transition={{ delay, duration: 0.9, ease }}
      >
        {children}
      </motion.span>
    </span>
  )
}

function Hero() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '25%'])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '35%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  const [videoReady, setVideoReady] = useState(false)
  const [videoPaused, setVideoPaused] = useState(false)
  const [showVideo, setShowVideo] = useState(false)

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] items-end overflow-hidden rounded-b-[2.5rem] bg-ink pb-14 pt-32 sm:pb-20"
    >
      <VideoModal
        open={showVideo}
        onClose={() => setShowVideo(false)}
        src={videos.showcase}
        poster={images.hero}
        title="Seaside escapes, city apartments and quiet guesthouses: find yours on Travel & Stays."
      />
      {videoReady && (
        <button
          type="button"
          onClick={() => setVideoPaused(!videoPaused)}
          className="absolute bottom-6 right-6 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md transition hover:bg-black/50"
          aria-label={videoPaused ? 'Play background video' : 'Pause background video'}
        >
          {videoPaused ? <Play className="h-4 w-4" fill="currentColor" /> : <Pause className="h-4 w-4" fill="currentColor" />}
        </button>
      )}
      <motion.div style={{ y: imageY }} className="absolute inset-0">
        <motion.img
          src={images.hero}
          alt=""
          initial={{ scale: 1.25 }}
          animate={{ scale: 1.05 }}
          transition={{ duration: 2.8, ease }}
          className="h-full w-full object-cover"
        />
        {/* Cinematic background video on larger screens; the photo stays as its poster. */}
        <BackgroundVideo
          src={videoReels.hero}
          poster={images.hero}
          paused={videoPaused}
          onReady={() => setVideoReady(true)}
          className="absolute inset-0 h-full w-full scale-105 object-cover"
        />
      </motion.div>
      <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/10 to-black/80" />
      <div className="absolute inset-0 bg-linear-to-r from-black/50 via-black/10 to-transparent" />
      {/* Warm, cinematic tint */}
      <div className="absolute inset-0 bg-linear-to-tr from-amber-900/35 via-transparent to-emerald-950/30 mix-blend-multiply" />

      <FloatingBadge
        icon={ShieldCheck}
        title="ID-verified hosts"
        text="Every listing is checked"
        className="right-[7%] top-[20%]"
        delay={1.5}
      />
      <FloatingBadge
        icon={CreditCard}
        title="Secure payments"
        text="Paid in naira, held safely"
        className="right-[16%] top-[33%]"
        delay={1.7}
        drift={-10}
      />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
      >
        <h1 className="max-w-4xl font-display text-5xl font-medium leading-[1.02] tracking-tight text-white sm:text-7xl 2xl:text-8xl">
          <RevealWord delay={0.45}>Stay</RevealWord>
          <RevealWord delay={0.57}>somewhere</RevealWord>
          <RotatingTyper
            words={['unforgettable.', 'by the beach.', 'in Lagos.', 'close to home.', 'in Calabar.']}
            className="block min-h-[1.1em] italic text-emerald-300"
          />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, duration: 0.8, ease }}
          className="mt-6 max-w-xl text-lg leading-relaxed text-white/80"
        >
          Handpicked apartments, guesthouses and homes across Nigeria from verified hosts, with local tours
          to match, all in one place.
        </motion.p>

        {/* Visitors are invited to join; searching lives on the members' home. */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.9, ease }}
          className="mt-10 flex flex-wrap items-center gap-3"
        >
          <Link
            to="/signup"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 font-semibold text-ink shadow-xl shadow-black/20 transition hover:bg-emerald-50"
          >
            Get started — it’s free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center rounded-full px-7 py-4 font-semibold text-white ring-1 ring-white/40 backdrop-blur-md transition hover:bg-white/10"
          >
            Log in
          </Link>
          <button
            type="button"
            onClick={() => setShowVideo(true)}
            className="group flex items-center gap-2.5 rounded-full bg-white/10 py-1.5 pl-1.5 pr-5 font-medium text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20"
          >
            <span className="relative grid h-11 w-11 place-items-center rounded-full bg-white text-emerald-900">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />
              <Play className="relative h-4 w-4 translate-x-px" fill="currentColor" />
            </span>
            Watch the video
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
          className="mt-6 text-sm text-white/70"
        >
          Free to join · Verified hosts · Pay safely with Paystack
        </motion.p>
      </motion.div>
    </section>
  )
}

function CityMarquee() {
  return (
    <div className="relative overflow-hidden border-y border-stone-900/5 py-10 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
            {cities.map((city, i) => (
              <Link
                key={city}
                to={`/stays?city=${encodeURIComponent(city)}`}
                tabIndex={copy === 1 ? -1 : undefined}
                className={`flex items-center font-display text-3xl transition-colors duration-300 sm:text-5xl ${
                  i % 2
                    ? 'text-transparent [-webkit-text-stroke:1.5px_#78716c] hover:text-emerald-700 hover:[-webkit-text-stroke:1.5px_#047857]'
                    : 'text-stone-700 hover:text-emerald-700'
                }`}
              >
                <span className="px-6 sm:px-8">{city}</span>
                <span className="text-lg text-emerald-500 sm:text-2xl">✦</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function StayTypes() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading eyebrow="Find your style" title="Every kind of" accent="stay.">
        From a studio in the city to a whole house for the family.
      </SectionHeading>

      <motion.div
        variants={stagger(0.1)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {PROPERTY_TYPES.map((type) => (
          <motion.div key={type.value} variants={fadeUp} className="relative aspect-3/4 overflow-hidden rounded-3xl">
            <img
              src={propertyTypeImages[type.value]}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <span className="block font-display text-xl text-white sm:text-2xl">{type.label}</span>
              <span className="hidden text-sm text-white/70 sm:block">{typeBlurbs[type.value]}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}

function LatestStays() {
  const { listings, loading, error } = useListings({ limit: 8 })

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-12 flex items-end justify-between gap-4">
        <SectionHeading eyebrow="Just listed" title="Fresh places to" accent="stay." />
        <Reveal>
          <Link
            to="/stays"
            className="group hidden items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink shadow-sm ring-1 ring-black/5 transition hover:shadow-md sm:flex"
          >
            View all
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </div>

      <ListingGrid listings={listings} loading={loading} error={error} skeletons={4} />

      {!loading && !error && listings.length === 0 && (
        <p className="rounded-3xl border border-dashed border-stone-300 p-12 text-center text-stone-500">
          No stays listed yet. Be the first host!
        </p>
      )}
    </section>
  )
}

function FeaturedCity() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const imageY = useTransform(scrollYProgress, [0, 1], ['-12%', '12%'])

  return (
    <section ref={ref} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal className="relative aspect-4/3 overflow-hidden rounded-4xl lg:aspect-4/5">
          <motion.img
            src={images.lagos}
            alt="Aerial view of Lagos"
            loading="lazy"
            style={{ y: imageY, scale: 1.25 }}
            className="h-full w-full object-cover"
          />
          <span className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-ink backdrop-blur-md">
            <MapPin className="h-4 w-4 text-emerald-600" /> Lagos, Nigeria
          </span>
        </Reveal>

        <div>
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">Destination spotlight</p>
            <h2 className="mt-3 font-display text-6xl font-medium tracking-tight text-ink sm:text-8xl">Lagos</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-stone-600">
              From the beaches of Lekki to the galleries and restaurants of Victoria Island, Lagos never slows
              down. Find a stay close to the action, or a quiet retreat from it.
            </p>
          </Reveal>
          <Reveal delay={0.2} className="mt-8 flex flex-wrap gap-2">
            {['Beaches', 'Nightlife', 'Art & culture', 'Business hub'].map((tag) => (
              <span key={tag} className="rounded-full bg-white px-4 py-2 text-sm text-stone-700 ring-1 ring-black/5">
                {tag}
              </span>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl rounded-[2.5rem] bg-white px-6 py-20 shadow-sm ring-1 ring-black/5 sm:px-12">
        <div className="text-center">
          <SectionHeading eyebrow="How it works" title="Booked in three" accent="easy steps." />
        </div>

        <div className="relative mt-16 grid gap-12 md:grid-cols-3">
          <motion.div
            className="absolute left-[16%] right-[16%] top-8 hidden h-px origin-left bg-linear-to-r from-emerald-200 via-emerald-500 to-emerald-200 md:block"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 1.4, ease, delay: 0.2 }}
          />
          {steps.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={0.15 * i} className="relative text-center">
              <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-600/30">
                <Icon className="h-7 w-7" />
              </span>
              <p className="mt-6 font-display text-sm italic text-emerald-700">Step 0{i + 1}</p>
              <h3 className="mt-1 text-xl font-semibold text-ink">{title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-stone-500">{text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function WhyUs() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading eyebrow="Why Travel & Stays" title="Travel with" accent="peace of mind." />

      <div className="mt-12 grid gap-4 md:grid-cols-3 md:grid-rows-2">
        <Reveal className="relative overflow-hidden rounded-4xl bg-ink p-10 text-white md:row-span-2">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/30 blur-3xl" />
          <div className="relative flex h-full flex-col">
            <ShieldCheck className="h-10 w-10 text-emerald-400" strokeWidth={1.5} />
            <h3 className="mt-auto pt-24 font-display text-4xl leading-tight">
              Every host is <em className="text-emerald-400"><TypeWriter text="verified." /></em>
            </h3>
            <p className="mt-4 text-white/70">
              Hosts and tour guides upload ID and property documents, and our team reviews them before a
              single listing goes live.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="rounded-4xl bg-emerald-100/70 p-10 md:col-span-2">
          <CreditCard className="h-9 w-9 text-emerald-700" strokeWidth={1.5} />
          <h3 className="mt-6 font-display text-3xl text-ink">Your money is protected</h3>
          <p className="mt-3 max-w-lg text-stone-600">
            Pay by card, bank transfer or USSD. We hold the payment and only release it to the host after you
            check in.
          </p>
        </Reveal>
        <Reveal delay={0.2} className="rounded-4xl bg-amber-100/70 p-10">
          <Sparkles className="h-9 w-9 text-amber-700" strokeWidth={1.5} />
          <h3 className="mt-6 font-display text-2xl text-ink">Stays and tours together</h3>
          <p className="mt-3 text-stone-600">Plan your bed and your adventures in one trip.</p>
        </Reveal>
        <Reveal delay={0.3} className="rounded-4xl bg-white p-10 ring-1 ring-black/5">
          <MapPin className="h-9 w-9 text-emerald-700" strokeWidth={1.5} />
          <h3 className="mt-6 font-display text-2xl text-ink">Local knowledge</h3>
          <p className="mt-3 text-stone-600">Hosts and guides who know their city inside out.</p>
        </Reveal>
      </div>
    </section>
  )
}

function ImageCard({ image, className = '', delay = 0, children }) {
  return (
    <Reveal delay={delay} className={`group relative min-h-104 overflow-hidden rounded-4xl ${className}`}>
      <img
        src={image}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/60 to-black/10" />
      <div className="relative flex h-full min-h-104 flex-col justify-end p-8 text-white sm:p-10">{children}</div>
    </Reveal>
  )
}

function CallsToAction({ isHost }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-4 lg:grid-cols-5">
        <ImageCard image={images.host} className="lg:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">For hosts</p>
          <h2 className="mt-3 max-w-md font-display text-4xl leading-tight sm:text-5xl">
            Have a space? <em className="text-emerald-300"><TypeWriter text="Earn from it." /></em>
          </h2>
          <p className="mt-4 max-w-md text-white/75">
            List your apartment, guesthouse or home and reach travellers already planning their trip.
          </p>
          <Link
            to={isHost ? '/host/listings/new' : '/signup?role=host'}
            className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-ink transition hover:bg-emerald-50"
          >
            {isHost ? 'List a new place' : 'Become a host'} <ArrowRight className="h-4 w-4" />
          </Link>
        </ImageCard>

        <ImageCard image={images.tours} className="lg:col-span-2" delay={0.1}>
          <span className="w-fit rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-950">
            New
          </span>
          <h2 className="mt-4 font-display text-4xl leading-tight">Tours &amp; experiences</h2>
          <p className="mt-4 text-white/75">
            Food tours, hikes and cultural days, bookable right alongside your stay.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/stays?mode=tours"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-ink transition hover:bg-emerald-50"
            >
              Explore tours <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/signup?role=guide"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/40 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Become a guide
            </Link>
          </div>
        </ImageCard>
      </div>
    </section>
  )
}

export default function Home() {
  const { user } = useAuth()

  // Logged-in people get their own home: a greeting and a snapshot for their
  // role, then fresh stays. The marketing sections are for visitors.
  if (user) {
    return (
      <>
        <MemberHome />
        <LatestStays />
        <FeaturedCity />
      </>
    )
  }

  return (
    <>
      <Hero />
      <CityMarquee />
      <StayTypes />
      <FeaturedCity />
      <HowItWorks />
      <WhyUs />
      <CallsToAction isHost={user?.role === 'host'} />
    </>
  )
}
