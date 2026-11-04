import { useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { friendlyAuthError } from '../lib/authErrors'
import { useCooldown } from '../hooks/useCooldown'

const MAX_TRIES = 5 // wrong passwords in a row before a short pause
const LOCKOUT_SECONDS = 30
import { IDLE_TIMEOUT_MINUTES, markActive } from '../lib/session'
import { videoReels } from '../lib/images'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import AuthShell, { Alert, TextField } from '../components/AuthShell'
import GoogleButton from '../components/GoogleButton'
import DemoLogin from '../components/DemoLogin'

export default function Login() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useCooldown()
  const failures = useRef(0)

  if (user) return <Navigate to={redirectTo} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    // Start the inactivity clock fresh *before* the session appears, so an old
    // timestamp from a previous visit can't log the user straight back out.
    markActive()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)

    if (error) {
      const friendly = friendlyAuthError(error)
      failures.current += 1
      // After 5 wrong tries in a row, pause the form for 30 seconds.
      if (!friendly.wait && failures.current >= MAX_TRIES) {
        failures.current = 0
        setError(`Too many wrong attempts. For your security, please wait ${LOCKOUT_SECONDS} seconds, or reset your password.`)
        setCooldown(LOCKOUT_SECONDS)
        return
      }
      setError(friendly.message)
      if (friendly.wait) setCooldown(friendly.wait)
      return
    }
    failures.current = 0
    const firstName = data.user?.user_metadata?.full_name?.split(' ')[0]
    toast.show({
      title: `Welcome back${firstName ? `, ${firstName}` : ''}!`,
      description: "You're logged in. Where to next?",
    })
    navigate(redirectTo, { replace: true })
  }

  return (
    <AuthShell video={videoReels.login} title="Welcome back" subtitle="Log in to manage your trips and bookings.">
      <DemoLogin onError={setError} />
      <GoogleButton onError={setError} />
      <form onSubmit={handleSubmit} className="space-y-5">
        {location.state?.reason === 'idle' && !error && (
          <Alert type="success">
            You were logged out after {IDLE_TIMEOUT_MINUTES} minutes of inactivity to keep your account safe. Please
            log in again.
          </Alert>
        )}
        {error && <Alert>{error}</Alert>}
        <TextField
          icon={Mail}
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <TextField
          icon={Lock}
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <div className="-mt-2 text-right">
          <Link to="/forgot-password" className="text-sm font-semibold text-emerald-800 hover:text-emerald-900">
            Forgot password?
          </Link>
        </div>
        <button
          disabled={submitting || cooldown > 0}
          className="w-full rounded-xl bg-emerald-800 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:opacity-60"
        >
          {submitting ? 'Logging in…' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-stone-500">
        New to Travel &amp; Stays?{' '}
        <Link to="/signup" className="font-semibold text-emerald-700 hover:text-emerald-800">
          Create an account
        </Link>
      </p>
    </AuthShell>
  )
}
