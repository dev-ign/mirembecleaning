// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { processSheetJobs, syncSheetSubmission } from './worker.js'
import { SheetsApiError, SheetsClient } from './client.js'
import { SHEET_TABS } from './mapping.js'

const submissionId = '00000000-0000-4000-8000-000000000001'
const claimed = { id: '00000000-0000-4000-8000-000000000002', lease_token: '00000000-0000-4000-8000-000000000003',
  submission_id: submissionId, kind: 'waitlist' }
const { rpc, maybeSingle, append, inspect } = vi.hoisted(() => ({
  rpc: vi.fn(), maybeSingle: vi.fn(), append: vi.fn(), inspect: vi.fn(),
}))
const query = { eq: vi.fn() } as { eq: ReturnType<typeof vi.fn>; maybeSingle?: ReturnType<typeof vi.fn> }
query.eq.mockReturnValue(query)
query.maybeSingle = maybeSingle
const db = { rpc, schema: () => ({ from: () => ({ select: () => query }) }) }

vi.mock('../database.js', () => ({
  getSupabaseConfig: () => ({ url: 'https://example.supabase.co', secretKey: 'test' }),
  createServiceClient: () => db,
}))
vi.mock('./config.js', () => ({ getSheetsConfig: () => ({ email: 'test@project.iam.gserviceaccount.com', privateKey: 'test', spreadsheetId: 'sheet' }),
  createGoogleAuth: vi.fn() }))
vi.mock('./client.js', async (original) => ({ ...(await original<typeof import('./client.js')>()),
  SheetsClient: vi.fn().mockImplementation(function () { return { inspect, append } }) }))

beforeEach(() => {
  vi.clearAllMocks()
  inspect.mockResolvedValue({ header: [...SHEET_TABS.waitlist.headers], ids: new Set<string>() })
  append.mockResolvedValue(undefined)
  maybeSingle.mockResolvedValue({ data: { id: submissionId, email: 'ari@example.com', created_at: '2026-10-12T10:00:00Z' }, error: null })
  rpc.mockResolvedValueOnce({ data: [claimed], error: null }).mockResolvedValue({ data: true, error: null })
})

describe('Sheets worker', () => {
  it('claims a waitlist job, maps its source row, appends, and completes the lease', async () => {
    expect(await processSheetJobs(1, submissionId)).toEqual({ processed: 1, failed: 0 })
    expect(rpc).toHaveBeenNthCalledWith(1, 'claim_sheet_jobs', { p_limit: 1, p_submission_id: submissionId })
    expect(append).toHaveBeenCalledWith('waitlist', [submissionId, 'ari@example.com', '2026-10-12 10:00 UTC', 'New', ''])
    expect(rpc).toHaveBeenNthCalledWith(2, 'complete_sheet_job', { p_id: claimed.id, p_lease_token: claimed.lease_token,
      p_synced: true, p_error_code: null, p_retryable: false })
  })

  it('reconciles an already appended row after a crash without appending again', async () => {
    inspect.mockResolvedValue({ header: [...SHEET_TABS.waitlist.headers], ids: new Set([submissionId]) })
    expect(await processSheetJobs()).toEqual({ processed: 1, failed: 0 })
    expect(append).not.toHaveBeenCalled()
    expect(maybeSingle).not.toHaveBeenCalled()
  })

  it('records retryable API failures and terminal header failures safely', async () => {
    inspect.mockRejectedValueOnce(new SheetsApiError('google_http_503', true))
    expect(await processSheetJobs()).toEqual({ processed: 1, failed: 1 })
    expect(rpc).toHaveBeenNthCalledWith(2, 'complete_sheet_job', { p_id: claimed.id, p_lease_token: claimed.lease_token,
      p_synced: false, p_error_code: 'google_http_503', p_retryable: true })
    vi.clearAllMocks()
    rpc.mockResolvedValueOnce({ data: [claimed], error: null }).mockResolvedValue({ data: true, error: null })
    inspect.mockResolvedValue({ header: [], ids: new Set() })
    expect(await processSheetJobs()).toEqual({ processed: 1, failed: 1 })
    expect(rpc).toHaveBeenNthCalledWith(2, 'complete_sheet_job', expect.objectContaining({
      p_synced: false, p_error_code: 'sheet_header_missing', p_retryable: false }))
  })

  it('keeps edited Status and Notes untouched when a submission is already present', async () => {
    const sheets = { inspect: vi.fn().mockResolvedValue({ header: [...SHEET_TABS.hiring.headers], ids: new Set([submissionId]) }), append }
    expect(await syncSheetSubmission('hiring', submissionId, db as never, sheets as unknown as SheetsClient)).toBe('existing')
    expect(append).not.toHaveBeenCalled()
    expect(maybeSingle).not.toHaveBeenCalled()
  })

  it('reads hiring source fields and appends to the applicants tab', async () => {
    inspect.mockResolvedValue({ header: [...SHEET_TABS.hiring.headers], ids: new Set() })
    maybeSingle.mockResolvedValue({ data: { id: submissionId, first_name: 'Ari', last_name: 'Rivera',
      email: 'ari@example.com', phone: '8605550134', city: 'Hartford', state: 'CT',
      created_at: '2026-10-12T10:00:00Z' }, error: null })
    expect(await syncSheetSubmission('hiring', submissionId, db as never,
      { inspect, append } as unknown as SheetsClient)).toBe('appended')
    expect(append).toHaveBeenCalledWith('hiring', [submissionId, 'Ari', 'Rivera', 'ari@example.com',
      '8605550134', 'Hartford', 'CT', '2026-10-12 10:00 UTC', 'New', ''])
    expect(query.eq).toHaveBeenCalledWith('source', 'landing_page')
  })

  it('does not process when the database claim fails', async () => {
    rpc.mockReset().mockResolvedValue({ data: null, error: { code: 'database_failure' } })
    await expect(processSheetJobs()).rejects.toThrow('Sheets job claim failed')
    expect(append).not.toHaveBeenCalled()
  })
})
