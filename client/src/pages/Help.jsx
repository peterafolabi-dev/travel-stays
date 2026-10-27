import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ShieldAlert } from 'lucide-react'
import { CANCELLATION_NOTE, CANCELLATION_POLICIES } from '../lib/constants'
import { ease } from '../lib/motion'
import InfoPage, { InfoSection } from '../components/InfoPage'
import ContactForm from '../components/ContactForm'

const FAQ_GROUPS = [
  {
    title: 'Booking',
    items: [
      {
        q: 'How do I book a stay?',
        a: 'Open any listing, pick your check-in and check-out dates and the number of guests, then press Instant Book or Request to book. You need a free account to book.',
      },
      {
        q: "What's the difference between Instant Book and Request to book?",
        a: 'Instant Book confirms your stay straight away. With Request to book, the host reviews your request first — your dates are held for you while they decide.',
      },
      {
        q: 'Can someone else book the same dates as me?',
        a: 'No. As soon as you book (or send a request), those nights are held for you. Our system makes it impossible for two bookings on the same place to overlap, even if two people press Book at the same moment.',
      },
      {
        q: 'How do I cancel a booking?',
        a: 'Go to My trips, open the booking and choose Cancel booking. You can cancel any time before your check-in day. Any refund follows the listing’s cancellation policy.',
      },
    ],
  },
  {
    title: 'Payments',
    items: [
      {
        q: 'When do I pay?',
        a: 'Once your booking is confirmed — straight away for Instant Book, or when the host accepts your request — open it from My trips and press Pay now. Payment is handled securely by Paystack by card, bank transfer or USSD.',
      },
      {
        q: 'What is the service fee?',
        a: 'A 10% service fee is added to the cost of your stay (nights plus any cleaning fee). It is shown in the price breakdown before you book, so there are no surprises.',
      },
    ],
  },
  {
    title: 'Hosting',
    items: [
      {
        q: 'How do I list my place?',
        a: 'Create a host account, then choose List your place. Add photos, a description, amenities, house rules, your price and a cancellation policy, and publish.',
      },
      {
        q: 'Can I take a break from hosting?',
        a: 'Yes. Pause a listing from My listings to hide it from search. Existing bookings are not affected, and you can switch it back on any time.',
      },
      {
        q: 'How do booking requests work?',
        a: 'Requests appear on your host dashboard with the guest’s name, dates and what you’ll earn. Accept to confirm the stay, or decline to release the dates.',
      },
    ],
  },
  {
    title: 'Account & privacy',
    items: [
      {
        q: 'Who can see my email and phone number?',
        a: 'Your email is never shown to hosts or other travellers. Your name and phone number are shared only with hosts you have booked with, so they can reach you about your stay.',
      },
      {
        q: 'I forgot my password.',
        a: 'Choose “Forgot password?” on the log in page and we’ll email you a link to set a new one.',
      },
      {
        q: 'Why was I logged out?',
        a: 'For your security, you are logged out automatically after 30 minutes without activity. You get a one-minute warning first so you can stay logged in.',
      },
    ],
  },
]

const SAFETY_TIPS = [
  'Book and pay only through Travel & Stays. Never send money to a host directly or off the platform.',
  'Look for the Verified host badge and read reviews before you book.',
  'Keep your conversations and bookings on Travel & Stays so there is a record if anything goes wrong.',
  'Share your trip details — address and dates — with a friend or family member.',
  'In an emergency anywhere in Nigeria, call 112.',
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-stone-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-4 text-left font-medium text-stone-900"
      >
        {q}
        <ChevronDown className={`h-5 w-5 shrink-0 text-stone-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-8 leading-relaxed text-stone-600">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Help() {
  const { hash } = useLocation()

  // Footer links like /help#safety jump straight to that section.
  useEffect(() => {
    if (!hash) return
    const timer = setTimeout(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => clearTimeout(timer)
  }, [hash])

  return (
    <InfoPage
      eyebrow="Help centre"
      title="How can we"
      accent="help?"
      intro="Answers to the questions travellers and hosts ask most. Can't find what you need? Email us and we'll get back to you."
    >
      {FAQ_GROUPS.map((group) => (
        <InfoSection key={group.title} id={group.title.toLowerCase().replace(/[^a-z]+/g, '-')} title={group.title}>
          <div className="border-t border-stone-200">
            {group.items.map((item) => (
              <FaqItem key={item.q} {...item} />
            ))}
          </div>
        </InfoSection>
      ))}

      <InfoSection id="cancellation" title="Cancellation options">
        <p>
          Every listing uses one of three standard policies, chosen by the host and shown before you book. Fixed
          templates mean you and your host always agree on what was promised.
        </p>
        <div className="grid gap-3 pt-2 sm:grid-cols-3">
          {CANCELLATION_POLICIES.map((policy) => (
            <div key={policy.value} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-900/5">
              <p className="font-semibold text-stone-900">{policy.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{policy.text}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-stone-500">{CANCELLATION_NOTE}</p>
      </InfoSection>

      <InfoSection id="safety" title="Staying safe">
        <div className="rounded-2xl bg-emerald-900 p-6 text-emerald-50">
          <ShieldAlert className="h-7 w-7 text-emerald-300" />
          <ul className="mt-4 space-y-2.5 text-sm [&>li]:ml-5 [&>li]:list-disc">
            {SAFETY_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      </InfoSection>

      <InfoSection id="contact" title="Still need help?">
        <p>Send our support team a message and we'll reply by email, usually within one working day.</p>
        <ContactForm />
        <p className="text-sm">
          See also our <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </InfoSection>
    </InfoPage>
  )
}
