import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  ArrowRight,
  BatteryCharging,
  CalendarCheck,
  CircleCheck,
  Compass,
  CreditCard,
  Home,
  Lock,
  Luggage,
  ScrollText,
  ShieldCheck,
} from 'lucide-react'
import Reveal from '../components/Reveal'
import { images } from '../lib/images'
import { ease, fadeUp, stagger } from '../lib/motion'
import TypeWriter from '../components/TypeWriter'

const AUDIENCES = [
  {
    icon: Luggage,
    title: 'Travellers',
    text: 'Find apartments, guesthouses, hotel rooms and whole homes across Nigeria — with real photos, clear prices and honest house rules.',
    points: ['Search by city, dates and guests', 'Book instantly or send a request', 'Pay securely, track every trip'],
    cta: { label: 'Explore stays', to: '/stays' },
  },
  {
    icon: Home,
    title: 'Hosts',
    text: 'Reach travellers who are already planning their trip, and manage every listing, request and payout from one dashboard.',
    points: ['List your place in minutes', 'Accept or decline requests', 'See bookings and earnings at a glance'],
    cta: { label: 'Become a host', to: '/signup?role=host' },
  },
  {
    icon: Compass,
    title: 'Tour guides',
    text: 'Food tours, hikes and cultural days, bookable right next to the stays travellers have already chosen.',
    points: ['Be discovered by visitors nearby', 'Manage group sizes and dates', 'Get paid after each tour'],
    cta: { label: 'Join as a guide', to: '/signup?role=guide' },
  },
]

const DIFFERENCES = [
  {
    icon: ShieldCheck,
    title: 'Verified hosts',
    text: 'Hosts and guides go through identity and property checks before they earn the Verified badge.',
  },
  {
    icon: CalendarCheck,
    title: 'No double bookings',
    text: 'Once dates are yours, they are yours. The database itself makes overlapping bookings impossible.',
  },
  {
    icon: CreditCard,
    title: 'Secure payments',
    text: 'Pay by card, bank transfer or USSD through Paystack. Every payment is confirmed on our server.',
  },
  {
    icon: Lock,
    title: 'Privacy first',
    text: 'Your email is never shown to hosts. Sensitive details stay hidden until you choose to reveal them.',
  },
  {
    icon: ScrollText,
    title: 'Clear policies',
    text: 'Three standard cancellation policies and plain-language house rules — no surprises at check-in.',
  },
  {
    icon: BatteryCharging,
    title: 'Built for Nigeria',
    text: 'Prices in naira, and the details that matter here, like 24/7 power, security and parking.',
  },
]

const ROADMAP = [
  {
    phase: 'Now',
    title: 'Stays, bookings and payments',
    items: ['Search and book stays', 'Instant Book and Request to book', 'Paystack payments', 'Wishlist, trips and host dashboard'],
    done: true,
  },
  {
    phase: 'Next',
    title: 'Trust and experiences',
    items: ['Guest reviews and ratings', 'Tours & experiences from local guides', 'Combined trips — one itinerary for everything'],
  },
  {
    phase: 'Later',
    title: 'Scale and convenience',
    items: ['In-app messaging with hosts', 'Calendar sync for hosts', 'More cities, currencies and languages'],
  },
]

export default function About() {
  return (
    <div className="pb-8">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-ink">
          <motion.img
            src={images.host}
            alt=""
            initial={{ scale: 1.2 }}
            animate={{ scale: 1.05 }}
            transition={{ duration: 2.5, ease }}
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/50 to-black/10" />
          <motion.div
            variants={stagger(0.1, 0.2)}
            initial="hidden"
            animate="show"
            className="relative max-w-2xl px-6 py-20 sm:px-12 sm:py-28"
          >
            <motion.p variants={fadeUp} className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
              About Travel &amp; Stays
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="mt-4 font-display text-5xl font-medium leading-tight tracking-tight text-white sm:text-6xl"
            >
              Travel that feels like <em className="text-emerald-300"><TypeWriter text="home." /></em>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-5 text-lg leading-relaxed text-white/80">
              Travel &amp; Stays is a marketplace for places to stay and things to do across Nigeria — built so
              travellers can book with confidence, and hosts and guides can earn from what they love.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Why we exist */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-800">Why we exist</p>
          <h2 className="mt-3 font-display text-4xl tracking-tight text-stone-900 sm:text-5xl">
            Booking a trip shouldn't feel like a <em className="text-emerald-800"><TypeWriter text="gamble." /></em>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-stone-600">
            Too often, finding a place to stay means scrolling social media, sending money to someone you've never
            met and hoping the apartment matches the photos. Hosts, meanwhile, juggle DMs, double bookings and late
            payments. We bring both sides together in one trusted place — with ID-checked hosts, protected dates
            and secure payments.
          </p>
        </Reveal>
      </section>

      {/* Who it's for */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="font-display text-4xl tracking-tight text-stone-900">
            Made for <em className="text-emerald-800"><TypeWriter text="everyone" /></em> on the journey
          </h2>
        </Reveal>
        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="mt-10 grid gap-5 md:grid-cols-3"
        >
          {AUDIENCES.map(({ icon: Icon, title, badge, text, points, cta }) => (
            <motion.div
              key={title}
              variants={fadeUp}
              className="flex flex-col rounded-3xl bg-white p-8 shadow-sm ring-1 ring-stone-900/5 transition-shadow hover:shadow-xl"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-800">
                  <Icon className="h-6 w-6" />
                </span>
                {badge && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800">
                    {badge}
                  </span>
                )}
              </div>
              <h3 className="mt-6 font-display text-2xl text-stone-900">{title}</h3>
              <p className="mt-2 text-stone-600">{text}</p>
              <ul className="mt-5 space-y-2 text-sm text-stone-700">
                {points.map((point) => (
                  <li key={point} className="flex items-center gap-2">
                    <CircleCheck className="h-4 w-4 shrink-0 text-emerald-700" /> {point}
                  </li>
                ))}
              </ul>
              <Link
                to={cta.to}
                className="group mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800"
              >
                {cta.label} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* What makes us different */}
      <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[2.5rem] bg-emerald-950 px-6 py-16 text-white sm:px-12">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">What makes us different</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl tracking-tight">
              Trust is built in, <em className="text-emerald-300"><TypeWriter text="not bolted on." /></em>
            </h2>
          </Reveal>
          <motion.div
            variants={stagger(0.07)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
          >
            {DIFFERENCES.map(({ icon: Icon, title, text }) => (
              <motion.div key={title} variants={fadeUp}>
                <Icon className="h-8 w-8 text-emerald-300" strokeWidth={1.5} />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-emerald-50/70">{text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
        <Reveal className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-800">Where we're going</p>
          <h2 className="mt-3 font-display text-4xl tracking-tight text-stone-900">
            Just getting <em className="text-emerald-800"><TypeWriter text="started." /></em>
          </h2>
        </Reveal>
        <div className="relative mt-14 space-y-10 pl-10">
          <motion.div
            className="absolute bottom-2 left-[15px] top-2 w-px origin-top bg-linear-to-b from-emerald-700 via-emerald-300 to-stone-200"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 1.2, ease }}
          />
          {ROADMAP.map(({ phase, title, items, done }, i) => (
            <Reveal key={phase} delay={i * 0.15} className="relative">
              <span
                className={`absolute -left-10 top-1 grid h-8 w-8 place-items-center rounded-full ring-4 ring-sand ${
                  done ? 'bg-emerald-800 text-white' : 'bg-white text-stone-400 ring-1'
                }`}
              >
                {done ? <CircleCheck className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
              </span>
              <p className={`text-xs font-bold uppercase tracking-[0.2em] ${done ? 'text-emerald-800' : 'text-stone-400'}`}>
                {phase}
              </p>
              <h3 className="mt-1 font-display text-2xl text-stone-900">{title}</h3>
              <ul className="mt-3 grid gap-2 text-stone-600 sm:grid-cols-2">
                {items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <span className={`h-1.5 w-1.5 rounded-full ${done ? 'bg-emerald-700' : 'bg-stone-300'}`} /> {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Call to action */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col items-center rounded-[2.5rem] bg-white px-6 py-16 text-center shadow-sm ring-1 ring-stone-900/5">
          <h2 className="font-display text-4xl tracking-tight text-stone-900">
            Ready when <em className="text-emerald-800"><TypeWriter text="you" /></em> are.
          </h2>
          <p className="mt-3 max-w-lg text-stone-600">
            Find somewhere to stay for your next trip, or start earning from your space today.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/stays"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-800 px-7 py-3.5 font-semibold text-white transition hover:bg-emerald-900"
            >
              Explore stays <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/signup?role=host"
              className="rounded-full px-7 py-3.5 font-semibold text-stone-900 ring-1 ring-stone-300 transition hover:ring-stone-900"
            >
              Become a host
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
