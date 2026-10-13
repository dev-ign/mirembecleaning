// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { processEmailJobs } from './worker.js'
import { sendEmailJob } from './send.js'

const rpc = vi.fn()
vi.mock('../database.js', () => ({
  getSupabaseConfig: () => ({ url: 'https://example.supabase.co', secretKey: 'test' }),
  createServiceClient: () => ({ rpc }),
}))
vi.mock('./send.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('./send.js')>()), sendEmailJob: vi.fn() }))

const submissionId = '00000000-0000-4000-8000-000000000001'
const claimed = {
  id: '00000000-0000-4000-8000-000000000002', submission_id: submissionId,
  lease_token: '00000000-0000-4000-8000-000000000003',
  idempotency_key: `waitlist:${submissionId}:customer-confirmation`,
  kind: 'waitlist_confirmation', payload: { email: 'ari@example.com', created_at: '2026-10-12T10:00:00Z' },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('RESEND_API_KEY', 'test')
  vi.stubEnv('RESEND_FROM_EMAIL', '<no-reply@mirembecleaning.com>')
  vi.stubEnv('RESEND_CAREERS_EMAIL', '<no-reply@mirembecleaning.com>')
  vi.stubEnv('MIREMBE_NOTIFICATION_EMAIL', 'mirembecleaning@gmail.com')
  rpc.mockResolvedValue({ data: true, error: null })
  rpc.mockResolvedValueOnce({ data: [claimed], error: null })
})
afterEach(() => vi.unstubAllEnvs())

describe('email outbox processor', () => {
  it('claims, sends, and records a Resend message ID with the lease token', async () => {
    vi.mocked(sendEmailJob).mockResolvedValue({ delivered: true, resendId: 'resend-123' })
    expect(await processEmailJobs(2, submissionId)).toEqual({ processed: 1, failed: 0 })
    expect(rpc).toHaveBeenNthCalledWith(1, 'claim_email_jobs', { p_limit: 2, p_submission_id: submissionId })
    expect(rpc).toHaveBeenNthCalledWith(2, 'complete_email_job', {
      p_id: claimed.id, p_lease_token: claimed.lease_token, p_delivered: true,
      p_resend_id: 'resend-123', p_error_code: null, p_retryable: false,
    })
  })

  it('records a retryable failure without leaking the provider message', async () => {
    vi.mocked(sendEmailJob).mockResolvedValue({ delivered: false, code: 'rate_limit_exceeded', retryable: true })
    expect(await processEmailJobs()).toEqual({ processed: 1, failed: 1 })
    expect(rpc).toHaveBeenNthCalledWith(2, 'complete_email_job', {
      p_id: claimed.id, p_lease_token: claimed.lease_token, p_delivered: false,
      p_resend_id: null, p_error_code: 'rate_limit_exceeded', p_retryable: true,
    })
  })

  it('does not send when claiming fails', async () => {
    rpc.mockReset().mockResolvedValue({ data: null, error: { code: 'database_failure' } })
    await expect(processEmailJobs()).rejects.toThrow('Email job claim failed')
    expect(sendEmailJob).not.toHaveBeenCalled()
  })
})
