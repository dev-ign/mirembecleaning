import { bookingConfig } from '../config/booking'

export type BookingProviders = { meta: boolean; ga4: boolean }
type BookingJourney = {
  version: 1
  id: string
  bookingType: 'holiday'
  formId: string
  startedAt: number
  status: 'pending' | 'consumed'
  providers: BookingProviders
}

export const bookingJourneyKey = 'mirembe:booking-journey:v1'
const maxAge = 30 * 60 * 1000
let storageFailed = false

function readJourney(): BookingJourney | null {
  const raw = sessionStorage.getItem(bookingJourneyKey)
  if (!raw) return null
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') return null
  const journey = value as Partial<BookingJourney>
  const age = Date.now() - (journey.startedAt ?? NaN)
  if (journey.version !== 1 || journey.bookingType !== 'holiday'
    || journey.formId !== bookingConfig.holiday.formId
    || typeof journey.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(journey.id)
    || !Number.isSafeInteger(journey.startedAt) || age < 0 || age >= maxAge
    || !['pending', 'consumed'].includes(journey.status ?? '')
    || !journey.providers || typeof journey.providers.meta !== 'boolean' || typeof journey.providers.ga4 !== 'boolean') return null
  return journey as BookingJourney
}

function persist(journey: BookingJourney): void {
  const serialized = JSON.stringify(journey)
  sessionStorage.setItem(bookingJourneyKey, serialized)
  // Some storage shims silently ignore writes. Never send without a durable claim.
  if (sessionStorage.getItem(bookingJourneyKey) !== serialized) throw new Error('Booking attribution storage unavailable')
}

// This is a measurement marker, never a provider booking ID or completion proof.
export function establishBookingJourney(providers: BookingProviders): void {
  if (storageFailed || (!providers.meta && !providers.ga4)) return
  try {
    const pending = readJourney()
    if (pending?.status === 'pending') {
      // Eligibility can only narrow within one journey; its clock never slides.
      persist({ ...pending, providers: { meta: pending.providers.meta && providers.meta, ga4: pending.providers.ga4 && providers.ga4 } })
      return
    }
    persist({ version: 1, id: crypto.randomUUID(), bookingType: 'holiday', formId: bookingConfig.holiday.formId,
      startedAt: Date.now(), status: 'pending', providers: { ...providers } })
  } catch { storageFailed = true }
}

export function consumeBookingJourney(providers: BookingProviders): { eventId: string; providers: BookingProviders } | null {
  if (storageFailed) return null
  try {
    const pending = readJourney()
    if (pending?.status !== 'pending') return null
    // Reserve the entire attempt before either SDK runs. No refresh retries, even
    // when one provider is blocked or newly ineligible. Provider sends are isolated.
    persist({ ...pending, status: 'consumed' })
    return { eventId: pending.id, providers: {
      meta: pending.providers.meta && providers.meta,
      ga4: pending.providers.ga4 && providers.ga4,
    } }
  } catch { storageFailed = true; return null }
}

// Kept outside the optional provider graph so withdrawal invalidates pending
// attribution synchronously, including while an analytics import is unresolved.
export function revokeBookingJourney(): void {
  try { sessionStorage.removeItem(bookingJourneyKey) } catch { storageFailed = true }
}
