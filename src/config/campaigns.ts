/** The seasonal promotion is deliberately independent of booking and form operations. */
export const holidayCampaign = {
  id: 'holiday-2026',
  enabled: true,
  endsAt: '2026-12-23T23:59:59-05:00',
  bookingUrl: 'https://app.zenmaid.com/book/mirembe-cleaning-company-holiday',
  discount: '10%',
  windows: ['November 20–23, 2026', 'December 18–23, 2026'],
  modalDelayMs: 4000,
  floatingCtaEnabled: true,
} as const

export const launch = {
  headline: 'Full service launches January 2027.',
  holidayMessage: 'Limited holiday appointments are now available.',
  regularBookingsMessage: 'We plan to open for regular bookings in January 2027. Join the waitlist for launch updates.',
  primaryCta: 'waitlist' as const,
} as const

export function isHolidayCampaignActive(now: Date = new Date(), campaign: { enabled: boolean; endsAt: string } = holidayCampaign): boolean {
  return campaign.enabled && now.getTime() <= Date.parse(campaign.endsAt)
}

export function readCampaignFlag(storage: Storage | undefined, key: string): boolean {
  try { return storage?.getItem(key) === '1' } catch { return false }
}

export function writeCampaignFlag(storage: Storage | undefined, key: string): void {
  try { storage?.setItem(key, '1') } catch { /* Storage can be unavailable in private mode. */ }
}

export const holidayCtaDismissedKey = `${holidayCampaign.id}.ctaDismissed`
