// Pure helpers for the Paystack webhook, free of Deno and Supabase APIs so they can be unit-tested.

const encoder = new TextEncoder()

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/**
 * Paystack signs every webhook with HMAC-SHA512 of the raw request body, keyed with your secret key,
 * and sends it in the x-paystack-signature header. Anyone can POST to the webhook URL, so nothing in the
 * body is trusted until this returns true. The comparison is done by the platform's HMAC verify, which is
 * constant-time, and the body must be the exact raw text (re-serialising JSON would change the bytes).
 */
export async function isValidSignature(rawBody: string, signatureHex: string | null, secret: string): Promise<boolean> {
  if (!signatureHex || !secret) return false
  const sig = hexToBytes(signatureHex)
  if (!sig) return false
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['verify'])
  return crypto.subtle.verify('HMAC', key, sig, encoder.encode(rawBody))
}

export interface ChargeEvent {
  event?: string
  data?: { reference?: string; status?: string; amount?: number; currency?: string; channel?: string; gateway_response?: string } | null
}

/** Pulls out the payment reference from a charge.success event, or null if this event is not one we act on. */
export function chargeSuccessReference(evt: ChargeEvent | null): string | null {
  if (evt?.event !== 'charge.success') return null
  const ref = evt.data?.reference
  return typeof ref === 'string' && ref.length > 0 ? ref : null
}
