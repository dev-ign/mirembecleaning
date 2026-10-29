import { getConsent, getConsentRevision, invalidatePendingAnalytics, saveConsent } from './consent'
import { revokeBookingJourney } from './bookingJourney'
import type { MarketingEvent } from './analytics'
import type { BookingLocation, ServiceSlug } from './analytics/types'

type EventHelpers = typeof import('./analytics/events')
let helpers: EventHelpers | undefined
let loading: Promise<EventHelpers | undefined> | undefined

function loadHelpers(): Promise<EventHelpers | undefined> {
  // A content blocker may reject this first-party module by URL. Keep that
  // optional failure out of React's static dependency graph and do not retry it
  // on every interaction. The helper itself still enforces marketing consent.
  loading ??= import('./analytics/events').then(module => {
    helpers = module
    return module
  }, () => undefined)
  return loading
}

export function prepareOptionalEvents(): void {
  void loadHelpers()
}

function deliver(send: (events: EventHelpers) => void, guard = true): void {
  const revision = getConsentRevision()
  const safelySend = (events: EventHelpers | undefined) => {
    if (!events || (guard && revision !== getConsentRevision())) return
    try { send(events) } catch { /* Optional measurement cannot interrupt navigation or forms. */ }
  }
  // Warm helpers dispatch synchronously before document navigation. Only an
  // interaction during the initial load waits; blocked imports are discarded.
  if (helpers) safelySend(helpers)
  else void loadHelpers().then(safelySend)
}

export function trackBookingCTA(location: BookingLocation): void {
  if (getConsent() === 'accepted') deliver(events => events.trackBookingCTA(location))
}

export function trackServiceView(service: ServiceSlug): void {
  if (getConsent() === 'accepted') deliver(events => events.trackServiceView(service))
}

export function startAnalytics(): void {
  if (getConsent() !== 'accepted') revokeBookingJourney()
  deliver(events => events.startAnalytics())
}

export function stopAnalytics(): void {
  invalidatePendingAnalytics()
  revokeBookingJourney()
  deliver(events => { if (getConsent() !== 'accepted') events.stopAnalytics() }, false)
}

export function setConsent(value: 'accepted' | 'declined'): void {
  saveConsent(value)
  if (getConsent() === 'accepted') startAnalytics()
  else stopAnalytics()
}

export function trackEvent(event: MarketingEvent, conversionId?: string): void {
  if (getConsent() === 'accepted') deliver(events => events.trackEvent(event, conversionId))
}

export function setBookingFormVisible(visible: boolean): void {
  deliver(events => events.setBookingFormVisible(visible))
}

export function trackLanguageChange(from: string, to: string): void {
  if (getConsent() === 'accepted') deliver(events => events.trackLanguageChange(from, to))
}
