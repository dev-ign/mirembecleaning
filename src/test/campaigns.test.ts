import { describe, expect, it } from 'vitest'
import { allowsPromotionalOverlays, holidayCampaign, isHolidayCampaignActive, readCampaignFlag, writeCampaignFlag } from '../config/campaigns'

describe('holiday campaign boundaries', () => {
  it('allows overlays only on the homepage, including document route aliases', () => {
    for (const path of ['/', '/index.html']) expect(allowsPromotionalOverlays(path)).toBe(true)
    for (const path of ['/terms', '/terms/', '/terms/index.html', '/booking', '/booking/index.html', '/booking/thank-you', '/booking/thank-you/', '/unknown']) {
      expect(allowsPromotionalOverlays(path)).toBe(false)
    }
  })
  it('is active immediately when enabled and expires at the configured end', () => {
    expect(isHolidayCampaignActive(new Date('2026-10-01T00:00:00Z'))).toBe(true)
    expect(isHolidayCampaignActive(new Date(holidayCampaign.endsAt))).toBe(true)
    expect(isHolidayCampaignActive(new Date('2026-12-24T05:00:00Z'))).toBe(false)
    expect(isHolidayCampaignActive(new Date('2026-10-22T12:00:00Z'), { enabled: false, endsAt: holidayCampaign.endsAt })).toBe(false)
  })

  it('keeps promotional persistence safe when storage is unavailable', () => {
    const unavailable = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    } as unknown as Storage
    expect(readCampaignFlag(unavailable, 'seen')).toBe(false)
    expect(() => writeCampaignFlag(unavailable, 'seen')).not.toThrow()
  })
})
