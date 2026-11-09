// Supabase Edge Function: paystack-webhook
//
// A second, independent way for a payment to be confirmed. verify-payment only runs if the guest's browser
// is still open after the Paystack popup; if they close the tab (or lose signal) right after paying, the
// money is taken but the booking stays unpaid. Paystack calls this URL server-to-server whenever a charge
// succeeds, so the booking is marked paid either way.
//
// Deploy WITHOUT JWT verification (Paystack is not a logged-in user; the HMAC signature is the authentication):
//   supabase functions deploy paystack-webhook --no-verify-jwt
// Then in the Paystack dashboard (Settings -> API Keys & Webhooks) set the webhook URL to:
//   https://<project-ref>.supabase.co/functions/v1/paystack-webhook
// Secrets: PAYSTACK_SECRET_KEY (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically).
//
// Safe to receive the same event many times: an already-successful payment is acknowledged and left alone.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { judgePayment } from '../verify-payment/verify.ts'
import { chargeSuccessReference, isValidSignature } from './webhook.ts'

const ok = (note: string) => new Response(JSON.stringify({ received: true, note }), { status: 200, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!secret) return new Response('Not configured', { status: 500 })

  // Raw text, not parsed JSON: the signature is over the exact bytes Paystack sent.
  const raw = await req.text()
  if (!(await isValidSignature(raw, req.headers.get('x-paystack-signature'), secret))) {
    return new Response('Invalid signature', { status: 401 })
  }

  let evt
  try {
    evt = JSON.parse(raw)
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const reference = chargeSuccessReference(evt)
  if (!reference) return ok('ignored event') // other event types are acknowledged so Paystack stops retrying

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: payment, error } = await admin.from('payments').select('*').eq('reference', reference).maybeSingle()
    if (error) throw error
    if (!payment) return ok('unknown reference') // not one of ours
    if (payment.status === 'success') return ok('already confirmed')

    // Same exact-amount, exact-currency rule as verify-payment, applied to the signed event data.
    const verdict = judgePayment(true, { status: true, data: evt.data }, payment)
    const now = new Date().toISOString()

    if (!verdict.ok) {
      await admin.from('payments').update({ status: verdict.status, gateway_response: verdict.reason, verified_at: now }).eq('id', payment.id)
      return ok('mismatch recorded')
    }

    await admin
      .from('payments')
      .update({ status: 'success', channel: verdict.channel, gateway_response: verdict.gatewayResponse, verified_at: now })
      .eq('id', payment.id)
    const { error: bookingError } = await admin
      .from('bookings')
      .update({ payment_status: 'paid', paid_at: now, payment_reference: reference })
      .eq('id', payment.booking_id)
    if (bookingError) throw bookingError

    return ok('confirmed')
  } catch (e) {
    console.error(e)
    return new Response('Temporary error', { status: 500 }) // non-2xx makes Paystack retry later
  }
})
