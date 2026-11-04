import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass, Home, Luggage, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { markActive } from '../lib/session'
import { DEMO_ACCOUNTS } from '../lib/demo'

const icons = { traveller: Luggage, host: Home, guide: Compass }

// "Try it in one click": logs into a shared demo account so a recruiter can
// see the whole booking flow without signing up.
export default function DemoLogin({ onError }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(null)

  if (DEMO_ACCOUNTS.length === 0) return null

  async function enter(account) {
    onError?.('')
    setBusy(account.role)
    markActive()
    const { error } = await supabase.auth.signInWithPassword({ email: account.email, password: account.password })
    setBusy(null)
    if (error) {
      onError?.('The demo account is unavailable right now. Please try again later or create your own account.')
      return
    }
    navigate(account.role === 'traveller' ? '/stays' : account.role === 'host' ? '/host/listings' : '/guide/tours', {
      replace: true,
    })
  }

  return (
    <section className="mb-6 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <Sparkles className="h-4 w-4" /> Just looking? Try a demo account, no sign-up needed
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {DEMO_ACCOUNTS.map((a) => {
          const Icon = icons[a.role]
          return (
            <button
              key={a.role}
              type="button"
              onClick={() => enter(a)}
              disabled={busy !== null}
              title={a.blurb}
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-stone-800 ring-1 ring-amber-200 transition hover:bg-amber-100 disabled:opacity-60"
            >
              <Icon className="h-4 w-4 text-amber-700" />
              {busy === a.role ? 'Opening…' : a.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
