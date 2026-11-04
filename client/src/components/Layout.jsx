import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { ease } from '../lib/motion'
import { useAuth } from '../context/AuthContext'
import Navbar from './Navbar'
import Footer from './Footer'
import DemoBanner from './DemoBanner'

// Every page renders inside this shell. On the home page the navbar floats
// transparently over the hero photo; elsewhere the content starts below it.
export default function Layout() {
  const { pathname, hash } = useLocation()
  const { user } = useAuth()
  // Only the visitor landing page has the see-through navbar over its photo;
  // logged-in people get their own home with a normal navbar.
  const overlay = pathname === '/' && !user

  // Start each new page at the top — unless the link points at a section
  // (e.g. /help#safety), which the page scrolls to itself.
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar overlay={overlay} />
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className={`flex-1 ${overlay ? '' : 'pt-20'}`}
      >
        <DemoBanner />
        <Outlet />
      </motion.main>
      <Footer />
    </div>
  )
}
