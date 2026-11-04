// Supabase Edge Function: verify-payment
//
// Called by the app after the Paystack popup reports success. It asks
// Paystack directly whether the payment really went through for the right
// amount, and only then marks the booking as paid. The Paystack SECRET key
// lives only here, as a Supabase secret — never in the browser.
//
// Secrets needed (Supabase → Edge Functions → Secrets):
//   PAYSTACK_SECRET_KEY = sk_test_...
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { judgePayment } from './verify.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { reference } = await req.json()
    if (!reference || typeof reference !== 'string') return json({ error: 'Missing payment reference.' }, 400)

    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!secretKey) return json({ error: 'Payments are not set up yet (missing PAYSTACK_SECRET_KEY).' }, 500)

    // Service-role client: can update payments and bookings, which the
    // browser is not allowed to do.
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Who is calling? Only the traveller who started the payment may verify it.
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: userData } = await admin.auth.getUser(token)
    const user = userData?.user
    if (!user) return json({ error: 'Please log in again.' }, 401)

    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .select('*')
      .eq('reference', reference)
      .maybeSingle()
    if (paymentError) throw paymentError
    if (!payment || payment.traveler_id !== user.id) return json({ error: 'Payment not found.' }, 404)
    if (payment.status === 'success') return json({ status: 'success' }) // already verified

    // Ask Paystack for the truth.
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    const body = await res.json().catch(() => null)
    const verdict = judgePayment(res.ok, body, payment)

    if (!verdict.ok) {
      await admin
        .from('payments')
        .update({ status: verdict.status, gateway_response: verdict.reason, verified_at: new Date().toISOString() })
        .eq('id', payment.id)

      return json(
        {
          error: `We couldn't confirm this payment with Paystack. If money left your account, email support with reference ${reference}.`,
        },
        402,
      )
    }

    const now = new Date().toISOString()
    await admin
      .from('payments')
      .update({ status: 'success', channel: verdict.channel, gateway_response: verdict.gatewayResponse, verified_at: now })
      .eq('id', payment.id)

    const { error: bookingError } = await admin
      .from('bookings')
      .update({ payment_status: 'paid', paid_at: now, payment_reference: reference })
      .eq('id', payment.booking_id)
    if (bookingError) throw bookingError

    return json({ status: 'success' })
  } catch (error) {
    console.error(error)
    return json({ error: 'Something went wrong while confirming your payment. Please try again.' }, 500)
  }
})
