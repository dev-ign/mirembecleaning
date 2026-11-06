import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../config/marketing', () => ({ marketing: { ga4Id: 'G-PHASE0B', metaPixelId: '', privacyPolicyUrl: 'https://privacy.test/policy', debug: false } }))
const commands = () => window.dataLayer?.map(entry => Array.from(entry)) ?? []
const events = () => commands().filter(entry => entry[0] === 'event')

beforeEach(() => {
  vi.resetModules()
  localStorage.clear(); sessionStorage.clear()
  delete window.gtag; delete window.dataLayer; delete window.fbq; delete window._fbq
  document.querySelectorAll('#mirembe-ga4,#mirembe-meta-pixel').forEach(element => element.remove())
  history.replaceState(null, '', '/')
  document.title = 'Mirembe Cleaning'
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false })
  Object.defineProperty(document, 'referrer', { configurable: true, value: 'https://search.test/private-address?email=private@example.test' })
})

it('owns exactly one application event per funnel transition and never generates the account-created Ads event', async () => {
  const analytics = await import('../lib/analytics')
  const funnel = await import('../lib/analytics/events')
  analytics.setConsent('accepted')
  funnel.trackBookingCTA('hero')
  funnel.trackServiceView('deep')
  expect(events().map(entry => entry[1])).toEqual(['page_view', 'booking_cta_click', 'service_detail_view'])
  history.pushState(null, '', '/booking')
  analytics.startAnalytics(); analytics.startAnalytics()
  analytics.setBookingFormVisible(true); analytics.setBookingFormVisible(true)
  expect(events().filter(entry => entry[1] === 'booking_form_view')).toHaveLength(1)
  expect(events().filter(entry => entry[1] === 'booking_complete')).toHaveLength(0)
  history.pushState(null, '', '/booking/thankyou') // Browser return proxy only, no vendor submission.
  analytics.startAnalytics(); analytics.startAnalytics()
  analytics.trackEvent('waitlist_signup_success', 'synthetic-new-row')
  analytics.trackEvent('waitlist_signup_success', 'synthetic-new-row')
  expect(events().map(entry => entry[1])).toEqual([
    'page_view', 'booking_cta_click', 'service_detail_view', 'page_view', 'booking_form_view',
    'page_view', 'booking_complete', 'waitlist_signup_success',
  ])
  expect(events().find(entry => entry[1] === 'booking_complete')?.[2]).toMatchObject({ attribution_method: 'thank_you_redirect', booking_type: 'holiday' })
  expect(commands().filter(entry => entry[0] === 'config')).toHaveLength(1)
  const choices = commands().filter(entry => entry[0] === 'consent')
  expect(choices[0]).toEqual(['consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }])
  expect(choices.some(entry => entry[1] === 'update' && (entry[2] as Record<string, string>).analytics_storage === 'granted')).toBe(true)
  for (const choice of choices) expect(choice[2]).toMatchObject({ ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
})

it('excludes customer input and unreviewed identifiers from every exercised GA4 funnel payload', async () => {
  history.replaceState(null, '', '/?utm_source=google&utm_medium=cpc&utm_campaign=holiday_2026&utm_term=customer-name&gclid=opaque-google&gbraid=opaque-braid&wbraid=opaque-web&email=private@example.test#private-address')
  const field = document.createElement('input'); field.name = 'email'; field.value = 'private@example.test'; document.body.append(field)
  const analytics = await import('../lib/analytics')
  const funnel = await import('../lib/analytics/events')
  analytics.setConsent('accepted')
  funnel.trackBookingCTA('hero'); funnel.trackServiceView('rental')
  analytics.trackEvent('waitlist_form_submit')
  analytics.trackEvent('waitlist_signup_success', 'synthetic-database-id')
  analytics.trackLanguageChange('en', 'es')
  history.pushState(null, '', '/booking?email=private@example.test')
  analytics.startAnalytics(); analytics.setBookingFormVisible(true)
  history.pushState(null, '', '/es/booking/thankyou?token=customer-token')
  analytics.startAnalytics()
  const payload = JSON.stringify(events())
  expect(payload).not.toMatch(/private|customer-name|customer-token|opaque|gclid|gbraid|wbraid|synthetic-database-id|ads_conversion_|generate_lead/)
  for (const event of events()) expect(event[2]).toMatchObject({ send_to: 'G-PHASE0B', page_referrer: 'https://search.test' })
  field.remove()
})
