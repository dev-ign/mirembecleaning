import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bookingJourneyKey } from '../lib/bookingJourney'

const config = vi.hoisted(() => ({ ga4Id: 'G-TEST123', metaPixelId: '39772457375733047', privacyPolicyUrl: 'https://www.mirembecleaning.com/privacy' }))
vi.mock('../config/marketing', () => ({ marketing: config }))

const metaEvents = (name: string) => window.fbq?.queue?.filter(entry => entry[2] === name) ?? []
const googleEvents = (name: string) => window.dataLayer?.filter(entry => entry[0] === 'event' && entry[1] === name) ?? []
const record = () => JSON.parse(sessionStorage.getItem(bookingJourneyKey) ?? 'null')
const go = (path: string) => history.replaceState(null, '', path)
const referrer = (value: string) => Object.defineProperty(document, 'referrer', { configurable: true, value })

beforeEach(() => {
  vi.resetModules()
  config.ga4Id = 'G-TEST123'
  config.metaPixelId = '39772457375733047'
  localStorage.clear()
  sessionStorage.clear()
  go('/')
  delete window.gtag
  delete window.fbq
  delete window._fbq
  delete window.dataLayer
  document.getElementById('mirembe-ga4')?.remove()
  document.getElementById('mirembe-meta-pixel')?.remove()
  referrer('')
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false })
})

async function visibleBooking() {
  go('/booking')
  const analytics = await import('../lib/analytics')
  analytics.setConsent('accepted')
  analytics.setBookingFormVisible(true)
  return analytics
}

describe('redirect-attributed holiday conversions', () => {
  it.each([
    [true, true], [true, false], [false, true], [false, false],
  ])('dispatches only established and currently eligible providers: Meta=%s GA4=%s', async (meta, ga4) => {
    config.metaPixelId = meta ? config.metaPixelId : ''
    config.ga4Id = ga4 ? config.ga4Id : ''
    const analytics = await visibleBooking()
    const pending = record()
    expect(Boolean(pending)).toBe(meta || ga4)
    if (pending) expect(pending.providers).toEqual({ meta, ga4 })
    go('/booking/thankyou')
    analytics.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(meta ? 1 : 0)
    expect(googleEvents('booking_complete')).toHaveLength(ga4 ? 1 : 0)
    if (meta) expect(metaEvents('Schedule')[0]).toEqual(['trackSingle', config.metaPixelId, 'Schedule', {
      attribution_method: 'thank_you_redirect', booking_type: 'holiday',
    }, { eventID: pending.id }])
    if (ga4) expect(googleEvents('booking_complete')[0]?.[2]).toMatchObject({
      attribution_method: 'thank_you_redirect', booking_type: 'holiday', page_path: '/booking/thankyou',
    })
    expect(metaEvents('Lead')).toHaveLength(0)
    expect(metaEvents('BookingRequestSubmitted')).toHaveLength(0)
  })

  it('preserves the original pending journey through repeated visibility, startup and document reloads', async () => {
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const analytics = await visibleBooking()
    const pending = record()
    clock.mockReturnValue(now + 10 * 60_000)
    analytics.setBookingFormVisible(true)
    analytics.startAnalytics()
    vi.resetModules()
    const reloaded = await import('../lib/analytics')
    reloaded.startAnalytics()
    reloaded.setBookingFormVisible(true)
    expect(record()).toEqual(pending)
    expect(metaEvents('Schedule')).toHaveLength(0)
    expect(googleEvents('booking_complete')).toHaveLength(0)
  })

  it('consumes before dispatch and survives duplicate redirects, aliases, refreshes and reacceptance', async () => {
    const analytics = await visibleBooking()
    const id = record().id
    go('/booking/thankyou')
    analytics.startAnalytics()
    expect(record()).toMatchObject({ status: 'consumed', id })
    analytics.startAnalytics()
    go('/booking/thank-you/')
    analytics.startAnalytics()
    vi.resetModules()
    const refreshed = await import('../lib/analytics')
    refreshed.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(1)
    expect(googleEvents('booking_complete')).toHaveLength(1)
    refreshed.setConsent('declined')
    refreshed.setConsent('accepted')
    // Withdrawal clears unsent provider queues, so retain dispatch observations separately.
    expect(record()).toBeNull()
    expect(metaEvents('Schedule')).toHaveLength(0)
    expect(googleEvents('booking_complete')).toHaveLength(0)
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('counts only once across a refresh and creates a new journey on a later form visit', async () => {
    const analytics = await visibleBooking()
    const firstId = record().id
    go('/booking/thank-you/index.html')
    analytics.startAnalytics()
    vi.resetModules()
    const refreshed = await import('../lib/analytics')
    refreshed.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(1)
    expect(googleEvents('booking_complete')).toHaveLength(1)
    go('/booking')
    refreshed.startAnalytics()
    refreshed.setBookingFormVisible(true)
    expect(record().id).not.toBe(firstId)
    go('/booking/thankyou')
    refreshed.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(2)
    expect(googleEvents('booking_complete')).toHaveLength(2)
  })

  it.each(['/booking/thankyou', '/booking/thank-you', '/booking/thankyou?success=true', '/booking/thankyou?token=fake'])('rejects direct %s without a journey', async path => {
    go(path)
    const analytics = await import('../lib/analytics')
    analytics.setConsent('accepted')
    analytics.setBookingFormVisible(true)
    analytics.startAnalytics()
    expect(record()).toBeNull()
    expect(metaEvents('Schedule')).toHaveLength(0)
    expect(googleEvents('booking_complete')).toHaveLength(0)
  })

  it('documents the false positive: manual thank-you navigation after an eligible form counts', async () => {
    const analytics = await visibleBooking()
    go('/booking/thankyou') // No booking submission occurred in this test.
    analytics.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(1)
    expect(googleEvents('booking_complete')).toHaveLength(1)
  })

  it.each([null, 'declined'] as const)('never replays a journey first observed with consent %s', async choice => {
    go('/booking')
    const analytics = await import('../lib/analytics')
    if (choice) analytics.setConsent(choice)
    analytics.setBookingFormVisible(true)
    expect(record()).toBeNull()
    go('/booking/thankyou')
    analytics.setConsent('accepted')
    expect(metaEvents('Schedule')).toHaveLength(0)
    expect(googleEvents('booking_complete')).toHaveLength(0)
  })

  it('withdraws synchronously even without the optional provider graph, and never resurrects the journey', async () => {
    await visibleBooking()
    vi.resetModules()
    const consent = await import('../lib/consent')
    consent.saveConsent('declined')
    expect(record()).toBeNull()
    consent.saveConsent('accepted')
    go('/booking/thankyou')
    const analytics = await import('../lib/analytics')
    analytics.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(0)
    expect(googleEvents('booking_complete')).toHaveLength(0)
  })

  it('honors GPC at establishment and dispatch, even with saved acceptance', async () => {
    const analytics = await visibleBooking()
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
    go('/booking/thankyou')
    analytics.startAnalytics()
    expect(record()).toBeNull()
    go('/booking')
    analytics.setBookingFormVisible(true)
    expect(record()).toBeNull()
    expect(metaEvents('Schedule')).toHaveLength(0)
    expect(googleEvents('booking_complete')).toHaveLength(0)
  })

  it.each(['meta', 'ga4'] as const)('does not retroactively add %s eligibility', async provider => {
    const field = provider === 'meta' ? 'metaPixelId' : 'ga4Id'
    const id = config[field]
    config[field] = ''
    const analytics = await visibleBooking()
    config[field] = id
    go('/booking/thankyou')
    analytics.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(provider === 'meta' ? 0 : 1)
    expect(googleEvents('booking_complete')).toHaveLength(provider === 'ga4' ? 0 : 1)
  })

  it.each(['meta', 'ga4'] as const)('losing %s eligibility preserves the other provider without a later replay', async provider => {
    const analytics = await visibleBooking()
    const field = provider === 'meta' ? 'metaPixelId' : 'ga4Id'
    const id = config[field]
    config[field] = ''
    go('/booking/thankyou')
    analytics.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(provider === 'meta' ? 0 : 1)
    expect(googleEvents('booking_complete')).toHaveLength(provider === 'ga4' ? 0 : 1)
    config[field] = id
    analytics.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(provider === 'meta' ? 0 : 1)
    expect(googleEvents('booking_complete')).toHaveLength(provider === 'ga4' ? 0 : 1)
  })

  it.each([
    ['invalid JSON', '{'], ['unsupported version', { version: 2 }], ['empty object', '{}'],
    ['wrong form', { formId: 'not-the-holiday-form' }], ['consumed', { status: 'consumed' }],
    ['invalid ID', { id: 'customer@example.com' }], ['wrong provider flags', { providers: { meta: 'yes', ga4: true } }],
    ['expired', { startedAt: Date.now() - 30 * 60_000 }], ['future timestamp', { startedAt: Date.now() + 60_000 }],
  ])('fails closed for %s state', async (_label, changes) => {
    const analytics = await visibleBooking()
    sessionStorage.setItem(bookingJourneyKey, typeof changes === 'string' ? changes : JSON.stringify({ ...record(), ...changes }))
    go('/booking/thankyou')
    expect(() => analytics.startAnalytics()).not.toThrow()
    expect(metaEvents('Schedule')).toHaveLength(0)
    expect(googleEvents('booking_complete')).toHaveLength(0)
  })

  it('expires at exactly 30 minutes from establishment, including after a booking reload', async () => {
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    await visibleBooking()
    clock.mockReturnValue(now + 20 * 60_000)
    vi.resetModules()
    const reloaded = await import('../lib/analytics')
    reloaded.startAnalytics()
    reloaded.setBookingFormVisible(true)
    expect(record().startedAt).toBe(now)
    clock.mockReturnValue(now + 30 * 60_000)
    go('/booking/thankyou')
    reloaded.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(0)
    expect(googleEvents('booking_complete')).toHaveLength(0)
  })

  it.each(['read', 'write', 'silent write', 'missing storage'] as const)('suppresses attribution on %s failure', async failure => {
    const originalGet = Storage.prototype.getItem
    const originalSet = Storage.prototype.setItem
    if (failure === 'missing storage') vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('disabled') })
    else if (failure === 'read') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (this === sessionStorage) throw new Error('blocked')
      return originalGet.call(this, key)
    })
    else vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (this === sessionStorage) {
        if (failure === 'write') throw new Error('quota')
        return
      }
      originalSet.call(this, key, value)
    })
    const analytics = await visibleBooking()
    go('/booking/thankyou')
    expect(() => analytics.startAnalytics()).not.toThrow()
    expect(metaEvents('Schedule')).toHaveLength(0)
    expect(googleEvents('booking_complete')).toHaveLength(0)
  })

  it('does not dispatch if the consumption write fails, even if storage later recovers', async () => {
    const analytics = await visibleBooking()
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    go('/booking/thankyou')
    analytics.startAnalytics()
    write.mockRestore()
    analytics.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(0)
    expect(googleEvents('booking_complete')).toHaveLength(0)
  })

  it.each([[true, false], [false, true], [true, true]])('isolates blocked loaders: Meta=%s GA4=%s', async (metaBlocked, gaBlocked) => {
    const analytics = await visibleBooking()
    if (metaBlocked) document.getElementById('mirembe-meta-pixel')!.dispatchEvent(new Event('error'))
    if (gaBlocked) document.getElementById('mirembe-ga4')!.dispatchEvent(new Event('error'))
    go('/booking/thankyou')
    expect(() => analytics.startAnalytics()).not.toThrow()
    expect(metaEvents('Schedule')).toHaveLength(metaBlocked ? 0 : 1)
    expect(googleEvents('booking_complete')).toHaveLength(gaBlocked ? 0 : 1)
    expect(record().status).toBe('consumed')
  })

  it.each(['meta', 'ga4'] as const)('isolates a throwing %s dispatcher', async provider => {
    const analytics = await visibleBooking()
    if (provider === 'meta') window.fbq = () => { throw new Error('blocked') }
    else window.gtag = () => { throw new Error('blocked') }
    go('/booking/thankyou')
    expect(() => analytics.startAnalytics()).not.toThrow()
    expect(provider === 'meta' ? googleEvents('booking_complete') : metaEvents('Schedule')).toHaveLength(1)
    expect(record().status).toBe('consumed')
  })

  it('withdraws queued unsent conversions without replaying after reacceptance', async () => {
    const analytics = await visibleBooking()
    go('/booking/thankyou')
    analytics.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(1)
    expect(googleEvents('booking_complete')).toHaveLength(1)
    analytics.setConsent('declined')
    analytics.setConsent('accepted')
    expect(metaEvents('Schedule')).toHaveLength(0)
    expect(googleEvents('booking_complete')).toHaveLength(0)
  })

  it('rechecks consent between provider calls if withdrawal occurs during dispatch', async () => {
    const analytics = await visibleBooking()
    const { saveConsent } = await import('../lib/consent')
    const gtag = window.gtag!
    window.gtag = (...args) => {
      gtag(...args)
      if (args[0] === 'event' && args[1] === 'booking_complete') saveConsent('declined')
    }
    go('/booking/thankyou')
    analytics.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(0)
    expect(record()).toBeNull()
  })
})

describe('thank-you referrer privacy exception', () => {
  it.each([
    ['', true],
    ['https://app.zenmaid.com/', true],
    ['https://app.zenmaid.com/book/mirembe-cleaning-company-holiday', true],
    ['https://app.zenmaid.com/booking-forms/V4Q5E/book', true],
    ['https://app.zenmaid.com/booking-forms/V4Q5E/bookings/new', true],
    ['https://app.zenmaid.com/customers/123', false],
    ['https://app.zenmaid.com/booking-forms/OTHER/book', false],
    ['https://app.zenmaid.com/book/mirembe-cleaning-company-holiday?email=private@example.com', false],
    ['https://app.zenmaid.com/book/mirembe-cleaning-company-holiday#private', false],
    ['https://app.zenmaid.com.evil.example/book/mirembe-cleaning-company-holiday', false],
    ['https://other.zenmaid.com/book/mirembe-cleaning-company-holiday', false],
    ['http://app.zenmaid.com/book/mirembe-cleaning-company-holiday', false],
    ['https://user:pass@app.zenmaid.com/book/mirembe-cleaning-company-holiday', false],
  ])('referrer %s allows Meta=%s without suppressing sanitized GA4', async (source, metaAllowed) => {
    const analytics = await visibleBooking()
    go('/booking/thankyou')
    referrer(source)
    analytics.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(metaAllowed ? 1 : 0)
    expect(googleEvents('booking_complete')).toHaveLength(1)
    expect(JSON.stringify(googleEvents('booking_complete'))).not.toMatch(/private|customers\/123|user:pass/)
    referrer('')
    analytics.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(metaAllowed ? 1 : 0)
  })

  it('does not broaden other routes, first-party checks or sensitive destination URL handling', async () => {
    const analytics = await visibleBooking()
    const { isSafeMetaContext } = await import('../lib/analytics/attribution')
    referrer('https://app.zenmaid.com/book/mirembe-cleaning-company-holiday')
    expect(isSafeMetaContext()).toBe(false) // Still on /booking.
    go('/booking/thank-you')
    expect(isSafeMetaContext()).toBe(true)
    referrer(`${window.location.origin}/booking?email=private@example.com`)
    expect(isSafeMetaContext()).toBe(false)
    referrer('https://app.zenmaid.com/book/mirembe-cleaning-company-holiday')
    go('/booking/thankyou?email=private@example.com')
    analytics.startAnalytics()
    expect(metaEvents('Schedule')).toHaveLength(0)
    expect(googleEvents('booking_complete')).toHaveLength(1)
    expect(JSON.stringify(googleEvents('booking_complete'))).not.toMatch(/private|email=|value|currency|revenue/)
  })
})

it.each(['es', 'ht', 'pt'])('preserves one holiday journey across %s booking, language changes and the unchanged vendor return', async code => {
  const analytics = await import('../lib/analytics')
  go('/' + code + '/booking')
  analytics.setConsent('accepted')
  analytics.setBookingFormVisible(true)
  const pending = record()
  expect(pending.formId).toBe('V4Q5E')
  go('/pt/booking')
  analytics.startAnalytics(); analytics.setBookingFormVisible(true)
  expect(record().id).toBe(pending.id)
  expect(googleEvents('booking_complete')).toHaveLength(0)
  expect(metaEvents('Schedule')).toHaveLength(0)
  go('/booking/thankyou')
  referrer('https://app.zenmaid.com/booking-forms/V4Q5E/book')
  analytics.startAnalytics()
  go('/' + code + '/booking/thankyou')
  analytics.startAnalytics(); analytics.startAnalytics()
  expect(googleEvents('booking_complete')).toHaveLength(1)
  expect(metaEvents('Schedule')).toHaveLength(1)
  expect(record()).toMatchObject({ id: pending.id, status: 'consumed' })
})

it('retains strict URL privacy and GPC enforcement on localized routes', async () => {
  const analytics = await import('../lib/analytics')
  const { isSafeMetaContext } = await import('../lib/analytics/attribution')
  go('/ht/booking?embed=basic')
  referrer(location.origin + '/es/')
  expect(isSafeMetaContext()).toBe(true)
  go('/ht/booking?email=private@example.com')
  expect(isSafeMetaContext()).toBe(false)
  go('/ht/unknown')
  expect(isSafeMetaContext()).toBe(false)
  go('/ht/booking')
  analytics.setConsent('accepted'); analytics.setBookingFormVisible(true)
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
  go('/ht/booking/thankyou')
  analytics.startAnalytics()
  expect(metaEvents('Schedule')).toHaveLength(0)
  expect(googleEvents('booking_complete')).toHaveLength(0)
  expect(record()).toBeNull()
})
