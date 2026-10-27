import { afterEach, beforeEach, expect, it, vi } from 'vitest'

beforeEach(() => vi.resetModules())
afterEach(() => vi.doUnmock('../lib/analytics/events'))

it('warms one optional import, delivers pending events once, and then dispatches synchronously', async () => {
  const trackBookingCTA = vi.fn()
  const trackServiceView = vi.fn()
  const factory = vi.fn(() => ({ trackBookingCTA, trackServiceView }))
  vi.doMock('../lib/analytics/events', factory)
  const events = await import('../lib/optionalEvents')
  events.prepareOptionalEvents()
  events.prepareOptionalEvents()
  events.trackBookingCTA('hero')
  events.trackServiceView('deep')
  await vi.waitFor(() => {
    expect(trackBookingCTA).toHaveBeenCalledExactlyOnceWith('hero')
    expect(trackServiceView).toHaveBeenCalledExactlyOnceWith('deep')
  })
  expect(factory).toHaveBeenCalledTimes(1)
  events.trackBookingCTA('header')
  expect(trackBookingCTA).toHaveBeenLastCalledWith('header')
  trackBookingCTA.mockImplementationOnce(() => { throw new Error('blocked provider') })
  expect(() => events.trackBookingCTA('services')).not.toThrow()
})

it('isolates a blocked module without retrying or preventing caller actions', async () => {
  const factory = vi.fn(() => { throw new Error('ERR_BLOCKED_BY_CONTENT_BLOCKER') })
  vi.doMock('../lib/analytics/events', factory)
  const events = await import('../lib/optionalEvents')
  expect(() => events.prepareOptionalEvents()).not.toThrow()
  expect(() => events.trackBookingCTA('hero')).not.toThrow()
  expect(() => events.trackServiceView('standard')).not.toThrow()
  await vi.waitFor(() => expect(factory).toHaveBeenCalledTimes(1))
  events.prepareOptionalEvents()
  events.trackBookingCTA('header')
  await Promise.resolve()
  expect(factory).toHaveBeenCalledTimes(1)
})
