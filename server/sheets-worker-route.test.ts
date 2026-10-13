// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker from '../api/sheets-worker.js'
import { processSheetJobs } from './sheets/worker.js'

vi.mock('./sheets/worker.js', () => ({ processSheetJobs: vi.fn() }))
beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret-at-least-16-chars')
  vi.mocked(processSheetJobs).mockResolvedValue({ processed: 1, failed: 0 })
})
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

describe('authenticated Sheets worker route', () => {
  it('denies unauthenticated calls and accepts only GET', async () => {
    expect((await worker.fetch(new Request('https://example.com/api/sheets-worker'))).status).toBe(401)
    const headers = { authorization: 'Bearer test-secret-at-least-16-chars' }
    expect((await worker.fetch(new Request('https://example.com/api/sheets-worker', { method: 'POST', headers }))).status).toBe(405)
    const response = await worker.fetch(new Request('https://example.com/api/sheets-worker', { headers }))
    expect(await response.json()).toEqual({ ok: true, processed: 1, failed: 0 })
    expect(processSheetJobs).toHaveBeenCalledExactlyOnceWith(2)
  })
})
