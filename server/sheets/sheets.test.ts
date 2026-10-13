// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JWT } from 'google-auth-library'
import { SheetsClient, SheetsApiError } from './client.js'
import { createGoogleAuth, getSheetsConfig } from './config.js'
import { mapSubmission, sheetText } from './mapping.js'

vi.mock('google-auth-library', () => ({ JWT: vi.fn().mockImplementation(function () {
  return { getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }) }
}) }))

const config = { email: 'test@project.iam.gserviceaccount.com', privateKey: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----', spreadsheetId: 'sheet-id' }
const submissionId = '00000000-0000-4000-8000-000000000001'

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks() })

describe('Sheets configuration and mapping', () => {
  it('accepts actual and escaped key newlines and configures Google service-account auth', () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', config.email)
    vi.stubEnv('GOOGLE_SHEETS_SPREADSHEET_ID', config.spreadsheetId)
    vi.stubEnv('GOOGLE_PRIVATE_KEY', config.privateKey.replace(/\n/g, '\\n'))
    expect(getSheetsConfig()).toEqual(config)
    vi.stubEnv('GOOGLE_PRIVATE_KEY', config.privateKey)
    expect(getSheetsConfig()).toEqual(config)
    createGoogleAuth(config)
    expect(JWT).toHaveBeenCalledWith({ email: config.email, key: config.privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
    vi.stubEnv('GOOGLE_PRIVATE_KEY', '')
    expect(getSheetsConfig()).toBeNull()
  })

  it('maps only submission fields, uses a consistent UTC date, and protects formula-like text', () => {
    const row = { id: submissionId, email: '=HYPERLINK("bad")', created_at: '2026-10-12T15:24:36-04:00',
      first_name: '+Ari', last_name: 'Rivera', phone: '8605550134', city: '@Hartford', state: 'CT' }
    expect(mapSubmission('waitlist', row)).toEqual([submissionId, "'=HYPERLINK(\"bad\")", '2026-10-12 19:24 UTC', 'New', ''])
    expect(mapSubmission('hiring', row)).toEqual([submissionId, "'+Ari", 'Rivera', "'=HYPERLINK(\"bad\")",
      '8605550134', "'@Hartford", 'CT', '2026-10-12 19:24 UTC', 'New', ''])
    expect(sheetText('  -4')).toBe("'  -4")
    expect(sheetText('hello')).toBe('hello')
  })
})

describe('Sheets REST calls', () => {
  it('selects each named tab, detects existing IDs, and appends with RAW without touching Status or Notes', async () => {
    const mock = vi.mocked(fetch)
    mock.mockResolvedValueOnce(Response.json({ valueRanges: [{ values: [['Submission ID', 'Email', 'Date Joined', 'Status', 'Notes']] },
      { values: [[submissionId]] }] }))
    mock.mockResolvedValueOnce(Response.json({ updates: { updatedRows: 1 } }))
    const sheets = new SheetsClient(config)
    const found = await sheets.inspect('waitlist')
    expect(found.ids.has(submissionId)).toBe(true)
    const firstUrl = String(mock.mock.calls[0][0])
    expect(firstUrl).toContain('Customer+Waitlist')
    await sheets.append('hiring', [submissionId, 'Ari', 'Rivera', 'ari@example.com', '8605550134', 'Hartford', 'CT', '2026-10-12 19:24 UTC', 'New', ''])
    const appendUrl = String(mock.mock.calls[1][0])
    expect(appendUrl).toContain('Cleaning%20Applicants')
    expect(appendUrl).toContain('valueInputOption=RAW')
    expect(JSON.parse(String(mock.mock.calls[1][1]?.body)).values[0].slice(-2)).toEqual(['New', ''])
  })

  it('classifies Google failures without exposing provider responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('private provider detail', { status: 429 }))
    await expect(new SheetsClient(config).inspect('hiring')).rejects.toMatchObject({ code: 'google_http_429', retryable: true })
    vi.mocked(fetch).mockResolvedValueOnce(new Response('private provider detail', { status: 403 }))
    await expect(new SheetsClient(config).inspect('hiring')).rejects.toMatchObject({ code: 'google_http_403', retryable: false })
    expect(new SheetsApiError('safe_code', false).message).toBe('safe_code')
  })

  it('prepares both tabs with headers, frozen rows, filters, and widths without clearing data', async () => {
    const mock = vi.mocked(fetch)
    mock.mockResolvedValueOnce(Response.json({ sheets: [
      { properties: { sheetId: 1, title: 'Customer Waitlist' } },
      { properties: { sheetId: 2, title: 'Cleaning Applicants' } },
    ] }))
    mock.mockResolvedValueOnce(Response.json({ valueRanges: [{}, {}] }))
    mock.mockResolvedValueOnce(Response.json({ valueRanges: [{}, {}] }))
    mock.mockResolvedValueOnce(Response.json({ updatedRange: 'A1:E1' }))
    mock.mockResolvedValueOnce(Response.json({ replies: [] }))
    mock.mockResolvedValueOnce(Response.json({ updatedRange: 'A1:J1' }))
    mock.mockResolvedValueOnce(Response.json({ replies: [] }))
    await new SheetsClient(config).prepareTabs()
    const bodies = mock.mock.calls.map((call) => call[1]?.body ? JSON.parse(String(call[1].body)) as Record<string, unknown> : null)
    expect(bodies[4]?.requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ updateSheetProperties: expect.any(Object) }),
      expect.objectContaining({ setBasicFilter: expect.any(Object) }),
    ]))
    expect(bodies[6]?.requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ updateDimensionProperties: expect.any(Object) }),
    ]))
    expect(mock.mock.calls.every((call) => call[1]?.method !== 'DELETE')).toBe(true)
  })
})
