// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker from '../api/email-worker.js'
import { processEmailJobs } from './email/worker.js'

vi.mock('./email/worker.js', () => ({ processEmailJobs: vi.fn() }))
beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret-at-least-16-chars')
  vi.mocked(processEmailJobs).mockResolvedValue({ processed: 2, failed: 0 })
})
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

describe('authenticated email worker route', () => {
  it('rejects missing and incorrect secrets without processing', async () => {
    expect((await worker.fetch(new Request('https://example.com/api/email-worker'))).status).toBe(401)
    expect((await worker.fetch(new Request('https://example.com/api/email-worker', { headers: { authorization: 'Bearer wrong' } }))).status).toBe(401)
    expect(processEmailJobs).not.toHaveBeenCalled()
  })

  it('processes only an authenticated GET request', async () => {
    const headers = { authorization: 'Bearer test-secret-at-least-16-chars' }
    expect((await worker.fetch(new Request('https://example.com/api/email-worker', { method: 'POST', headers }))).status).toBe(405)
    const response = await worker.fetch(new Request('https://example.com/api/email-worker', { headers }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, processed: 2, failed: 0 })
    expect(processEmailJobs).toHaveBeenCalledExactlyOnceWith(10)
  })

  it('drains another batch when the first is full', async () => {
    vi.mocked(processEmailJobs).mockReset()
      .mockResolvedValueOnce({ processed: 10, failed: 1 })
      .mockResolvedValueOnce({ processed: 2, failed: 0 })
    const response = await worker.fetch(new Request('https://example.com/api/email-worker', {
      headers: { authorization: 'Bearer test-secret-at-least-16-chars' },
    }))
    expect(await response.json()).toEqual({ ok: true, processed: 12, failed: 1 })
    expect(processEmailJobs).toHaveBeenCalledTimes(2)
  })
})
