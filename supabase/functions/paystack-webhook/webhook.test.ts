// Run with: node --experimental-strip-types --test supabase/functions/paystack-webhook/webhook.test.ts
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'
import { judgePayment } from '../verify-payment/verify.ts'
import { chargeSuccessReference, isValidSignature } from './webhook.ts'

const SECRET = 'sk_test_example_secret'
const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ref_123', status: 'success', amount: 11000000, currency: 'NGN' } })
// Independent implementation (node:crypto) so the test does not just check the code against itself.
const sign = (raw: string, secret = SECRET) => createHmac('sha512', secret).update(raw).digest('hex')

test('accepts a correctly signed body', async () => {
  assert.equal(await isValidSignature(body, sign(body), SECRET), true)
})

test('accepts an upper-case hex signature', async () => {
  assert.equal(await isValidSignature(body, sign(body).toUpperCase(), SECRET), true)
})

test('rejects a body changed by one character', async () => {
  assert.equal(await isValidSignature(body.replace('11000000', '1100000'), sign(body), SECRET), false)
})

test('rejects a signature made with a different secret', async () => {
  assert.equal(await isValidSignature(body, sign(body, 'sk_test_other'), SECRET), false)
})

test('rejects a missing, empty, odd-length or non-hex signature', async () => {
  for (const bad of [null, '', 'abc', 'zz'.repeat(64), sign(body).slice(0, -2)]) {
    assert.equal(await isValidSignature(body, bad, SECRET), false, String(bad))
  }
})

test('rejects everything when the secret is not configured', async () => {
  assert.equal(await isValidSignature(body, sign(body, ''), ''), false)
})

test('only charge.success events with a reference are acted on', () => {
  assert.equal(chargeSuccessReference(JSON.parse(body)), 'ref_123')
  assert.equal(chargeSuccessReference({ event: 'charge.failed', data: { reference: 'x' } }), null)
  assert.equal(chargeSuccessReference({ event: 'charge.success', data: {} }), null)
  assert.equal(chargeSuccessReference({ event: 'charge.success', data: { reference: '' } }), null)
  assert.equal(chargeSuccessReference(null), null)
})

test('a signed charge.success is still judged by the same exact-amount rule as verify-payment', () => {
  const evt = JSON.parse(body)
  const ok = judgePayment(true, { status: true, data: evt.data }, { amount: 11000000 })
  assert.equal(ok.ok, true)
  const short = judgePayment(true, { status: true, data: evt.data }, { amount: 11000001 })
  assert.equal(short.ok, false)
})
