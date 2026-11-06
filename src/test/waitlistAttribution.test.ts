import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { privacyConfig } from '../config/legal'
import { saveConsent } from '../lib/consent'
import { getWaitlistAttributionPreview } from '../lib/waitlistAttribution'
import { createWaitlistEntry } from '../services/waitlistService'

const config = vi.hoisted(() => ({ waitlistAttributionPreviewEnabled: true }))
vi.mock('../config/waitlistAttribution', () => config)

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false })
  config.waitlistAttributionPreviewEnabled = true
  saveConsent('accepted')
  sessionStorage.setItem('mirembe:first-touch:v1', JSON.stringify({ utm_source: 'google', utm_campaign: 'holiday_2026', gclid: 'opaque' }))
  sessionStorage.setItem('mirembe:last-touch:v1', JSON.stringify({ utm_source: 'newsletter', utm_medium: 'email' }))
  sessionStorage.setItem('mirembe:fbclid:v1', 'not-for-the-waitlist')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true, data: { acknowledged: true } })))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('prepares reviewed metadata only in an explicitly enabled local preview', async () => {
  await createWaitlistEntry({ email: '  SYNTHETIC@Example.test ', source: 'landing_page' }, 'synthetic-token')
  const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
  expect(body).toEqual({ email: 'synthetic@example.test', turnstileToken: 'synthetic-token', attribution: {
    version: 1, consent: { analytics: true, globalPrivacyControl: false, policyVersion: privacyConfig.effectiveAt },
    firstTouch: { utm_source: 'google', utm_campaign: 'holiday_2026' },
    lastTouch: { utm_source: 'newsletter', utm_medium: 'email' },
  } })
  expect(JSON.stringify(body)).not.toMatch(/gclid|fbclid|opaque|not-for-the-waitlist/)
})

it.each(['disabled', 'declined', 'undecided', 'gpc'] as const)('keeps signup email-only when %s', async condition => {
  if (condition === 'disabled') config.waitlistAttributionPreviewEnabled = false
  if (condition === 'declined') saveConsent('declined')
  if (condition === 'undecided') localStorage.clear()
  if (condition === 'gpc') Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
  await expect(createWaitlistEntry({ email: 'synthetic@example.test', source: 'landing_page' }, 'synthetic-token'))
    .resolves.toMatchObject({ id: null })
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ email: 'synthetic@example.test', turnstileToken: 'synthetic-token' })
})

it('does not read campaign storage when preview is disabled or consent is denied', () => {
  const read = vi.spyOn(Storage.prototype, 'getItem')
  config.waitlistAttributionPreviewEnabled = false
  expect(getWaitlistAttributionPreview()).toBeUndefined()
  expect(read).not.toHaveBeenCalled()
  config.waitlistAttributionPreviewEnabled = true
  saveConsent('declined')
  expect(getWaitlistAttributionPreview()).toBeUndefined()
  expect(read.mock.calls.flat()).not.toContain('mirembe:first-touch:v1')
})

it.each([false, true])('drops a snapshot across withdrawal while reading, including reaccept=%s', reaccept => {
  const original = Storage.prototype.getItem
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
    if (key === 'mirembe:first-touch:v1') {
      saveConsent('declined')
      if (reaccept) saveConsent('accepted')
    }
    return original.call(this, key)
  })
  expect(getWaitlistAttributionPreview()).toBeUndefined()
})

it('continues signup if optional session storage is unavailable', async () => {
  const original = Storage.prototype.getItem
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
    if (key.startsWith('mirembe:first-') || key.startsWith('mirembe:last-')) throw new Error('blocked')
    return original.call(this, key)
  })
  await expect(createWaitlistEntry({ email: 'synthetic@example.test', source: 'landing_page' }, 'synthetic-token')).resolves.toMatchObject({ id: null })
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).not.toHaveProperty('attribution')
})
