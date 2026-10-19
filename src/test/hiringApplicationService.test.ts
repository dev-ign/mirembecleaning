import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HiringRequestError, isValidEmail, normalizePhone, phoneDigits, submitHiringApplication, validateHiringApplication } from '../services/hiringApplicationService'
import { initialHiringApplication, type HiringApplicationInput } from '../types/hiring'

const validInput: HiringApplicationInput = {
  ...initialHiringApplication,
  first_name: ' Ari ',
  last_name: ' Rivera ',
  email: ' ARI@Example.com ',
  phone: '(860) 555-0134',
  city: ' Hartford ',
  state: 'CT',
  has_vehicle: false,
  cleaning_experience: 'under_1_year',
  languages: ['english', 'spanish', 'other'],
  other_language: ' French ',
  travel_distance: '20_miles',
  preferred_availability: 'part_time',
}

function mockResponse(status: number, payload: unknown) {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json(payload, { status }))
}

describe('hiring application service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('posts every normalized form field and accepts only a persisted 201', async () => {
    mockResponse(201, { ok: true, data: { id: 'application-1', created_at: '2026-10-11T14:00:00Z' } })
    const record = await submitHiringApplication(validInput, 'test-token', '00000000-0000-4000-8000-000000000004')

    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/applicants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validInput,
        first_name: 'Ari',
        last_name: 'Rivera',
        email: 'ari@example.com',
        phone: '8605550134',
        city: 'Hartford',
        other_language: 'French',
        submission_key: '00000000-0000-4000-8000-000000000004',
        turnstileToken: 'test-token',
      }),
    })
    expect(record).toEqual({
      ...validInput,
      first_name: 'Ari', last_name: 'Rivera', email: 'ari@example.com',
      phone: '8605550134', city: 'Hartford', other_language: 'French',
      id: 'application-1', source: 'landing_page', created_at: '2026-10-11T14:00:00Z',
    })
    expect(record.languages).toEqual(['english', 'spanish', 'other'])
    expect(record.has_vehicle).toBe(false)
  })

  it('marks an idempotent server replay so it cannot be counted as a new lead', async () => {
    mockResponse(201, { ok: true, data: { id: 'application-1', created_at: '2026-10-11T14:00:00Z', replayed: true } })
    const record = await submitHiringApplication(validInput, 'test-token', '00000000-0000-4000-8000-000000000004')
    expect(record.replayed).toBe(true)
  })

  it('requires every answer, keeps No distinct from unanswered, and checks Other', () => {
    const missing = validateHiringApplication(initialHiringApplication)
    expect(missing.has_vehicle).toBe('Choose Yes or No.')
    expect(missing.languages).toBe('Select at least one language.')
    expect(validateHiringApplication({ ...validInput, other_language: '' }).other_language).toContain('Specify the other language')
    expect(validateHiringApplication({ ...validInput, languages: ['english', 'english'] }).languages).toBeDefined()
    expect(validateHiringApplication({ ...validInput, first_name: 'x'.repeat(81) }).first_name).toBeDefined()
    expect(validateHiringApplication(validInput)).toEqual({})
    expect(normalizePhone('1-860-555-0134')).toBe('8605550134')
    expect(normalizePhone('123')).toBeNull()
    expect(normalizePhone('+44 20 7946 0958')).toBeNull()
    expect(phoneDigits('+1 (617) 555-0123')).toBe('6175550123')
    expect(phoneDigits('617abc5550123')).toBe('6175550123')
    expect(phoneDigits('123456789012')).toBe('123456789012')
  })

  it('validates complete email addresses without restricting normal input characters', () => {
    for (const invalid of ['', 'missing-at.example.com', 'a@', 'a@localhost', 'a@example..com', 'a b@example.com', 'a@-example.com', 'a..b@example.com', 'a,b@example.com']) {
      expect(isValidEmail(invalid)).toBe(false)
      expect(validateHiringApplication({ ...validInput, email: invalid }).email).toBe('Enter a valid email address.')
    }
    for (const valid of [' name+tag@example.technology ', 'a@sub.example.co.uk', 'élise@example.com']) {
      expect(isValidEmail(valid)).toBe(true)
    }
  })

  it('rejects invalid input before sending and reports server validation errors', async () => {
    await expect(submitHiringApplication({ ...validInput, email: 'invalid' }, 'test-token')).rejects.toMatchObject({ kind: 'invalid' } satisfies Partial<HiringRequestError>)
    expect(fetch).not.toHaveBeenCalled()

    mockResponse(400, { ok: false, error: { code: 'INVALID_REQUEST' } })
    await expect(submitHiringApplication(validInput, 'test-token')).rejects.toMatchObject({ kind: 'invalid' } satisfies Partial<HiringRequestError>)

    mockResponse(400, { ok: false, error: { code: 'VERIFICATION_FAILED' } })
    await expect(submitHiringApplication(validInput, 'spent-token')).rejects.toMatchObject({ kind: 'verification' } satisfies Partial<HiringRequestError>)
  })

  it('does not fabricate success on outages, malformed responses, or network failures', async () => {
    mockResponse(503, { ok: false, error: { code: 'SERVICE_UNAVAILABLE' } })
    await expect(submitHiringApplication(validInput, 'test-token')).rejects.toMatchObject({ kind: 'unavailable' } satisfies Partial<HiringRequestError>)

    mockResponse(201, { ok: true, data: { id: 'missing-timestamp' } })
    await expect(submitHiringApplication(validInput, 'test-token')).rejects.toMatchObject({ kind: 'unavailable' } satisfies Partial<HiringRequestError>)

    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
    await expect(submitHiringApplication(validInput, 'test-token')).rejects.toMatchObject({ kind: 'unavailable' } satisfies Partial<HiringRequestError>)
  })
})
