import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  BadgeCheck,
  Building2,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  Luggage,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { changePassword, updateProfile } from '../lib/profile'
import { initials, maskEmail, maskPhone } from '../lib/format'
import { ease, fadeUp, stagger } from '../lib/motion'
import { Alert } from '../components/AuthShell'
import TypeWriter from '../components/TypeWriter'
import VerificationCard from '../components/VerificationCard'
import DeleteAccountCard from '../components/DeleteAccountCard'
import { isDemoUser } from '../lib/demo'

const ROLE_LABELS = { traveler: 'Traveler', host: 'Host', guide: 'Tour guide', admin: 'Admin' }
const PHONE_PATTERN = /^[0-9+() -]{7,20}$/
const BIO_LIMIT = 500

const inputClass =
  'mt-1.5 w-full rounded-xl bg-white px-4 py-3 text-sm text-stone-900 ring-1 ring-stone-900/10 outline-none transition focus:ring-2 focus:ring-emerald-700'

function Card({ title, icon: Icon, action, children }) {
  return (
    <motion.section variants={fadeUp} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-900/5 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2.5 font-display text-2xl tracking-tight text-stone-900">
          <Icon className="h-5 w-5 text-emerald-800" /> {title}
        </h2>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </motion.section>
  )
}

// A detail that stays masked ("af•••••@gmail.com") until the owner taps the eye.
function SensitiveRow({ icon: Icon, label, value, masked, emptyText }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="flex items-center gap-4 py-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-600">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">{label}</p>
        {value ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={revealed ? 'shown' : 'hidden'}
              initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -4, filter: 'blur(4px)' }}
              transition={{ duration: 0.2 }}
              className="truncate font-medium text-stone-900"
            >
              {revealed ? value : masked}
            </motion.p>
          </AnimatePresence>
        ) : (
          <p className="text-stone-400">{emptyText}</p>
        )}
      </div>
      {value && (
        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-stone-600 ring-1 ring-stone-200 transition hover:text-stone-900 hover:ring-stone-400"
          aria-label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {revealed ? 'Hide' : 'Show'}
        </button>
      )}
    </div>
  )
}

function PlainRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-4 py-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-600">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">{label}</p>
        <div className="font-medium text-stone-900">{children}</div>
      </div>
    </div>
  )
}

function PersonalDetails({ user, refreshProfile }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ fullName: '', phone: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { type, text }

  function startEditing() {
    setForm({ fullName: user.fullName, phone: user.phone, bio: user.bio })
    setMessage(null)
    setEditing(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    const fullName = form.fullName.trim()
    const phone = form.phone.trim()
    if (fullName.length < 2) return setMessage({ type: 'error', text: 'Please enter your full name.' })
    if (phone && !PHONE_PATTERN.test(phone)) {
      return setMessage({ type: 'error', text: 'Use digits, spaces, +, - or brackets for your phone number.' })
    }

    setSaving(true)
    setMessage(null)
    try {
      await updateProfile(user.id, { fullName, phone, bio: form.bio.trim() })
      refreshProfile()
      setEditing(false)
      setMessage({ type: 'success', text: 'Your details have been saved.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      title="Personal details"
      icon={User}
      action={
        !editing && (
          <button
            type="button"
            onClick={startEditing}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-stone-900 ring-1 ring-stone-300 transition hover:ring-stone-900"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )
      }
    >
      {message && (
        <div className="mb-4">
          <Alert type={message.type}>{message.text}</Alert>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.form
            key="edit"
            onSubmit={handleSave}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease }}
            className="space-y-5"
          >
            <label className="block">
              <span className="text-sm font-medium text-stone-700">Full name</span>
              <input
                className={inputClass}
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                autoComplete="name"
                maxLength={80}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-stone-700">Phone number (optional)</span>
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+234 800 000 0000"
                autoComplete="tel"
                inputMode="tel"
              />
              <span className="mt-1 block text-xs text-stone-500">Only shared with hosts you book with.</span>
            </label>
            <label className="block">
              <span className="flex justify-between text-sm font-medium text-stone-700">
                About you (optional)
                <span className={`text-xs ${form.bio.length > BIO_LIMIT - 50 ? 'text-amber-700' : 'text-stone-400'}`}>
                  {form.bio.length}/{BIO_LIMIT}
                </span>
              </span>
              <textarea
                rows={4}
                maxLength={BIO_LIMIT}
                className={inputClass}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="A line or two about how you like to travel."
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="flex items-center gap-2 rounded-full bg-emerald-800 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </motion.form>
        ) : (
          <motion.div
            key="view"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease }}
            className="divide-y divide-stone-100"
          >
            <PlainRow icon={User} label="Full name">
              {user.fullName || <span className="text-stone-400">Not added</span>}
            </PlainRow>
            <SensitiveRow icon={Mail} label="Email" value={user.email} masked={maskEmail(user.email)} />
            <SensitiveRow
              icon={Phone}
              label="Phone"
              value={user.phone}
              masked={maskPhone(user.phone)}
              emptyText="Not added"
            />
            <PlainRow icon={Pencil} label="About you">
              {user.bio ? (
                <p className="whitespace-pre-line font-normal leading-relaxed text-stone-700">{user.bio}</p>
              ) : (
                <span className="font-normal text-stone-400">Tell hosts a little about yourself.</span>
              )}
            </PlainRow>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function Security() {
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 6) return setMessage({ type: 'error', text: 'Use at least 6 characters.' })
    if (password !== confirm) return setMessage({ type: 'error', text: "The two passwords don't match." })

    setSaving(true)
    setMessage(null)
    try {
      await changePassword(password)
      setPassword('')
      setConfirm('')
      setMessage({ type: 'success', text: 'Your password has been changed.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (isDemoUser(user)) {
    return (
      <Card title="Password" icon={KeyRound}>
        <p className="text-sm text-stone-600">This is a shared demo account, so its password can’t be changed.</p>
      </Card>
    )
  }

  return (
    <Card title="Password" icon={KeyRound}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {message && <Alert type={message.type}>{message.text}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">New password</span>
            <input
              type={show ? 'text' : 'password'}
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Confirm new password</span>
            <input
              type={show ? 'text' : 'password'}
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {show ? 'Hide passwords' : 'Show passwords'}
          </button>
          <button
            disabled={saving || !password}
            className="flex items-center gap-2 rounded-full bg-emerald-800 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </button>
        </div>
      </form>
    </Card>
  )
}

export default function Profile() {
  const { user, signOut, refreshProfile } = useAuth()
  const memberSince = new Date(user.createdAt).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })

  const shortcuts = [
    { to: '/trips', icon: Luggage, label: 'My trips', text: 'Upcoming and past stays' },
    ...(user.role === 'host'
      ? [{ to: '/host/listings', icon: Building2, label: 'My listings', text: 'Your places and bookings' }]
      : []),
    ...(user.role === 'guide' ? [{ to: '/guide/tours', icon: Building2, label: 'My tours', text: 'Your tours and bookings' }] : []),
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
        className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-900/5 sm:p-10"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
            className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-linear-to-br from-emerald-600 to-teal-700 font-display text-3xl text-white shadow-xl shadow-emerald-900/20 ring-4 ring-white"
          >
            {initials(user.fullName)}
          </motion.span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-800">Your profile</p>
            <h1 className="mt-1 font-display text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl">
              <TypeWriter text={user.fullName || 'Welcome'} speed={45} />
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {user.verified && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-800 px-3 py-1 font-semibold text-white">
                  <ShieldCheck className="h-4 w-4" /> ID verified
                </span>
              )}
              {user.emailConfirmed && (
                <span className="flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 font-medium text-stone-700">
                  <BadgeCheck className="h-4 w-4 text-emerald-700" /> Email verified
                </span>
              )}
              <span className="text-stone-500">Member since {memberSince}</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <motion.div variants={stagger(0.08, 0.15)} initial="hidden" animate="show" className="space-y-6 lg:col-span-2">
          <PersonalDetails user={user} refreshProfile={refreshProfile} />
          {['host', 'guide'].includes(user.role) && <VerificationCard />}
          <Security />
          <DeleteAccountCard />
        </motion.div>

        <motion.aside variants={stagger(0.08, 0.3)} initial="hidden" animate="show" className="space-y-6">
          <motion.div variants={fadeUp} className="rounded-2xl bg-emerald-900 p-6 text-white">
            <ShieldCheck className="h-7 w-7 text-emerald-300" />
            <h2 className="mt-4 font-display text-2xl">Your privacy</h2>
            <ul className="mt-3 space-y-2 text-sm text-emerald-50/80">
              <li>Your email is never shown to hosts or other travellers.</li>
              <li>Your name and phone are shared only with hosts you book with, so they can reach you about your stay.</li>
              <li>Sensitive details stay hidden on this page until you choose to show them.</li>
            </ul>
          </motion.div>

          <motion.div variants={fadeUp} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-900/5">
            {shortcuts.map(({ to, icon: Icon, label, text }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-center gap-4 border-b border-stone-100 p-5 transition-colors hover:bg-stone-50"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold text-stone-900">{label}</span>
                  <span className="block text-sm text-stone-500">{text}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-stone-400 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
            <button
              type="button"
              onClick={() => signOut()}
              className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-red-50"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600">
                <LogOut className="h-5 w-5" />
              </span>
              <span className="font-semibold text-red-600">Log out</span>
            </button>
          </motion.div>
        </motion.aside>
      </div>
    </div>
  )
}
