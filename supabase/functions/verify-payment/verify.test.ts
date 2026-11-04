// Run with: node --experimental-strip-types --test supabase/functions/verify-payment/verify.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { judgePayment, type PaystackVerifyResponse } from './verify.ts'

const payment = { amount: 4_500_000 } // ₦45,000 in kobo

const paid = (over: Partial<NonNullable<PaystackVerifyResponse['data']>> = {}): PaystackVerifyResponse => ({
  status: true,
  message: 'Verification successful',
  data: { status: 'success', amount: 4_500_000, currency: 'NGN', channel: 'card', gateway_response: 'Approved', ...over },
})

test('accepts a successful payment for the exact amount in NGN', () => {
  assert.deepEqual(judgePayment(true, paid(), payment), { ok: true, channel: 'card', gatewayResponse: 'Approved' })
})

test('rejects an underpayment, even by one kobo', () => {
  const v = judgePayment(true, paid({ amount: 4_499_999 }), payment)
  assert.equal(v.ok, false)
})

test('rejects a tampered small payment for an expensive booking', () => {
  assert.equal(judgePayment(true, paid({ amount: 10_000 }), payment).ok, false)
})

test('rejects an overpayment instead of silently accepting it', () => {
  assert.equal(judgePayment(true, paid({ amount: 9_000_000 }), payment).ok, false)
})

test('rejects the right number in the wrong currency', () => {
  assert.equal(judgePayment(true, paid({ currency: 'USD' }), payment).ok, false)
})

test('rejects a failed transaction and records it as failed', () => {
  const v = judgePayment(true, paid({ status: 'failed', gateway_response: 'Declined' }), payment)
  assert.deepEqual(v, { ok: false, status: 'failed', reason: 'Declined' })
})

test('records a closed popup as abandoned', () => {
  const v = judgePayment(true, paid({ status: 'abandoned', gateway_response: undefined }), payment)
  assert.equal(v.ok, false)
  assert.equal(v.ok === false && v.status, 'abandoned')
})

test('rejects when Paystack says status false (e.g. unknown reference)', () => {
  const v = judgePayment(true, { status: false, message: 'Transaction reference not found', data: null }, payment)
  assert.deepEqual(v, { ok: false, status: 'failed', reason: 'Transaction reference not found' })
})

test('rejects when the HTTP request to Paystack failed', () => {
  assert.equal(judgePayment(false, paid(), payment).ok, false)
})

test('rejects an empty or malformed response', () => {
  assert.equal(judgePayment(true, null, payment).ok, false)
  assert.equal(judgePayment(true, { status: true }, payment).ok, false)
})

test('rejects when the stored amount is not a whole number of kobo', () => {
  assert.equal(judgePayment(true, paid({ amount: 4_500_000.5 }), { amount: 4_500_000.5 }).ok, false)
})
