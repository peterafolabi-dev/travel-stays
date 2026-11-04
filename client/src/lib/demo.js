// One-click demo accounts for recruiters and reviewers.
//
// These are throwaway accounts made only for demos, never anyone's real login.
// Their emails and passwords come from VITE_DEMO_* variables, which end up in
// the browser bundle, and that's fine: they are meant to be public. If none
// are set, the demo buttons simply don't appear.

const env = import.meta.env

export const DEMO_ACCOUNTS = [
  {
    role: 'traveller',
    label: 'Traveller',
    blurb: 'Search, book a stay and pay with a Paystack test card',
    email: env.VITE_DEMO_TRAVELLER_EMAIL,
    password: env.VITE_DEMO_TRAVELLER_PASSWORD,
  },
  {
    role: 'host',
    label: 'Host',
    blurb: 'Manage listings, accept bookings and block dates',
    email: env.VITE_DEMO_HOST_EMAIL,
    password: env.VITE_DEMO_HOST_PASSWORD,
  },
  {
    role: 'guide',
    label: 'Tour guide',
    blurb: 'Create a tour and handle booking requests',
    email: env.VITE_DEMO_GUIDE_EMAIL,
    password: env.VITE_DEMO_GUIDE_PASSWORD,
  },
].filter((a) => a.email && a.password)

const demoEmails = new Set(DEMO_ACCOUNTS.map((a) => a.email.toLowerCase()))

export function isDemoUser(user) {
  return Boolean(user?.email && demoEmails.has(user.email.toLowerCase()))
}

// Paystack's public test card, for the demo banner.
export const TEST_CARD = { number: '4084 0840 8408 4081', cvv: '408', pin: '0000', otp: '123456' }
