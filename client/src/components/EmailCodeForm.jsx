import { useState } from 'react'
import { Loader2, MailCheck, RotateCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { friendlyAuthError } from '../lib/authErrors'
import { useCooldown } from '../hooks/useCooldown'
import { Alert } from './AuthShell'

// Supabase can be set to send codes of 6 to 10 digits, so accept any of them.
const MIN_LENGTH = 6
const MAX_LENGTH = 10
const RESEND_SECONDS = 60

// "Enter the code we emailed you." One large box that takes typing, pasting
// and phone autofill. Calls onVerified(session) on success.
export default function EmailCodeForm({ email, onVerified }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resent, setResent] = useState(false)
  const [cooldown, setCooldown] = useCooldown(RESEND_SECONDS) // an email was just sent

  async function verify(e) {
    e.preventDefault()
    setError('')
    if (code.length < MIN_LENGTH) return setError('Enter the full code from the email.')
    setVerifying(true)
    const { data, error: err } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    setVerifying(false)
    if (err) {
      const text = err.message.toLowerCase()
      setError(
        text.includes('expired') || text.includes('invalid')
          ? 'That code is wrong or has expired. Check the latest email, or send a new code.'
          : friendlyAuthError(err).message,
      )
      return
    }
    onVerified(data.session)
  }

  async function resend() {
    setError('')
    setResent(false)
    const { error: err } = await supabase.auth.resend({ type: 'signup', email })
    if (err) {
      const friendly = friendlyAuthError(err)
      setError(friendly.message)
      setCooldown(friendly.wait ?? RESEND_SECONDS)
      return
    }
    setResent(true)
    setCode('')
    setCooldown(RESEND_SECONDS)
  }

  return (
    <form onSubmit={verify} className="space-y-6">
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-100">
        <MailCheck className="h-6 w-6 shrink-0 text-emerald-700" />
        <p>
          We sent a code to <strong className="break-all">{email}</strong>. It can take a minute — check your spam
          folder too.
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-stone-700">Verification code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, MAX_LENGTH))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="Enter the code"
          aria-label="Verification code"
          className="mt-1.5 w-full rounded-xl bg-white px-4 py-4 text-center font-display text-3xl tracking-[0.35em] text-stone-900 ring-1 ring-stone-300 outline-none transition placeholder:text-base placeholder:tracking-normal placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-700"
        />
      </label>

      {error && <Alert>{error}</Alert>}
      {resent && !error && <Alert type="success">A new code is on its way.</Alert>}

      <button
        disabled={verifying}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:opacity-60"
      >
        {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
        {verifying ? 'Checking…' : 'Verify and continue'}
      </button>

      <button
        type="button"
        onClick={resend}
        disabled={cooldown > 0}
        className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-emerald-800 transition hover:text-emerald-900 disabled:text-stone-400"
      >
        <RotateCw className="h-4 w-4" />
        {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
      </button>
    </form>
  )
}
