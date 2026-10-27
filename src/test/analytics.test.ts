import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config/marketing', () => ({ marketing: { ga4Id: 'G-TEST123', metaPixelId: '39772457375733047', privacyPolicyUrl: 'https://www.mirembecleaning.com/privacy' } }))

const metaEvents = (name: string) => window.fbq?.queue?.filter(entry => entry[2] === name) ?? []
const googleEvents = (name: string) => window.dataLayer?.filter(entry => entry[0] === 'event' && entry[1] === name) ?? []

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  sessionStorage.clear()
  history.replaceState(null, '', '/')
  delete window.gtag
  delete window.fbq
  delete window._fbq
  delete window.dataLayer
  document.getElementById('mirembe-ga4')?.remove()
  document.getElementById('mirembe-meta-pixel')?.remove()
  Object.defineProperty(document, 'referrer', { configurable: true, value: '' })
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false })
})

describe('consent-gated marketing events', () => {
  it.each(['accepted', 'declined'] as const)('honors a returning visitor’s saved %s choice', async choice => {
    const { consentKey } = await import('../lib/analytics/consent')
    localStorage.setItem(consentKey, choice)
    const analytics = await import('../lib/analytics')
    expect(analytics.getConsent()).toBe(choice)
    analytics.startAnalytics()
    analytics.startAnalytics()
    expect(metaEvents('PageView')).toHaveLength(choice === 'accepted' ? 1 : 0)
    expect(googleEvents('page_view')).toHaveLength(choice === 'accepted' ? 1 : 0)
  })

  it('honors initial GPC even with saved acceptance', async () => {
    const { consentKey } = await import('../lib/analytics/consent')
    localStorage.setItem(consentKey, 'accepted')
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
    const analytics = await import('../lib/analytics')
    analytics.startAnalytics()
    expect(analytics.getConsent()).toBe('declined')
    expect(window.fbq).toBeUndefined()
    expect(window.dataLayer).toBeUndefined()
  })

  it('requires consent even when initialization is called directly', async () => {
    const analytics = await import('../lib/analytics')
    analytics.startAnalytics()
    analytics.trackEvent('waitlist_signup_success', 'lead-1')
    expect(window.fbq).toBeUndefined()
    expect(window.dataLayer).toBeUndefined()
    analytics.setConsent('declined')
    analytics.startAnalytics()
    expect(document.getElementById('mirembe-meta-pixel')).toBeNull()
    expect(document.getElementById('mirembe-ga4')).toBeNull()
  })

  it('initializes one loader/init/PageView across repeated startup and route effects', async () => {
    const analytics = await import('../lib/analytics')
    analytics.setConsent('accepted')
    analytics.startAnalytics()
    analytics.trackPageView()
    analytics.startAnalytics()
    expect(document.querySelectorAll('#mirembe-meta-pixel')).toHaveLength(1)
    expect(window.fbq?.queue?.filter(entry => entry[0] === 'init')).toEqual([['init', '39772457375733047']])
    expect(window.fbq?.queue).toContainEqual(['set', 'autoConfig', false, '39772457375733047'])
    expect(metaEvents('PageView')).toHaveLength(1)
    expect(googleEvents('page_view')).toHaveLength(1)
    for (const path of ['/booking', '/booking/thankyou', '/']) {
      history.pushState(null, '', path)
      analytics.trackPageView()
      analytics.trackPageView()
    }
    expect(metaEvents('PageView')).toHaveLength(4)
    expect(googleEvents('page_view')).toHaveLength(4)
    expect(metaEvents('Lead')).toHaveLength(0)
    expect(metaEvents('BookingRequestSubmitted')).toHaveLength(0)
  })

  it('sends one new waitlist Lead with safe metadata and an unrelated event ID', async () => {
    const analytics = await import('../lib/analytics')
    analytics.setConsent('accepted')
    analytics.trackEvent('waitlist_signup_success')
    analytics.trackEvent('waitlist_signup_error')
    analytics.trackEvent('waitlist_form_submit')
    expect(metaEvents('Lead')).toHaveLength(0)
    analytics.trackEvent('waitlist_signup_success', 'persisted-id-1')
    analytics.trackEvent('waitlist_signup_success', 'persisted-id-1')
    analytics.trackEvent('hiring_application_success', 'app-1')
    expect(metaEvents('Lead')).toEqual([['trackSingle', '39772457375733047', 'Lead', { lead_type: 'waitlist' }, { eventID: expect.any(String) }]])
    expect(googleEvents('waitlist_signup_success')).toHaveLength(1)
    expect(JSON.stringify(window.fbq?.queue)).not.toContain('persisted-id-1')
    expect(JSON.stringify(window.dataLayer)).not.toContain('persisted-id-1')
    expect(metaEvents('HiringApplication')).toHaveLength(0)
    // A module reload models a new document with the same browser session.
    vi.resetModules()
    const reloaded = await import('../lib/analytics')
    reloaded.startAnalytics()
    reloaded.trackEvent('waitlist_signup_success', 'persisted-id-1')
    expect(metaEvents('Lead')).toHaveLength(1)
    reloaded.trackEvent('waitlist_signup_success', 'persisted-id-2')
    expect(metaEvents('Lead')).toHaveLength(2)
  })

  it('separates CTA activation, service detail views, and form visibility from conversion', async () => {
    history.replaceState(null, '', '/booking')
    const analytics = await import('../lib/analytics')
    const events = await import('../lib/analytics/events')
    analytics.setConsent('accepted')
    events.trackBookingCTA('hero')
    events.trackServiceView('deep')
    expect(metaEvents('BookingCTA_Click')[0]?.[3]).toEqual({ location: 'hero', campaign: 'holiday_2026' })
    expect(metaEvents('ViewContent')[0]?.[3]).toEqual({ content_type: 'service', content_name: 'deep' })
    expect(metaEvents('BookingFormView')).toHaveLength(0)
    analytics.setBookingFormVisible(true)
    analytics.setBookingFormVisible(true)
    analytics.startAnalytics()
    expect(metaEvents('BookingFormView')).toHaveLength(1)
    expect(metaEvents('InitiateCheckout')).toHaveLength(0)
    expect(metaEvents('BookingRequestSubmitted')).toHaveLength(0)
    expect(metaEvents('Lead')).toHaveLength(0)
  })

  it('emits a visible-form event when consent is granted after the form became visible', async () => {
    history.replaceState(null, '', '/booking')
    const analytics = await import('../lib/analytics')
    analytics.setBookingFormVisible(true)
    expect(metaEvents('BookingFormView')).toHaveLength(0)
    analytics.setConsent('accepted')
    expect(metaEvents('BookingFormView')).toHaveLength(1)
  })

  it.each(['/booking/thankyou', '/booking/thank-you', '/booking/thankyou?success=true', '/booking/thankyou?token=fake'])('never treats direct %s as booking evidence', async path => {
    history.replaceState(null, '', path)
    const analytics = await import('../lib/analytics')
    analytics.setConsent('accepted')
    analytics.setBookingFormVisible(true)
    analytics.startAnalytics()
    expect(metaEvents('BookingFormView')).toHaveLength(0)
    expect(metaEvents('BookingRequestSubmitted')).toHaveLength(0)
    expect(metaEvents('Lead')).toHaveLength(0)
  })

  it('suppresses Meta entirely on sensitive URLs and filters GA locations/referrers', async () => {
    history.replaceState(null, '', '/?utm_source=facebook&utm_campaign=holiday_2026&email=private%40example.com')
    Object.defineProperty(document, 'referrer', { configurable: true, value: 'https://example.org/?phone=1234567890' })
    const analytics = await import('../lib/analytics')
    analytics.setConsent('accepted')
    analytics.trackEvent('phone_click')
    expect(window.fbq).toBeUndefined()
    expect(document.getElementById('mirembe-meta-pixel')).toBeNull()
    const data = JSON.stringify(window.dataLayer)
    expect(data).toContain('holiday_2026')
    expect(data).not.toMatch(/private|phone=|1234567890|email=/)
  })

  it('captures reviewed campaign labels and fbclid only after consent, without forwarding IDs or arbitrary labels', async () => {
    history.replaceState(null, '', '/?utm_source=facebook&utm_campaign=holiday_2026&utm_term=Jane_Doe&fbclid=Abcdefghij_123')
    const analytics = await import('../lib/analytics')
    analytics.startAnalytics()
    expect(sessionStorage.length).toBe(0)
    analytics.setConsent('accepted')
    expect(sessionStorage.getItem('mirembe:fbclid:v1')).toBe('Abcdefghij_123')
    expect(sessionStorage.getItem('mirembe:first-touch:v1')).not.toContain('Jane_Doe')
    expect(JSON.stringify(window.dataLayer)).not.toMatch(/Jane_Doe|Abcdefghij_123/)
    expect(window.fbq).toBeUndefined() // Unreviewed term makes the real URL unsafe.
  })

  it('revokes consent, drops queued events, clears attribution/cookies, and supports reacceptance', async () => {
    const analytics = await import('../lib/analytics')
    analytics.setConsent('accepted')
    document.cookie = '_fbp=test; path=/'
    analytics.trackEvent('waitlist_signup_success', 'lead-1')
    analytics.setConsent('declined')
    analytics.trackEvent('waitlist_signup_success', 'lead-2')
    expect(metaEvents('Lead')).toHaveLength(0)
    expect(googleEvents('waitlist_signup_success')).toHaveLength(0)
    expect(window.fbq?.queue).toContainEqual(['consent', 'revoke'])
    expect(document.cookie).not.toContain('_fbp=')
    expect(sessionStorage.getItem('mirembe:first-touch:v1')).toBeNull()
    analytics.setConsent('accepted')
    analytics.trackEvent('waitlist_signup_success', 'lead-3')
    expect(metaEvents('Lead')).toHaveLength(1)
    expect(window.fbq?.queue?.filter(entry => entry[0] === 'init')).toHaveLength(1)
    expect(document.querySelectorAll('#mirembe-meta-pixel')).toHaveLength(1)
  })

  it('continues safely when scripts fail or providers throw', async () => {
    const analytics = await import('../lib/analytics')
    analytics.setConsent('accepted')
    document.getElementById('mirembe-meta-pixel')!.dispatchEvent(new Event('error'))
    document.getElementById('mirembe-ga4')!.dispatchEvent(new Event('error'))
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unavailable') })
    expect(() => analytics.trackEvent('waitlist_signup_success', 'lead-1')).not.toThrow()
    expect(metaEvents('Lead')).toHaveLength(0)
    window.fbq = Object.assign(() => { throw new Error('blocked') }, {})
    expect(() => analytics.startAnalytics()).not.toThrow()
    expect(() => analytics.setConsent('declined')).not.toThrow()
  })

  it('applies consent in memory when storage is blocked and honors GPC', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const analytics = await import('../lib/analytics')
    analytics.setConsent('accepted')
    expect(analytics.getConsent()).toBe('accepted')
    expect(metaEvents('PageView')).toHaveLength(1)
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
    analytics.setConsent('accepted')
    expect(analytics.getConsent()).toBe('declined')
    expect(() => analytics.trackEvent('waitlist_signup_success', 'lead-1')).not.toThrow()
    expect(metaEvents('Lead')).toHaveLength(0)
  })

  it('tracks one Terms view per document startup', async () => {
    history.replaceState(null, '', '/terms')
    const analytics = await import('../lib/analytics')
    analytics.setConsent('accepted')
    analytics.startAnalytics()
    analytics.trackEvent('booking_terms_click')
    expect(googleEvents('terms_view')).toHaveLength(1)
    expect(metaEvents('PageView')).toHaveLength(1)
  })
})

it.each([
  ['accepted', 'declined'],
  ['declined', 'accepted'],
] as const)('uses the latest %s → %s choice when storage is readable but unwritable', async (previous, next) => {
  const { consentKey, consentPersistenceFailed } = await import('../lib/consent')
  localStorage.setItem(consentKey, previous)
  const analytics = await import('../lib/analytics')
  analytics.startAnalytics()
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota exceeded') })
  analytics.setConsent(next)
  expect(analytics.getConsent()).toBe(next)
  expect(consentPersistenceFailed()).toBe(true)
  expect(localStorage.getItem(consentKey)).toBe(previous)
  if (next === 'declined') {
    expect(window.fbq?.queue).toContainEqual(['consent', 'revoke'])
    analytics.trackEvent('waitlist_signup_success', 'not-a-new-record')
    expect(metaEvents('Lead')).toHaveLength(0)
  } else expect(metaEvents('PageView')).toHaveLength(1)

  // A new document loses the volatile override; no cross-reload persistence is promised.
  vi.resetModules()
  expect((await import('../lib/consent')).getConsent()).toBe(previous)
  write.mockRestore()
})

it('returns to persisted consent after a failed write recovers and still honors GPC', async () => {
  const consent = await import('../lib/consent')
  localStorage.setItem(consent.consentKey, 'accepted')
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('quota exceeded') })
  consent.saveConsent('declined')
  expect(consent.getConsent()).toBe('declined')
  consent.saveConsent('accepted')
  expect(consent.consentPersistenceFailed()).toBe(false)
  expect(localStorage.getItem(consent.consentKey)).toBe('accepted')
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
  expect(consent.getConsent()).toBe('declined')
  consent.saveConsent('accepted')
  expect(localStorage.getItem(consent.consentKey)).toBe('declined')
  write.mockRestore()
})
