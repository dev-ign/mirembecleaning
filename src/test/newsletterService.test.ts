import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewsletterRequestError, subscribeToNewsletter } from '../services/newsletterService'
import { newsletterConsent } from '../shared/newsletter'
import { resources } from '../i18n'
import { localeCodes } from '../i18n/config'

afterEach(() => vi.unstubAllGlobals())
describe('newsletter request client and consent record', () => {
  it('sends only explicit consent, locale and fresh verification to the dedicated endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true, data: { acknowledged: true } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(subscribeToNewsletter('  Name.Tag+Tips@EXAMPLE.TEST ', 'ht', 'fresh')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/newsletter/subscribe', expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'Name.Tag+Tips@example.test', locale: 'ht', turnstileToken: 'fresh', marketingConsent: true, consentVersion: newsletterConsent.version })
  })
  it.each([
    [400, { error: { code: 'VERIFICATION_FAILED' } }, 'verification'],
    [400, { ok: false }, 'invalid'], [429, {}, 'rate_limited'], [503, {}, 'unavailable'],
    [200, { ok: true, data: { subscribed: true } }, 'unavailable'],
    [201, { ok: true, data: { acknowledged: true } }, 'unavailable'],
  ])('handles HTTP %s with a safe %s outcome', async (status, payload, kind) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload, { status })))
    await expect(subscribeToNewsletter('a@example.test', 'en', 'fresh')).rejects.toMatchObject({ kind })
  })
  it('handles network and malformed-response failures without automatic retries', async () => {
    const mock = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Response('not JSON'))
    vi.stubGlobal('fetch', mock)
    await expect(subscribeToNewsletter('a@example.test', 'en', 'fresh')).rejects.toBeInstanceOf(NewsletterRequestError)
    await expect(subscribeToNewsletter('a@example.test', 'en', 'fresh')).rejects.toMatchObject({ kind: 'unavailable' })
    expect(mock).toHaveBeenCalledTimes(2)
  })
  it('matches the versioned disclosure and approved policy in every locale', () => {
    for (const locale of localeCodes) expect(newsletterConsent.disclosure[locale]).toBe(resources[locale]['newsletter.disclosure'])
    expect(newsletterConsent.privacyPolicyVersion).toBe('2026-11-17')
    expect(newsletterConsent.privacyPolicyUrl).toBe('https://www.mirembecleaning.com/privacy')
  })
})
