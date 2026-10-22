import { marketing } from '../../config/marketing'
import { captureCampaign, getAttribution, safePageLocation } from './attribution'

export type MarketingEvent =
  | 'waitlist_cta_click' | 'waitlist_form_start' | 'waitlist_form_submit' | 'waitlist_signup_success' | 'waitlist_signup_error'
  | 'hiring_cta_click' | 'hiring_form_start' | 'hiring_form_submit'
  | 'hiring_application_success' | 'hiring_application_error'

type Consent = 'accepted' | 'declined' | null
type Gtag = (...args: unknown[]) => void
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[][]; loaded?: boolean; version?: string }

declare global {
  interface Window { dataLayer?: unknown[][]; gtag?: Gtag; fbq?: Fbq; _fbq?: Fbq }
}

// A new provider or ID requires a fresh choice rather than inheriting consent.
const consentKey = `mirembe:marketing-consent:v1:${marketing.ga4Id}:${marketing.metaPixelId}`
let active = false
const sentConversions = new Set<string>()

export function browserOptedOut(): boolean {
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
}

export function hasConfiguredProvider(): boolean {
  return Boolean(marketing.ga4Id || marketing.metaPixelId)
}

export function getConsent(): Consent {
  if (browserOptedOut()) return 'declined'
  try {
    const value = localStorage.getItem(consentKey)
    return value === 'accepted' || value === 'declined' ? value : null
  } catch { return null }
}

export function setConsent(value: Exclude<Consent, null>): void {
  if (value === 'accepted' && browserOptedOut()) return
  try { localStorage.setItem(consentKey, value) } catch { /* Consent still applies to this page. */ }
  if (value === 'accepted') startAnalytics()
  else {
    const wasActive = active
    active = false
    try {
      sessionStorage.removeItem('mirembe:first-touch:v1')
      sessionStorage.removeItem('mirembe:last-touch:v1')
    } catch { /* Storage may be blocked. */ }
    if (wasActive) window.location.reload()
  }
}

function addScript(url: string, id: string) {
  if (document.getElementById(id)) return
  const script = document.createElement('script')
  script.id = id
  script.async = true
  script.src = url
  document.head.appendChild(script)
}

export function startAnalytics(): void {
  if (active || !hasConfiguredProvider() || browserOptedOut()) return
  active = true
  captureCampaign(window.location.search)

  if (marketing.ga4Id) {
    window.dataLayer ??= []
    window.gtag ??= (...args: unknown[]) => { window.dataLayer!.push(args) }
    window.gtag('js', new Date())
    window.gtag('config', marketing.ga4Id, { send_page_view: false })
    window.gtag('event', 'page_view', {
      page_location: safePageLocation(window.location.search),
      page_path: '/',
      page_title: document.title,
    })
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(marketing.ga4Id)}`, 'mirembe-ga4')
  }

  if (marketing.metaPixelId) {
    if (!window.fbq) {
      const queue: unknown[][] = []
      const fbq: Fbq = (...args: unknown[]) => { if (fbq.callMethod) fbq.callMethod(...args); else queue.push(args) }
      fbq.queue = queue
      fbq.loaded = true
      fbq.version = '2.0'
      window.fbq = fbq
      window._fbq = fbq
    }
    window.fbq('init', marketing.metaPixelId)
    window.fbq('track', 'PageView')
    addScript('https://connect.facebook.net/en_US/fbevents.js', 'mirembe-meta-pixel')
  }
}

export function trackEvent(event: MarketingEvent, conversionId?: string): void {
  if (!active) return
  const isConversion = event === 'waitlist_signup_success' || event === 'hiring_application_success'
  if (isConversion && conversionId) {
    const key = `${event}:${conversionId}`
    if (sentConversions.has(key)) return
    sentConversions.add(key)
  }

  try {
    if (marketing.ga4Id) {
      const attribution = getAttribution()
      window.gtag?.('event', event, {
        page_path: '/',
        ...Object.fromEntries(Object.entries(attribution.firstTouch).map(([key, value]) => [`first_${key}`, value])),
        ...attribution.lastTouch,
      })
    }
    // Only a newly created customer waitlist row is a Meta Lead.
    if (marketing.metaPixelId && event === 'waitlist_signup_success') window.fbq?.('track', 'Lead')
  } catch { /* Tracking can be blocked without affecting a form. */ }
}
