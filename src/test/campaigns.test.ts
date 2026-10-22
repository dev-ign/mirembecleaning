import { describe, expect, it } from 'vitest'
import { holidayCampaign, isHolidayCampaignActive, readCampaignFlag, writeCampaignFlag } from '../config/campaigns'

describe('holiday campaign boundaries', () => {
  it('is visible only inside the configured date range', () => {
    expect(isHolidayCampaignActive(new Date('2026-10-22T03:59:59Z'))).toBe(false)
    expect(isHolidayCampaignActive(new Date(holidayCampaign.startsAt))).toBe(true)
    expect(isHolidayCampaignActive(new Date(holidayCampaign.endsAt))).toBe(true)
    expect(isHolidayCampaignActive(new Date('2026-12-24T05:00:00Z'))).toBe(false)
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
