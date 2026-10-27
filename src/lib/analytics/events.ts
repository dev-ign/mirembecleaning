import { trackFunnelEvent } from './index'
import type { BookingLocation, ServiceSlug } from './types'

const locations: readonly BookingLocation[] = ['header', 'hero', 'services', 'how_it_works', 'final_cta', 'service_detail', 'holiday_modal', 'holiday_floating']
const services: readonly ServiceSlug[] = ['standard', 'deep', 'rental']

export function trackBookingCTA(location: BookingLocation): void {
  if (!locations.includes(location)) return
  trackFunnelEvent({ name: 'BookingCTA_Click', data: { location, campaign: 'holiday_2026' } }, 'booking_cta_click')
}

export function trackServiceView(service: ServiceSlug): void {
  if (!services.includes(service)) return
  trackFunnelEvent({ name: 'ViewContent', data: { content_type: 'service', content_name: service } }, 'service_detail_view')
}
