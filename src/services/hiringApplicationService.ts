import {
  availabilityOptions,
  experienceOptions,
  languageOptions,
  travelOptions,
  type HiringApplicationInput,
  type HiringApplicationRecord,
  type HiringErrors,
} from '../types/hiring'

const mockApplications = new Map<string, HiringApplicationRecord>()
let failNextSubmission = false

export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}

export function normalizePhone(phone: string): string | null {
  const digits = phoneDigits(phone)
  return digits.length === 10 ? digits : null
}

export function isValidEmail(value: string): boolean {
  const email = value.trim()
  if (!email || email.length > 254 || /\s/u.test(email)) return false
  const at = email.indexOf('@')
  if (at < 1 || at !== email.lastIndexOf('@')) return false
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  if (!/^[\p{L}\p{N}!#$%&'*+/=?^_`{|}~.-]+$/u.test(local)) return false
  const labels = domain.split('.')
  if (labels.length < 2 || labels.at(-1)!.length < 2) return false
  return labels.every((label) => label.length <= 63 && /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u.test(label))
}

export function validateHiringApplication(input: HiringApplicationInput): HiringErrors {
  const errors: HiringErrors = {}
  if (!input.first_name.trim()) errors.first_name = 'Enter your first name.'
  if (!input.last_name.trim()) errors.last_name = 'Enter your last name.'
  if (!isValidEmail(input.email)) errors.email = 'Enter a valid email address.'
  if (!normalizePhone(input.phone)) errors.phone = 'Enter a valid 10-digit phone number.'
  if (!input.city.trim()) errors.city = 'Enter your city or town.'
  if (input.state !== 'CT' && input.state !== 'MA') errors.state = 'Select Connecticut or Massachusetts.'
  if (typeof input.has_vehicle !== 'boolean') errors.has_vehicle = 'Choose Yes or No.'
  if (!experienceOptions.some((option) => option.value === input.cleaning_experience)) errors.cleaning_experience = 'Choose your experience level.'
  if (input.languages.length === 0 || input.languages.some((language) => !languageOptions.some((option) => option.value === language))) errors.languages = 'Select at least one language.'
  if (input.languages.includes('other') && !input.other_language?.trim()) errors.other_language = 'Specify the other language.'
  if (!travelOptions.some((option) => option.value === input.travel_distance)) errors.travel_distance = 'Choose a travel distance.'
  if (!availabilityOptions.some((option) => option.value === input.preferred_availability)) errors.preferred_availability = 'Choose your availability.'
  return errors
}

/** Development-only failure hook for the UI error path. */
export function failNextHiringApplication() {
  failNextSubmission = true
}

export async function submitHiringApplication(input: HiringApplicationInput): Promise<HiringApplicationRecord> {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 300))

  if (failNextSubmission) {
    failNextSubmission = false
    throw new Error('Mock hiring application submission failed')
  }

  if (Object.keys(validateHiringApplication(input)).length > 0) {
    throw new Error('Hiring application is incomplete or invalid')
  }

  const record: HiringApplicationRecord = {
    ...input,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalizePhone(input.phone)!,
    city: input.city.trim(),
    languages: [...new Set(input.languages)],
    other_language: input.languages.includes('other') ? input.other_language!.trim() : null,
    id: crypto.randomUUID(),
    source: 'landing_page',
    created_at: new Date().toISOString(),
  }

  mockApplications.set(record.id, record)
  return { ...record, languages: [...record.languages] }
}
