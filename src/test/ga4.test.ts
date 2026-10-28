import { beforeEach, expect, it, vi } from 'vitest'

const config = vi.hoisted(() => ({ ga4Id: 'G-TEST123', metaPixelId: '39772457375733047', privacyPolicyUrl: 'https://www.mirembecleaning.com/privacy', debug: false }))
vi.mock('../config/marketing', () => ({ marketing: config }))
const commands = () => window.dataLayer?.map(entry => Array.from(entry)) ?? []
const events = (name: string) => commands().filter(entry => entry[0] === 'event' && entry[1] === name)
const denied = { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }

beforeEach(() => {
  vi.resetModules()
  config.ga4Id = 'G-TEST123'
  config.debug = false
  localStorage.clear()
  sessionStorage.clear()
  history.replaceState(null, '', '/')
  document.title = 'Mirembe Cleaning'
  delete window.gtag
  delete window.dataLayer
  delete window.fbq
  delete window._fbq
  document.getElementById('mirembe-ga4')?.remove()
  document.getElementById('mirembe-meta-pixel')?.remove()
  Object.defineProperty(document, 'referrer', { configurable: true, value: '' })
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false })
})

it('queues denied defaults then analytics-only consent before configuration, using Google’s Arguments contract', async () => {
  const analytics = await import('../lib/analytics')
  analytics.startAnalytics()
  expect(window.dataLayer).toBeUndefined()
  expect(document.getElementById('mirembe-ga4')).toBeNull()
  analytics.setConsent('accepted')
  analytics.startAnalytics()
  expect(commands().slice(0, 4)).toEqual([
    ['consent', 'default', denied],
    ['consent', 'update', { ...denied, analytics_storage: 'granted' }],
    ['js', expect.any(Date)],
    ['config', config.ga4Id, expect.objectContaining({ send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false })],
  ])
  expect(Object.prototype.toString.call(window.dataLayer![0])).toBe('[object Arguments]')
  expect(commands().filter(entry => entry[0] === 'config')).toHaveLength(1)
  expect(events('page_view')).toHaveLength(1)
  expect(document.querySelectorAll('#mirembe-ga4')).toHaveLength(1)
  const script = document.getElementById('mirembe-ga4') as HTMLScriptElement
  expect(script.async).toBe(true)
  expect(script.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${config.ga4Id}`)
})

it('scopes every event to the configured destination and supplies a title and sanitized location', async () => {
  const original = '/?gclid=opaque-google-id&gbraid=opaque-braid&wbraid=opaque-web&utm_source=google&utm_medium=cpc&utm_campaign=holiday_2026&email=private%40example.com'
  history.replaceState(null, '', original)
  const analytics = await import('../lib/analytics')
  analytics.setConsent('accepted')
  analytics.trackEvent('phone_click')
  for (const event of events('page_view').concat(events('phone_click'))) {
    expect(event[2]).toMatchObject({ send_to: config.ga4Id, page_title: document.title, page_path: '/' })
    expect(JSON.stringify(event)).not.toMatch(/private|opaque-|email=/)
  }
  expect(events('page_view')[0][2]).toMatchObject({ page_location: `${location.origin}/?utm_source=google&utm_medium=cpc&utm_campaign=holiday_2026` })
  expect(location.pathname + location.search).toBe(original)
  expect(sessionStorage.getItem('gclid')).toBeNull()
})

it('tracks only the current route when acceptance follows untracked browsing', async () => {
  const analytics = await import('../lib/analytics')
  analytics.startAnalytics()
  history.pushState(null, '', '/terms')
  analytics.startAnalytics()
  history.pushState(null, '', '/privacy')
  analytics.setConsent('accepted')
  expect(events('page_view')).toHaveLength(1)
  expect(events('page_view')[0][2]).toMatchObject({ page_path: '/privacy' })
})

it.each([false, true])('withdraws during loading/after load (loaded=%s), clears GA cookies and blocks later events', async loaded => {
  const analytics = await import('../lib/analytics')
  analytics.setConsent('accepted')
  const loader = document.getElementById('mirembe-ga4')!
  if (loaded) loader.dispatchEvent(new Event('load'))
  document.cookie = '_ga=example; path=/'
  document.cookie = '_ga_TEST123=example; path=/'
  analytics.setConsent('declined')
  const count = events('page_view').length
  history.pushState(null, '', '/booking')
  analytics.startAnalytics()
  analytics.trackEvent('phone_click')
  analytics.setBookingFormVisible(true)
  loader.dispatchEvent(new Event('load'))
  expect(commands().at(-1)).toEqual(['consent', 'update', denied])
  expect(events('page_view')).toHaveLength(count)
  expect(events('phone_click')).toHaveLength(0)
  expect(events('booking_form_view')).toHaveLength(0)
  expect(document.cookie).not.toMatch(/_ga/)
  expect((window as unknown as Record<string, unknown>)[`ga-disable-${config.ga4Id}`]).toBe(true)
  if (!loaded) expect(commands().some(entry => entry[0] === 'event')).toBe(false)
})

it('does not replay queued events after rapid accept/decline/reaccept while Google is loading', async () => {
  const analytics = await import('../lib/analytics')
  analytics.setConsent('accepted')
  analytics.trackEvent('phone_click')
  analytics.setConsent('declined')
  history.pushState(null, '', '/privacy')
  analytics.setConsent('accepted')
  document.getElementById('mirembe-ga4')!.dispatchEvent(new Event('load'))
  expect(events('phone_click')).toHaveLength(0)
  expect(events('page_view')).toHaveLength(1)
  expect(events('page_view')[0][2]).toMatchObject({ page_path: '/privacy' })
  expect(commands().filter(entry => entry[0] === 'config')).toHaveLength(1)
  expect(document.querySelectorAll('#mirembe-ga4')).toHaveLength(1)
})

it('revokes queued Google events if GPC becomes active', async () => {
  const analytics = await import('../lib/analytics')
  analytics.setConsent('accepted')
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
  analytics.trackEvent('phone_click')
  expect(commands().filter(entry => entry[0] === 'event')).toHaveLength(0)
  expect(commands().at(-1)).toEqual(['consent', 'update', denied])
})

it('drops failed Google queues without blocking Meta or interactions', async () => {
  const analytics = await import('../lib/analytics')
  analytics.setConsent('accepted')
  document.getElementById('mirembe-ga4')!.dispatchEvent(new Event('error'))
  expect(() => analytics.trackEvent('phone_click')).not.toThrow()
  history.pushState(null, '', '/privacy')
  expect(() => analytics.startAnalytics()).not.toThrow()
  expect(commands().filter(entry => entry[0] === 'event')).toHaveLength(0)
  expect(window.fbq?.queue?.filter(entry => entry[2] === 'PageView')).toHaveLength(2)
})

it('keeps Meta working with no Google configuration', async () => {
  config.ga4Id = ''
  const analytics = await import('../lib/analytics')
  expect(() => analytics.setConsent('accepted')).not.toThrow()
  expect(window.dataLayer).toBeUndefined()
  expect(document.getElementById('mirembe-ga4')).toBeNull()
  expect(window.fbq?.queue?.filter(entry => entry[2] === 'PageView')).toHaveLength(1)
})

it.each([false, true])('logs fixed event names and adds debug_mode only with development debugging enabled (%s)', async enabled => {
  config.debug = enabled
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  const analytics = await import('../lib/analytics')
  analytics.startAnalytics()
  analytics.setConsent('accepted')
  const configuration = commands().find(entry => entry[0] === 'config')![2]
  if (enabled) {
    expect(configuration).toHaveProperty('debug_mode', true)
    expect(log).toHaveBeenCalledWith('[analytics]', expect.objectContaining({ action: 'queued', event: 'page_view', consent: 'accepted' }))
    expect(log).toHaveBeenCalledWith('[analytics]', expect.objectContaining({ action: 'suppressed', consent: null }))
  } else {
    expect(configuration).not.toHaveProperty('debug_mode')
    expect(log).not.toHaveBeenCalled()
  }
})
