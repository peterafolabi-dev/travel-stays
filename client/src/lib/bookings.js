import { supabase } from './supabase'
import { nightsBetween } from './dates'
import { fetchReviewsForBookings } from './reviews'

// Must match the service fee in create_booking (supabase/migrations/003_bookings.sql).
// The server always recalculates the price; this is only for showing it.
export const SERVICE_FEE_RATE = 0.1

export function quote(listing, checkIn, checkOut) {
  if (!checkIn || !checkOut) return null
  const nights = nightsBetween(checkIn, checkOut)
  const rate = Number(listing.price_per_night) || 0
  const cleaningFee = Number(listing.cleaning_fee) || 0
  const subtotal = nights * rate
  const serviceFee = Math.round((subtotal + cleaningFee) * SERVICE_FEE_RATE)
  return { nights, rate, subtotal, cleaningFee, serviceFee, total: subtotal + cleaningFee + serviceFee }
}

// Nights already taken on a listing, as [{ check_in, check_out }].
export async function fetchBookedRanges(listingId) {
  const { data, error } = await supabase.rpc('listing_booked_ranges', { p_listing_id: listingId })
  if (error) throw error
  return data ?? []
}

export async function createBooking({ listingId, checkIn, checkOut, guests }) {
  const { data, error } = await supabase.rpc('create_booking', {
    p_listing_id: listingId,
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_guests: guests,
  })
  if (error) throw new Error(error.message)
  return data
}

const LISTING_SUMMARY = 'listing:listings(id, title, city, photos, property_type, booking_mode)'

// What the host earns from a booking: the nights plus cleaning fee. The
// service fee is the platform's.
export function hostPayout(booking) {
  return booking.price_per_night * booking.nights + booking.cleaning_fee
}

export async function fetchMyTrips(travelerId) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`*, ${LISTING_SUMMARY}`)
    .eq('traveler_id', travelerId)
    .order('check_in', { ascending: false })
  if (error) throw error
  const trips = data ?? []
  const reviews = await fetchReviewsForBookings(trips.map((t) => t.id))
  return trips.map((trip) => ({ ...trip, review: reviews[trip.id] ?? null }))
}

// Bookings on the host's listings, each with the guest's name attached.
export async function fetchHostBookings(hostId) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`*, ${LISTING_SUMMARY}`)
    .eq('host_id', hostId)
    .order('check_in', { ascending: true })
  if (error) throw error

  const guestIds = [...new Set((data ?? []).map((b) => b.traveler_id))]
  let names = {}
  if (guestIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', guestIds)
    names = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))
  }
  return (data ?? []).map((b) => ({ ...b, guest_name: names[b.traveler_id] || 'Guest' }))
}

export async function respondToBooking(id, accept) {
  const { error } = await supabase.rpc('respond_to_booking', { p_booking_id: id, p_accept: accept })
  if (error) throw new Error(error.message)
}

// What the guest would get back if they cancelled now (worked out on the server
// from the listing's cancellation policy — see migration 015).
export async function fetchCancellationQuote(id) {
  const { data, error } = await supabase.rpc('cancellation_quote', { p_booking_id: id })
  if (error) throw new Error(error.message)
  return data
}

export async function cancelBooking(id) {
  const { error } = await supabase.rpc('cancel_booking', { p_booking_id: id })
  if (error) throw new Error(error.message)
}

export async function fetchBooking(id) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, listing:listings(id, title, city, address, photos, property_type, booking_mode)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const reviews = await fetchReviewsForBookings([data.id])
  return { ...data, review: reviews[data.id] ?? null }
}
