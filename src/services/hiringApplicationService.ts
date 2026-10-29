import en from '../i18n/locales/en.json'
import {
  availabilityOptions,
  experienceOptions,
  languageOptions,
  travelOptions,
  type HiringApplicationInput,
  type HiringApplicationRecord,
  type HiringErrors,
} from '../types/hiring'
import { isValidEmail } from '../shared/email'

export { isValidEmail } from '../shared/email'

export class HiringRequestError extends Error {
  constructor(public readonly kind: 'invalid' | 'unavailable' | 'verification') {
    super('Hiring application request failed')
  }
}

export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}

export function normalizePhone(phone: string): string | null {
  const digits = phoneDigits(phone)
  return digits.length === 10 ? digits : null
}

export function validateHiringApplication(input: HiringApplicationInput, translate: (key: keyof typeof en) => string = key => en[key]): HiringErrors {
  const errors: HiringErrors = {}
  if (!input.first_name.trim()) errors.first_name = translate('errors.firstName')
  else if (input.first_name.trim().length > 80) errors.first_name = translate('errors.max80')
  if (!input.last_name.trim()) errors.last_name = translate('errors.lastName')
  else if (input.last_name.trim().length > 80) errors.last_name = translate('errors.max80')
  if (!isValidEmail(input.email)) errors.email = translate('errors.email')
  if (!normalizePhone(input.phone)) errors.phone = translate('errors.phone')
  if (!input.city.trim()) errors.city = translate('errors.city')
  else if (input.city.trim().length > 100) errors.city = translate('errors.max100')
  if (input.state !== 'CT' && input.state !== 'MA') errors.state = translate('errors.state')
  if (typeof input.has_vehicle !== 'boolean') errors.has_vehicle = translate('errors.vehicle')
  if (!experienceOptions.some((option) => option.value === input.cleaning_experience)) errors.cleaning_experience = translate('errors.experience')
  if (input.languages.length === 0 || new Set(input.languages).size !== input.languages.length
    || input.languages.some((language) => !languageOptions.some((option) => option.value === language))) {
    errors.languages = translate('errors.languages')
  }
  if (input.languages.includes('other')) {
    if (!input.other_language?.trim()) errors.other_language = translate('errors.otherLanguage')
    else if (input.other_language.trim().length > 80) errors.other_language = translate('errors.max80')
  }
  if (!travelOptions.some((option) => option.value === input.travel_distance)) errors.travel_distance = translate('errors.travel')
  if (!availabilityOptions.some((option) => option.value === input.preferred_availability)) errors.preferred_availability = translate('errors.availability')
  return errors
}

export async function submitHiringApplication(input: HiringApplicationInput, turnstileToken: string, submissionKey: string = crypto.randomUUID()): Promise<HiringApplicationRecord> {
  if (Object.keys(validateHiringApplication(input)).length > 0) throw new HiringRequestError('invalid')

  const normalized: HiringApplicationInput = {
    ...input,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalizePhone(input.phone)!,
    city: input.city.trim(),
    languages: [...input.languages],
    other_language: input.languages.includes('other') ? input.other_language!.trim() : null,
  }

  let response: Response
  try {
    response = await fetch('/api/applicants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...normalized, submission_key: submissionKey, turnstileToken }),
    })
  } catch {
    throw new HiringRequestError('unavailable')
  }

  let payload: unknown
  try {
    payload = await response.json() as unknown
  } catch {
    throw new HiringRequestError('unavailable')
  }
  if (response.status === 400 && typeof payload === 'object' && payload !== null && 'error' in payload
    && typeof payload.error === 'object' && payload.error !== null && 'code' in payload.error
    && payload.error.code === 'VERIFICATION_FAILED') throw new HiringRequestError('verification')
  if (response.status === 400) throw new HiringRequestError('invalid')
  if (response.status !== 201 || typeof payload !== 'object' || payload === null || !('ok' in payload)
    || payload.ok !== true || !('data' in payload) || typeof payload.data !== 'object' || payload.data === null
    || !('id' in payload.data) || typeof payload.data.id !== 'string'
    || !('created_at' in payload.data) || typeof payload.data.created_at !== 'string') {
    throw new HiringRequestError('unavailable')
  }

  return { ...normalized, id: payload.data.id, source: 'landing_page', created_at: payload.data.created_at,
    ...(payload.data && 'replayed' in payload.data && payload.data.replayed === true ? { replayed: true } : {}) }
}
