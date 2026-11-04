// Pure decision logic for verify-payment, kept free of Deno and Supabase APIs
// so it can be unit-tested (see verify.test.ts).

export interface StoredPayment {
  amount: number // kobo, as saved when the booking was created
}

export interface PaystackVerifyResponse {
  status?: boolean
  message?: string
  data?: {
    status?: string
    amount?: number
    currency?: string
    channel?: string
    gateway_response?: string
  } | null
}

export type Verdict =
  | { ok: true; channel?: string; gatewayResponse?: string }
  | { ok: false; status: 'failed' | 'abandoned'; reason: string }

/**
 * Decides whether a Paystack verify response proves that the stored payment
 * was made in full. Every condition must hold: HTTP OK, Paystack says true,
 * the transaction succeeded, the amount matches to the kobo, and it was in NGN.
 */
export function judgePayment(httpOk: boolean, body: PaystackVerifyResponse | null, payment: StoredPayment): Verdict {
  const tx = body?.data ?? undefined
  const fail = (reason: string): Verdict => ({
    ok: false,
    status: tx?.status === 'abandoned' ? 'abandoned' : 'failed',
    reason: tx?.gateway_response ?? body?.message ?? reason,
  })

  if (!httpOk) return fail('Paystack request failed')
  if (body?.status !== true) return fail('Paystack did not confirm the transaction')
  if (!tx || tx.status !== 'success') return fail('Transaction was not successful')
  if (!Number.isInteger(payment.amount) || tx.amount !== payment.amount) return fail('Amount does not match the booking')
  if (tx.currency !== 'NGN') return fail('Currency is not NGN')

  return { ok: true, channel: tx.channel, gatewayResponse: tx.gateway_response }
}
