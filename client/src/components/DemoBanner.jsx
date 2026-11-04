import { FlaskConical } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isDemoUser, TEST_CARD } from '../lib/demo'

// Shown while someone is using a demo account, so they know nothing is real
// and have the Paystack test card to hand at checkout.
export default function DemoBanner() {
  const { user } = useAuth()
  if (!isDemoUser(user)) return null

  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-900 sm:text-sm">
      <FlaskConical className="mr-1.5 inline h-4 w-4 align-[-3px]" />
      <strong>Demo mode.</strong> Payments are in Paystack test mode, so no real money moves. Test card{' '}
      <span className="font-mono">{TEST_CARD.number}</span>, any future expiry, CVV {TEST_CARD.cvv}, PIN {TEST_CARD.pin},
      OTP {TEST_CARD.otp}.
    </div>
  )
}
