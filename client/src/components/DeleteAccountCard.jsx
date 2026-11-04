import { useState } from 'react'
import { motion } from 'motion/react'
import { Loader2, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { deleteMyAccount } from '../lib/safety'
import { fadeUp } from '../lib/motion'
import { Alert } from './AuthShell'
import { isDemoUser } from '../lib/demo'

const CONFIRM_WORD = 'DELETE'

// "Danger zone" on the Profile page: permanently removes the account after the
// person types DELETE. The database refuses while they have trips coming up.
export default function DeleteAccountCard() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e) {
    e.preventDefault()
    if (typed !== CONFIRM_WORD) return
    setError('')
    setDeleting(true)
    try {
      await deleteMyAccount()
      await signOut({ redirectTo: '/logged-out', state: { reason: 'deleted' } })
    } catch (err) {
      setError(err.message)
      setDeleting(false)
    }
  }

  // Shared demo accounts can't be deleted (the database refuses too).
  if (isDemoUser(user)) return null

  return (
    <motion.section variants={fadeUp} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-red-200 sm:p-8">
      <h2 className="flex items-center gap-2.5 font-display text-2xl tracking-tight text-red-700">
        <Trash2 className="h-5 w-5" /> Delete my account
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-stone-600">
        This permanently removes your profile, saved stays, listings, tours and booking history. It can’t be undone.
        If you have a stay or tour coming up, cancel or finish it first.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold text-red-700 ring-1 ring-red-300 transition hover:bg-red-50"
        >
          I want to delete my account
        </button>
      ) : (
        <form onSubmit={handleDelete} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">
              Type <strong>{CONFIRM_WORD}</strong> to confirm
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="mt-1.5 w-full rounded-xl px-4 py-3 text-sm ring-1 ring-stone-300 outline-none focus:ring-2 focus:ring-red-500"
            />
          </label>
          {error && <Alert>{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            <button
              disabled={typed !== CONFIRM_WORD || deleting}
              className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? 'Deleting…' : 'Delete forever'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setTyped('')
                setError('')
              }}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:ring-stone-900"
            >
              Keep my account
            </button>
          </div>
        </form>
      )}
    </motion.section>
  )
}
