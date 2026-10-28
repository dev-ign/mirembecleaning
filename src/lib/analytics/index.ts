import { resolveSiteRoute } from '../../i18n/routes'
import { isSupportedLocale } from '../../i18n/config'
import { marketing } from '../../config/marketing'
import { bookingConfig } from '../../config/booking'
import { consumeBookingJourney, establishBookingJourney, revokeBookingJourney, type BookingProviders } from '../bookingJourney'
import { termsConfig } from '../../config/legal'
import { captureCampaign, clearAttribution, getAttribution, safePageLocation, safePagePath } from './attribution'
import { browserOptedOut, getConsent, hasConfiguredProvider, saveConsent } from './consent'
import { isMetaEligible, revokeMetaConsent, sendMetaEvent } from './metaPixel'
import type { Consent, MetaEvent } from './types'

export { browserOptedOut, getConsent, hasConfiguredProvider } from './consent'
export type MarketingEvent =
  | 'phone_click' | 'booking_fallback_click' | 'terms_view' | 'booking_terms_click'
  | 'waitlist_cta_click' | 'waitlist_form_start' | 'waitlist_form_submit' | 'waitlist_signup_success' | 'waitlist_signup_error'
  | 'hiring_cta_click' | 'hiring_form_start' | 'hiring_form_submit'
  | 'hiring_application_success' | 'hiring_application_error'

let gaInitialized = false
let gaFailed = false
let gaLoaded = false
let lastPage: string | undefined
let lastMetaPage: string | undefined
let formVisible = false
let formViewSent = false
const sentConversions = new Set<string>()
const deniedConsent = { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' } as const
const analyticsConsent = { ...deniedConsent, analytics_storage: 'granted' } as const

function debug(action: string, event?: string): void {
  if (!marketing.debug) return
  // Fixed event names and eligibility only; never log URLs, payloads or identifiers.
  // eslint-disable-next-line no-console
  console.info('[analytics]', { action, event, consent: getConsent(), ga4Configured: Boolean(marketing.ga4Id), gaFailed })
}

function eligible(): boolean {
  const allowed = getConsent() === 'accepted' && hasConfiguredProvider() && !browserOptedOut()
  if (!allowed) {
    if (gaInitialized) stopAnalytics()
    debug('suppressed')
  }
  return allowed
}

export function setConsent(value: Exclude<Consent, null>): void {
  saveConsent(value)
  if (getConsent() === 'accepted') startAnalytics()
  else stopAnalytics()
}

export function stopAnalytics(): void {
  revokeBookingJourney()
  revokeMetaConsent()
  if (marketing.ga4Id) {
    ;(window as unknown as Record<string, unknown>)[`ga-disable-${marketing.ga4Id}`] = true
    if (!gaLoaded && window.dataLayer) {
      const setup = window.dataLayer.filter(entry => entry[0] !== 'event' && entry[0] !== 'consent')
      window.dataLayer.length = 0
      try { window.gtag?.('consent', 'default', deniedConsent) } catch { /* Optional provider. */ }
      window.dataLayer.push(...setup)
      // Unsent views were discarded; reacceptance may measure the current page.
      lastPage = undefined
    }
    try { window.gtag?.('consent', 'update', deniedConsent) } catch { /* Optional provider. */ }
  }
  clearAttribution()
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim()
    if (!/^(_fbp|_fbc|_ga(?:_.*)?|_gid)$/.test(name)) continue
    document.cookie = `${name}=; Max-Age=0; path=/`
    const parts = window.location.hostname.split('.')
    for (let i = 0; i < parts.length - 1; i++) document.cookie = `${name}=; Max-Age=0; path=/; domain=.${parts.slice(i).join('.')}`
  }
  debug('consent-denied')
}

function startGoogle(): void {
  if (!marketing.ga4Id || gaFailed || getConsent() !== 'accepted') return
  ;(window as unknown as Record<string, unknown>)[`ga-disable-${marketing.ga4Id}`] = false
  if (gaInitialized) {
    window.gtag?.('consent', 'update', analyticsConsent)
    return
  }
  window.dataLayer ??= []
  // Match Google's command queue contract (Arguments objects, not dataLayer arrays).
  // eslint-disable-next-line prefer-rest-params
  window.gtag ??= function () { window.dataLayer!.push(arguments) }
  // Basic mode: this queue and the external script exist only after permission.
  window.gtag('consent', 'default', deniedConsent)
  window.gtag('consent', 'update', analyticsConsent)
  window.gtag('js', new Date())
  window.gtag('config', marketing.ga4Id, {
    send_page_view: false, page_location: safePageLocation(window.location.search),
    page_referrer: safeReferrer(), allow_google_signals: false, allow_ad_personalization_signals: false,
    ...(marketing.debug ? { debug_mode: true } : {}),
  })
  gaInitialized = true
  if (!document.getElementById('mirembe-ga4')) {
    const script = document.createElement('script')
    script.id = 'mirembe-ga4'
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(marketing.ga4Id)}`
    script.referrerPolicy = 'origin'
    script.onload = () => {
      gaLoaded = true
      if (getConsent() !== 'accepted') stopAnalytics()
      debug('script-loaded')
    }
    script.onerror = () => {
      gaFailed = true
      if (window.dataLayer) {
        const setup = window.dataLayer.filter(entry => entry[0] !== 'event')
        window.dataLayer.splice(0, window.dataLayer.length, ...setup)
      }
      debug('script-failed')
    }
    document.head.appendChild(script)
  }
  debug('initialized')
}

function safeReferrer(): string {
  try { return document.referrer ? new URL(document.referrer).origin : '' } catch { return '' }
}

function googleEvent(name: string, data: Record<string, string> = {}): void {
  if (!marketing.ga4Id || gaFailed || !gaInitialized || getConsent() !== 'accepted') { debug('suppressed', name); return }
  try {
    const attribution = getAttribution()
    window.gtag?.('event', name, {
      page_path: safePagePath(), page_location: safePageLocation(window.location.search), page_referrer: safeReferrer(),
      page_title: document.title, send_to: marketing.ga4Id,
      ...Object.fromEntries(Object.entries(attribution.firstTouch).map(([key, value]) => [`first_${key}`, value])),
      ...attribution.lastTouch, ...data,
    })
    debug('queued', name)
  } catch { /* Tracking failure cannot block any interaction. */ }
}

export function startAnalytics(): void {
  if (!eligible()) { revokeBookingJourney(); return }
  captureCampaign(window.location.search)
  try { startGoogle() } catch { gaFailed = true }
  trackPageView()
  if (resolveSiteRoute(safePagePath()).basePath === bookingConfig.thankYouPath) trackBookingCompletion()
  if (formVisible) setBookingFormVisible(true)
}

function bookingProviders(): BookingProviders {
  return { meta: isMetaEligible(), ga4: getConsent() === 'accepted' && Boolean(marketing.ga4Id) && !gaFailed }
}

function trackBookingCompletion(): void {
  const attempt = consumeBookingJourney(bookingProviders())
  if (!attempt) return
  const data = { attribution_method: 'thank_you_redirect', booking_type: 'holiday' } as const
  // Recheck each provider immediately before sending; one failure cannot block the other.
  if (attempt.providers.ga4 && bookingProviders().ga4) googleEvent('booking_complete', data)
  if (attempt.providers.meta && bookingProviders().meta) sendMetaEvent({ name: 'Schedule', data, eventId: attempt.eventId })
}

// Document navigation and same-page language history transitions share this dedupe.
// A -> B -> A counts three visits; StrictMode's repeated effect counts once.
export function trackPageView(): void {
  if (!eligible()) return
  const path = safePagePath()
  captureCampaign(window.location.search)
  if (lastPage !== path) {
    lastPage = path
    formViewSent = false
    googleEvent('page_view')
    if (resolveSiteRoute(path).basePath === termsConfig.path) googleEvent('terms_view')
  }
  if (lastMetaPage !== path && sendMetaEvent({ name: 'PageView', data: {} })) lastMetaPage = path
}

export function trackFunnelEvent(event: MetaEvent, googleName: string): void {
  if (!eligible()) return
  trackPageView()
  googleEvent(googleName, event.data)
  sendMetaEvent(event)
}

export function setBookingFormVisible(visible: boolean): void {
  formVisible = visible
  if (!visible || !eligible() || formViewSent || resolveSiteRoute(safePagePath()).basePath !== '/booking') return
  trackPageView()
  formViewSent = true
  establishBookingJourney(bookingProviders())
  googleEvent('booking_form_view', { booking_type: 'holiday' })
  sendMetaEvent({ name: 'BookingFormView', data: { booking_type: 'holiday' } })
}

export function trackEvent(event: MarketingEvent, conversionId?: string): void {
  if (!eligible()) return
  trackPageView()
  const isConversion = event === 'waitlist_signup_success' || event === 'hiring_application_success'
  // Success events require a newly persisted record ID. Do not send that ID.
  if (isConversion) {
    if (!conversionId) return
    const key = `mirembe:conversion:v1:${event}:${conversionId}`
    if (sentConversions.has(key)) return
    try { if (sessionStorage.getItem(key)) return } catch { /* Memory dedupe remains. */ }
    sentConversions.add(key)
    try { sessionStorage.setItem(key, '1') } catch { /* Optional storage. */ }
  }
  googleEvent(event)
  if (event === 'waitlist_signup_success') {
    try {
      sendMetaEvent({ name: 'Lead', data: { lead_type: 'waitlist' }, eventId: crypto.randomUUID() })
    } catch { /* Unavailable browser crypto must not turn a saved signup into a form error. */ }
  }
}

/** Language preferences never grant consent and are not Meta conversions. */
export function trackLanguageChange(from: string, to: string): void {
  if (!isSupportedLocale(from) || !isSupportedLocale(to) || from === to || !eligible()) return
  googleEvent('language_change', { from_language: from, to_language: to })
}
