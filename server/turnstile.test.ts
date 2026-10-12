// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyTurnstileToken } from './turnstile.js'

describe('Turnstile Siteverify', () => {
  beforeEach(() => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'server-secret')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('posts the token to Cloudflare and accepts the intended action and hostname', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ success: true, action: 'waitlist', hostname: 'mirembecleaning.com' }))
    expect(await verifyTurnstileToken('fresh-token', 'waitlist')).toBe('valid')
    expect(fetch).toHaveBeenCalledExactlyOnceWith('https://challenges.cloudflare.com/turnstile/v0/siteverify', expect.objectContaining({
      method: 'POST',
      body: new URLSearchParams({ secret: 'server-secret', response: 'fresh-token' }),
    }))
  })

  it('rejects failed, mismatched, and cross-host tokens', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] }))
      .mockResolvedValueOnce(Response.json({ success: true, action: 'applicants', hostname: 'mirembecleaning.com' }))
      .mockResolvedValueOnce(Response.json({ success: true, action: 'waitlist', hostname: 'another.example' }))
    expect(await verifyTurnstileToken('spent', 'waitlist')).toBe('invalid')
    expect(await verifyTurnstileToken('wrong-action', 'waitlist')).toBe('invalid')
    expect(await verifyTurnstileToken('wrong-host', 'waitlist')).toBe('invalid')
  })

  it('accepts Cloudflare dummy responses only with the official local test secret', async () => {
    vi.stubEnv('VERCEL_ENV', 'development')
    vi.stubEnv('TURNSTILE_SECRET_KEY', '1x0000000000000000000000000000000AA')
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ success: true, hostname: 'example.com' }))
      .mockResolvedValueOnce(Response.json({ success: true, action: 'test', hostname: 'example.com' }))
    expect(await verifyTurnstileToken('XXXX.DUMMY.TOKEN.XXXX', 'waitlist')).toBe('valid')
    expect(await verifyTurnstileToken('XXXX.DUMMY.TOKEN.XXXX', 'applicants')).toBe('valid')

    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ success: true, action: 'unexpected', hostname: 'example.com' }))
    expect(await verifyTurnstileToken('XXXX.DUMMY.TOKEN.XXXX', 'waitlist')).toBe('invalid')

    vi.stubEnv('VERCEL_ENV', 'production')
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ success: true, hostname: 'mirembecleaning.com' }))
    expect(await verifyTurnstileToken('XXXX.DUMMY.TOKEN.XXXX', 'waitlist')).toBe('invalid')

    vi.stubEnv('VERCEL_ENV', 'development')
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'a-different-secret')
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ success: true, action: 'test' }))
    expect(await verifyTurnstileToken('another-token', 'waitlist')).toBe('invalid')
  })

  it('fails closed for missing configuration and upstream errors', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    expect(await verifyTurnstileToken('token', 'waitlist')).toBe('unavailable')
    expect(fetch).not.toHaveBeenCalled()
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'server-secret')
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'))
    expect(await verifyTurnstileToken('token', 'waitlist')).toBe('unavailable')
    vi.mocked(fetch).mockResolvedValueOnce(new Response('bad gateway', { status: 502 }))
    expect(await verifyTurnstileToken('token', 'waitlist')).toBe('unavailable')
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ success: false, 'error-codes': ['invalid-input-secret'] }))
    expect(await verifyTurnstileToken('token', 'waitlist')).toBe('unavailable')
  })
})
