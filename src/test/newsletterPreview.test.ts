import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

describe('newsletter public and preview visibility', () => {
  it.each([
    [true, 'development', undefined, false],
    [true, 'development', 'true', true],
    [false, 'production', undefined, true],
    [false, 'production', 'true', true],
    // The prerender generator uses Vite's server API, even for production output.
    [true, 'production', 'true', true],
  ] as const)('gates DEV=%s, mode=%s, flag=%s safely', async (dev, mode, flag, expected) => {
    vi.resetModules()
    vi.stubEnv('DEV', dev)
    vi.stubEnv('MODE', mode)
    vi.stubEnv('VITE_ENABLE_NEWSLETTER_PREVIEW', flag)
    expect((await import('../config/newsletter')).newsletterEnabled).toBe(expected)
  })
})
