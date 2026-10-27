import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { Heart, LogOut, Luggage, Menu, UserRound, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { initials, maskEmail } from '../lib/format'
import { ease } from '../lib/motion'
import Logo from './Logo'

// Each role gets its own links; logged-out visitors get none.
function linksFor(user) {
  if (user?.role === 'guide') {
    return [
      { to: '/stays?mode=tours', label: 'Tours' },
      { to: '/guide/tours', label: 'My tours' },
      { to: '/guide/tours/new', label: 'Create a tour' },
    ]
  }
  if (user?.role === 'admin') {
    return [
      { to: '/stays', label: 'Stays' },
      { to: '/admin', label: 'Dashboard' },
      { to: '/trips', label: 'My trips' },
    ]
  }
  if (user?.role === 'host') {
    return [
      { to: '/stays', label: 'Stays' },
      { to: '/host/listings', label: 'My listings' },
      { to: '/host/listings/new', label: 'List your place' },
    ]
  }
  if (user) {
    return [
      { to: '/stays', label: 'Stays' },
      { to: '/saved', label: 'Saved' },
      { to: '/trips', label: 'My trips' },
    ]
  }
  // Visitors only see Log in / Sign up: everything else needs an account.
  return []
}

const roleLabels = { traveler: 'Traveler', host: 'Host', guide: 'Guide', admin: 'Admin' }

// `overlay` = the navbar sits on top of a hero photo (home page). It stays
// transparent with white text until the visitor scrolls.
export default function Navbar({ overlay = false }) {
  const { user, loading, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24))

  const links = linksFor(user)
  const light = overlay && !scrolled && !mobileOpen

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease }}
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500 ${
        light ? 'border-b border-transparent bg-transparent' : 'border-b border-black/5 bg-white/75 backdrop-blur-xl'
      }`}
    >
      <nav
        className={`mx-auto flex max-w-7xl items-center justify-between px-4 transition-[height] duration-500 sm:px-6 lg:px-8 ${
          scrolled ? 'h-16' : 'h-20'
        }`}
      >
        <Logo light={light} />

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end className="relative rounded-full px-4 py-2 text-sm font-medium">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className={`absolute inset-0 rounded-full ${light ? 'bg-white/15' : 'bg-emerald-50'}`}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span
                    className={`relative transition-colors ${
                      isActive
                        ? light
                          ? 'text-white'
                          : 'text-emerald-800'
                        : light
                          ? 'text-white/80 hover:text-white'
                          : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {link.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {loading ? null : user ? (
            <div className="relative">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setMenuOpen(!menuOpen)}
                className={`flex items-center gap-3 rounded-full py-1 pl-4 pr-1 transition ${
                  light ? 'bg-white/15 text-white backdrop-blur-md hover:bg-white/25' : 'bg-white text-stone-700 ring-1 ring-black/10 hover:shadow-md'
                }`}
              >
                <span className="text-sm font-medium">{user.fullName.split(' ')[0] || 'Account'}</span>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-linear-to-br from-emerald-500 to-teal-600 text-xs font-semibold text-white">
                  {initials(user.fullName)}
                </span>
              </motion.button>

              <AnimatePresence>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -8 }}
                      transition={{ duration: 0.2, ease }}
                      className="absolute right-0 z-20 mt-3 w-72 origin-top-right overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/10 ring-1 ring-black/5"
                    >
                      <div className="border-b border-stone-100 px-5 py-4">
                        <p className="truncate font-semibold text-stone-900">{user.fullName}</p>
                        <p className="truncate text-sm text-stone-500">{maskEmail(user.email)}</p>
                        <span className="mt-3 inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          {roleLabels[user.role] ?? user.role}
                        </span>
                      </div>
                      <Link
                        to="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex w-full items-center gap-2 px-5 py-3.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                      >
                        <UserRound className="h-4 w-4" /> Profile
                      </Link>
                      <Link
                        to="/trips"
                        onClick={() => setMenuOpen(false)}
                        className="flex w-full items-center gap-2 px-5 py-3.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                      >
                        <Luggage className="h-4 w-4" /> My trips
                      </Link>
                      <Link
                        to="/saved"
                        onClick={() => setMenuOpen(false)}
                        className="flex w-full items-center gap-2 px-5 py-3.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                      >
                        <Heart className="h-4 w-4" /> Saved
                      </Link>
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          signOut()
                        }}
                        className="flex w-full items-center gap-2 px-5 py-3.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                      >
                        <LogOut className="h-4 w-4" /> Log out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  light ? 'text-white hover:bg-white/15' : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                Log in
              </Link>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/signup"
                  className={`block rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg transition-colors ${
                    light ? 'bg-white text-ink shadow-black/20' : 'bg-emerald-800 text-white shadow-emerald-900/20 hover:bg-emerald-900'
                  }`}
                >
                  Sign up
                </Link>
              </motion.div>
            </>
          )}
        </div>

        <button
          className={`rounded-full p-2 transition md:hidden ${light ? 'text-white hover:bg-white/15' : 'text-stone-700 hover:bg-stone-100'}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease }}
            className="overflow-hidden border-t border-black/5 bg-white md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              {links.map((link, i) => (
                <motion.div
                  key={link.to}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i + 0.1 }}
                >
                  <NavLink
                    to={link.to}
                    end
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `block rounded-xl px-3 py-3 text-base font-medium ${
                        isActive ? 'bg-emerald-50 text-emerald-800' : 'text-stone-700'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                </motion.div>
              ))}
              {links.length > 0 && <hr className="my-2 border-stone-100" />}
              {user ? (
                <>
                  <div className="px-3 py-2">
                    <p className="font-semibold text-stone-900">{user.fullName}</p>
                    <p className="text-sm text-stone-500">
                      {maskEmail(user.email)} · {roleLabels[user.role] ?? user.role}
                    </p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-stone-700"
                  >
                    <UserRound className="h-4 w-4" /> Profile
                  </Link>
                  <button
                    onClick={() => {
                      setMobileOpen(false)
                      signOut()
                    }}
                    className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-stone-700"
                  >
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </>
              ) : (
                <div className="flex gap-3 pt-1">
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 rounded-full py-3 text-center text-sm font-semibold text-stone-700 ring-1 ring-stone-300"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 rounded-full bg-emerald-800 py-3 text-center text-sm font-semibold text-white"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
