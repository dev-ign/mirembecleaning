import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { failNextHiringApplication, isValidEmail, normalizePhone, phoneDigits, submitHiringApplication, validateHiringApplication } from '../services/hiringApplicationService'
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

async function settle<T>(operation: Promise<T>) {
  await vi.advanceTimersByTimeAsync(300)
  return operation
}

describe('mock hiring application service', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('normalizes contact data and returns a separate application record', async () => {
    const record = await settle(submitHiringApplication(validInput))
    expect(record).toEqual({
      ...validInput,
      first_name: 'Ari',
      last_name: 'Rivera',
      email: 'ari@example.com',
      phone: '8605550134',
      city: 'Hartford',
      other_language: 'French',
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      source: 'landing_page',
      created_at: expect.any(String),
    })
    expect(new Date(record.created_at).toISOString()).toBe(record.created_at)
    expect(record.has_vehicle).toBe(false)
    expect(record.languages).toEqual(['english', 'spanish', 'other'])
  })

  it('requires every answer, keeps No distinct from unanswered, and checks Other', () => {
    const missing = validateHiringApplication(initialHiringApplication)
    expect(missing.has_vehicle).toBe('Choose Yes or No.')
    expect(missing.languages).toBe('Select at least one language.')
    expect(validateHiringApplication({ ...validInput, other_language: '' }).other_language).toBe('Specify the other language.')
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

  it('rejects invalid input and permits retry after a one-shot failure', async () => {
    const invalid = submitHiringApplication({ ...validInput, email: 'invalid' })
    const invalidAssertion = expect(invalid).rejects.toThrow('incomplete or invalid')
    await vi.advanceTimersByTimeAsync(300)
    await invalidAssertion

    failNextHiringApplication()
    const failed = submitHiringApplication(validInput)
    const failedAssertion = expect(failed).rejects.toThrow('submission failed')
    await vi.advanceTimersByTimeAsync(300)
    await failedAssertion

    expect(await settle(submitHiringApplication(validInput))).toHaveProperty('id')
  })
})
