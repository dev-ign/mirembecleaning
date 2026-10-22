import { describe, expect, it } from 'vitest'
import { holidayCampaign, isHolidayCampaignActive, readCampaignFlag, writeCampaignFlag } from '../config/campaigns'

describe('holiday campaign boundaries', () => {
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
