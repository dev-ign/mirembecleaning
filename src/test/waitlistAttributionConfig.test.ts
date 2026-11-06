import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

it.each([
  [false, 'true', false], [false, 'false', false], [true, 'false', false], [true, 'true', true],
])('requires both local DEV=%s and explicit preview=%s', async (dev, flag, expected) => {
  vi.resetModules()
  vi.stubEnv('DEV', dev)
  vi.stubEnv('VITE_ENABLE_WAITLIST_ATTRIBUTION_PREVIEW', flag)
  expect((await import('../config/waitlistAttribution')).waitlistAttributionPreviewEnabled).toBe(expected)
})
