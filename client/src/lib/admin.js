import { supabase } from './supabase'

// All of these call database functions from supabase/migrations/010.
// The admin ones refuse to run unless the caller's role is 'admin'.

export async function fetchAdminStats() {
  const { data, error } = await supabase.rpc('admin_stats')
  if (error) throw new Error(error.message)
  return data
}

export async function fetchAdminUsers() {
  const { data, error } = await supabase.rpc('admin_users')
  if (error) throw new Error(error.message)
  return data ?? []
}

// Cancelled bookings whose refund still has to be sent (migration 015).
export async function fetchRefundsDue() {
  const { data, error } = await supabase.rpc('admin_refunds')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function markRefunded(bookingId) {
  const { error } = await supabase.rpc('mark_refunded', { p_booking_id: bookingId })
  if (error) throw new Error(error.message)
}

// "Last seen" heartbeat — failures are harmless, so they're only logged.
export async function touchLastSeen() {
  const { error } = await supabase.rpc('touch_last_seen')
  if (error) console.warn('Could not update last seen:', error.message)
}

// Applies the role picked on the sign-up page after a Google sign-up.
export async function setInitialRole(role) {
  const { error } = await supabase.rpc('set_initial_role', { p_role: role })
  if (error) throw new Error(error.message)
}

// Remembers the chosen role across the trip to Google and back.
const PENDING_ROLE_KEY = 'travel-stays:pending-role'

export function savePendingRole(role) {
  try {
    localStorage.setItem(PENDING_ROLE_KEY, role)
  } catch {
    // Storage blocked — the account simply stays a traveller.
  }
}

export function takePendingRole() {
  try {
    const role = localStorage.getItem(PENDING_ROLE_KEY)
    localStorage.removeItem(PENDING_ROLE_KEY)
    return role
  } catch {
    return null
  }
}
