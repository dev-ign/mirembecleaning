import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config/marketing', () => ({ marketing: { ga4Id: 'G-TEST123', metaPixelId: '1234567890', privacyPolicyUrl: 'https://www.mirembecleaning.com/privacy' } }))

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  sessionStorage.clear()
  history.replaceState(null, '', '/?utm_source=google&utm_campaign=autumn&email=private%40example.com')
  delete window.gtag
  delete window.fbq
  delete window._fbq
  delete window.dataLayer
  document.getElementById('mirembe-ga4')?.remove()
  document.getElementById('mirembe-meta-pixel')?.remove()
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false })
})

describe('consent-gated analytics', () => {
  it('loads only after consent, sends no contact data, and counts one new Lead', async () => {
    const analytics = await import('../lib/analytics')
    analytics.trackEvent('waitlist_signup_success', 'lead-1')
    expect(document.getElementById('mirembe-ga4')).toBeNull()
    expect(document.getElementById('mirembe-meta-pixel')).toBeNull()

    analytics.setConsent('accepted')
    expect(document.getElementById('mirembe-ga4')).not.toBeNull()
    expect(document.getElementById('mirembe-meta-pixel')).not.toBeNull()
    analytics.trackEvent('waitlist_signup_success', 'lead-1')
    analytics.trackEvent('waitlist_signup_success', 'lead-1')
    analytics.trackEvent('hiring_application_success', 'app-1')

    const events = window.dataLayer!.filter((entry) => entry[0] === 'event')
    expect(events.filter((entry) => entry[1] === 'waitlist_signup_success')).toHaveLength(1)
    expect(events.filter((entry) => entry[1] === 'hiring_application_success')).toHaveLength(1)
    expect(JSON.stringify(events)).not.toContain('private@example.com')
    expect(JSON.stringify(events)).not.toContain('lead-1')
    expect(window.fbq?.queue?.filter((entry) => entry[1] === 'Lead')).toHaveLength(1)
  })

  it('honors a browser privacy opt-out even after a stored acceptance', async () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
    const analytics = await import('../lib/analytics')
    analytics.setConsent('accepted')
    analytics.startAnalytics()
    expect(analytics.getConsent()).toBe('declined')
    expect(document.getElementById('mirembe-ga4')).toBeNull()
    expect(document.getElementById('mirembe-meta-pixel')).toBeNull()
  })
})
