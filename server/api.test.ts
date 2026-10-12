// @vitest-environment node
import { createClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import waitlist from '../api/waitlist.js'
import zip from '../api/waitlist/zip.js'
import applicants from '../api/applicants.js'
import { applicantSchema, waitlistSchema, zipUpdateSchema } from './validation.js'
import { createZipToken, verifyZipToken } from './zipToken.js'
import { verifyTurnstileToken } from './turnstile.js'

const SAVED_ID = '00000000-0000-4000-8000-000000000001'
const { fromMock, insertMock, singleMock, updateMock, eqMock, maybeSingleMock } = vi.hoisted(() => ({
  fromMock: vi.fn(), insertMock: vi.fn(), singleMock: vi.fn(), updateMock: vi.fn(), eqMock: vi.fn(), maybeSingleMock: vi.fn(),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    schema: () => ({
      from: fromMock.mockImplementation(() => ({
        insert: insertMock.mockImplementation(() => ({ select: () => ({ single: singleMock }) })),
        update: updateMock.mockImplementation(() => ({
          eq: eqMock.mockImplementation(() => ({ select: () => ({ maybeSingle: maybeSingleMock }) })),
        })),
      })),
    }),
  })),
}))
vi.mock('./turnstile.js', () => ({ verifyTurnstileToken: vi.fn() }))

const applicant = {
  first_name: ' Ari ',
  last_name: ' Rivera ',
  email: ' ARI@Example.com ',
  phone: '+1 (860) 555-0134',
  city: ' Hartford ',
  state: 'CT',
  has_vehicle: false,
  cleaning_experience: 'under_1_year',
  languages: ['english', 'spanish', 'other'],
  other_language: ' French ',
  travel_distance: '20_miles',
  preferred_availability: 'part_time',
}

function post(path: string, value: unknown, token = 'test-token') {
  return new Request(`http://localhost/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(path === 'waitlist/zip' ? value : { ...(value as object), ...(token ? { turnstileToken: token } : {}) }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('SUPABASE_URL', '')
  vi.stubEnv('SUPABASE_SECRET_KEY', '')
  vi.mocked(verifyTurnstileToken).mockResolvedValue('valid')
  singleMock.mockResolvedValue({ data: { id: SAVED_ID, created_at: '2026-10-11T00:00:00Z' }, error: null })
  maybeSingleMock.mockResolvedValue({ data: { zip_code: '02108-1234' }, error: null })
})
afterEach(() => vi.unstubAllEnvs())

describe('Vercel submission functions', () => {
  it('normalizes the actual form values before storage', () => {
    expect(waitlistSchema.parse({ email: '  Person@Example.com  ' })).toEqual({ email: 'person@example.com' })
    expect(waitlistSchema.parse({ email: '  ÉLISE@Example.com  ' })).toEqual({ email: 'élise@example.com' })
    expect(applicantSchema.parse(applicant)).toEqual({
      ...applicant,
      first_name: 'Ari',
      last_name: 'Rivera',
      email: 'ari@example.com',
      phone: '8605550134',
      city: 'Hartford',
      other_language: 'French',
    })
    expect(applicantSchema.parse({ ...applicant, languages: ['english'] }).other_language).toBeNull()
    expect(zipUpdateSchema.parse({ registration_token: 'token', zip_code: '021081234' }).zip_code).toBe('02108-1234')
  })

  it('rejects unsupported methods with a consistent JSON response', async () => {
    for (const handler of [waitlist, applicants, zip]) {
      const response = await handler.fetch(new Request('http://localhost/api/test'))
      expect(response.status).toBe(405)
      expect(response.headers.get('allow')).toBe('POST')
      expect(await response.json()).toEqual({
        ok: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for this endpoint.' },
      })
    }
  })

  it('requires a Turnstile token for both public submissions before any database access', async () => {
    for (const [path, handler, value] of [
      ['waitlist', waitlist, { email: 'person@example.com' }],
      ['applicants', applicants, applicant],
    ] as const) {
      const response = await handler.fetch(post(path, value, ''))
      expect(response.status).toBe(400)
      expect((await response.json()).error.code).toBe('VERIFICATION_FAILED')
    }
    expect(verifyTurnstileToken).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('rejects invalid or expired verification for both submissions without writing', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue('invalid')
    const waitlistResponse = await waitlist.fetch(post('waitlist', { email: 'person@example.com' }))
    const applicantResponse = await applicants.fetch(post('applicants', applicant))
    expect(waitlistResponse.status).toBe(400)
    expect(applicantResponse.status).toBe(400)
    expect((await waitlistResponse.json()).error.message).toBe('Verification failed. Please try again.')
    expect(verifyTurnstileToken).toHaveBeenNthCalledWith(1, 'test-token', 'waitlist')
    expect(verifyTurnstileToken).toHaveBeenNthCalledWith(2, 'test-token', 'applicants')
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('fails closed when Turnstile verification is unavailable', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue('unavailable')
    expect((await waitlist.fetch(post('waitlist', { email: 'person@example.com' }))).status).toBe(503)
    expect((await applicants.fetch(post('applicants', applicant))).status).toBe(503)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('rejects invalid waitlist payloads and extra client-supplied fields', async () => {
    for (const value of [{}, { email: 'invalid' }, { email: 'person@example.com', source: 'landing_page' }]) {
      const response = await waitlist.fetch(post('waitlist', value))
      expect(response.status).toBe(400)
      expect((await response.json()).ok).toBe(false)
    }
  })

  it('requires every applicant answer and validates phone, email, and conditional language', async () => {
    for (const value of [
      {},
      { ...applicant, email: 'invalid' },
      { ...applicant, phone: '123' },
      { ...applicant, state: null },
      { ...applicant, other_language: null },
      { ...applicant, languages: ['english', 'english'] },
      { ...applicant, languages: [] },
      { ...applicant, languages: ['unsupported'] },
      { ...applicant, cleaning_experience: 'unsupported' },
      { ...applicant, travel_distance: 'unsupported' },
      { ...applicant, preferred_availability: 'unsupported' },
      { ...applicant, status: 'hired' },
      { ...applicant, notes: 'do not allow' },
    ]) {
      const response = await applicants.fetch(post('applicants', value))
      expect(response.status).toBe(400)
      expect((await response.json()).error.code).toBe('INVALID_REQUEST')
    }
  })

  it('rejects malformed JSON and oversized bodies', async () => {
    const malformed = await waitlist.fetch(new Request('http://localhost/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":',
    }))
    expect(malformed.status).toBe(400)

    const declared = await applicants.fetch(new Request('http://localhost/api/applicants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '13000' },
      body: '{}',
    }))
    expect(declared.status).toBe(413)

    const streamed = await waitlist.fetch(post('waitlist', { email: `${'a'.repeat(5_000)}@example.com` }))
    expect(streamed.status).toBe(413)
    expect((await streamed.json()).error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('returns 503 without server credentials', async () => {
    const withoutCredentials = await waitlist.fetch(post('waitlist', { email: 'person@example.com' }))
    expect(withoutCredentials.status).toBe(503)
    const applicantResponse = await applicants.fetch(post('applicants', applicant))
    expect(applicantResponse.status).toBe(503)
    expect((await applicantResponse.json()).ok).toBe(false)
  })

  it('stores every validated applicant answer with server-owned fields', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'placeholder-key')

    const response = await applicants.fetch(post('applicants', applicant))
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true, data: { id: SAVED_ID, created_at: '2026-10-11T00:00:00Z' } })
    expect(fromMock).toHaveBeenCalledExactlyOnceWith('cleaning_applicants')
    expect(insertMock).toHaveBeenCalledExactlyOnceWith({
      full_name: 'Ari Rivera',
      first_name: 'Ari', last_name: 'Rivera', email: 'ari@example.com', phone: '8605550134',
      city: 'Hartford', state: 'CT', has_personal_vehicle: false,
      cleaning_experience: 'under_1_year', languages: ['english', 'spanish', 'other'],
      other_language: 'French', travel_distance: '20_miles', preferred_availability: 'part_time',
      status: 'new', source: 'landing_page',
    })
  })

  it('does not claim an applicant was accepted on a database error', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'placeholder-key')
    singleMock.mockResolvedValueOnce({ data: null, error: { code: '08006' } })
    const response = await applicants.fetch(post('applicants', applicant))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Submission service is temporarily unavailable.' },
    })
  })

  it('inserts only normalized email and server-owned source before returning 201', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'placeholder-key')

    const response = await waitlist.fetch(post('waitlist', { email: '  Person@Example.com  ' }))
    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload).toEqual({ ok: true, data: { id: SAVED_ID, created_at: '2026-10-11T00:00:00Z', zip_token: expect.any(String) } })
    expect(verifyZipToken(payload.data.zip_token, 'placeholder-key')).toBe(SAVED_ID)
    expect(insertMock).toHaveBeenCalledExactlyOnceWith({ email: 'person@example.com', source: 'landing_page' })
    expect(vi.mocked(createClient)).toHaveBeenCalledWith('https://example.supabase.co', 'placeholder-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  })

  it('acknowledges unique-email conflicts without changing an existing row', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'placeholder-key')
    singleMock.mockResolvedValue({ data: null, error: { code: '23505' } })

    const response = await waitlist.fetch(post('waitlist', { email: 'person@example.com' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { acknowledged: true } })
    expect(insertMock).toHaveBeenCalledTimes(1)
  })

  it('does not report success on database errors or missing returned data', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'placeholder-key')
    singleMock.mockResolvedValueOnce({ data: null, error: { code: '08006' } })
    singleMock.mockResolvedValueOnce({ data: null, error: null })
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await waitlist.fetch(post('waitlist', { email: 'person@example.com' }))
      expect(response.status).toBe(503)
      expect((await response.json()).ok).toBe(false)
    }
  })

  it('updates only ZIP when presented with a valid signed token', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'placeholder-key')
    const token = createZipToken(SAVED_ID, 'placeholder-key')

    const response = await zip.fetch(post('waitlist/zip', { registration_token: token, zip_code: '021081234' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { zip_code: '02108-1234' } })
    expect(updateMock).toHaveBeenCalledExactlyOnceWith({ zip_code: '02108-1234' })
    expect(eqMock).toHaveBeenCalledExactlyOnceWith('id', SAVED_ID)
  })

  it('rejects invalid ZIPs, missing or forged tokens, and administrative fields', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'placeholder-key')
    const token = createZipToken(SAVED_ID, 'placeholder-key')
    for (const value of [
      { registration_token: token, zip_code: '1234' },
      { registration_token: token, zip_code: '02108', status: 'converted' },
      { registration_token: 'forged', zip_code: '02108' },
      { zip_code: '02108' },
    ]) {
      const response = await zip.fetch(post('waitlist/zip', value))
      expect(response.status).toBe(400)
    }
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('expires ZIP tokens and fails safely on database outages', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'placeholder-key')
    const oldToken = createZipToken(SAVED_ID, 'placeholder-key', Date.now() - 25 * 60 * 60 * 1000)
    expect(verifyZipToken(oldToken, 'placeholder-key')).toBeNull()
    expect((await zip.fetch(post('waitlist/zip', { registration_token: oldToken, zip_code: '02108' }))).status).toBe(400)

    maybeSingleMock.mockResolvedValueOnce({ data: null, error: { code: '08006' } })
    const validToken = createZipToken(SAVED_ID, 'placeholder-key')
    const response = await zip.fetch(post('waitlist/zip', { registration_token: validToken, zip_code: '02108' }))
    expect(response.status).toBe(503)
    expect((await response.json()).ok).toBe(false)
  })
})
