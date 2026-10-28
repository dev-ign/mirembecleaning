export type Consent = 'accepted' | 'declined' | null
export type BookingLocation = 'header' | 'hero' | 'services' | 'how_it_works' | 'final_cta' | 'service_detail' | 'holiday_modal' | 'holiday_floating'
export type ServiceSlug = 'standard' | 'deep' | 'rental'
export type MetaEvent =
  | { name: 'PageView'; data: Record<string, never> }
  | { name: 'ViewContent'; data: { content_type: 'service'; content_name: ServiceSlug } }
  | { name: 'Lead'; data: { lead_type: 'waitlist' }; eventId: string }
  | { name: 'Schedule'; data: { attribution_method: 'thank_you_redirect'; booking_type: 'holiday' }; eventId: string }
  | { name: 'BookingCTA_Click'; data: { location: BookingLocation; campaign: 'holiday_2026' } }
  | { name: 'BookingFormView'; data: { booking_type: 'holiday' } }

export type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  push?: Fbq
  queue?: unknown[][]
  loaded?: boolean
  version?: string
}

declare global {
  interface Window {
    dataLayer?: unknown[][]
    gtag?: (...args: unknown[]) => void
    fbq?: Fbq
    _fbq?: Fbq
  }
}
