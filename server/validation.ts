import { z } from 'zod'
import { isValidEmail } from '../src/shared/email'

const email = z.string().trim().toLowerCase().max(254).refine(isValidEmail)
const shortText = (limit: number) => z.string().trim().min(1).max(limit)

// The source is assigned by the server. It is not a user-supplied form field.
export const waitlistSchema = z.strictObject({
  email,
})

export const zipUpdateSchema = z.strictObject({
  registration_token: z.string().min(1).max(256),
  zip_code: z.string().trim().regex(/^\d{5}(?:-?\d{4})?$/).transform((value) =>
    value.length === 9 ? `${value.slice(0, 5)}-${value.slice(5)}` : value),
})

const phone = z.string().trim().max(32)
  .regex(/^[+()\d.\s-]+$/)
  .transform((value) => {
    const digits = value.replace(/\D/g, '')
    return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  })
  .pipe(z.string().regex(/^\d{10}$/))

export const applicantSchema = z.strictObject({
  first_name: shortText(80),
  last_name: shortText(80),
  email,
  phone,
  city: shortText(100),
  state: z.enum(['CT', 'MA']),
  has_vehicle: z.boolean(),
  cleaning_experience: z.enum(['none', 'under_1_year', '1_to_3_years', '3_plus_years']),
  languages: z.array(z.enum(['english', 'spanish', 'haitian_creole', 'portuguese', 'other'])).min(1).max(5),
  other_language: z.string().trim().max(80).nullable(),
  travel_distance: z.enum(['under_5_miles', '10_miles', '20_miles', 'over_25_miles']),
  preferred_availability: z.enum(['full_time', 'part_time', 'both']),
}).superRefine((value, context) => {
  if (new Set(value.languages).size !== value.languages.length) {
    context.addIssue({ code: 'custom', path: ['languages'], message: 'Duplicate language' })
  }
  if (value.languages.includes('other') && !value.other_language) {
    context.addIssue({ code: 'custom', path: ['other_language'], message: 'Other language is required' })
  }
}).transform((value) => ({
  ...value,
  other_language: value.languages.includes('other') ? value.other_language : null,
}))

export type WaitlistSubmission = z.output<typeof waitlistSchema>
export type ZipUpdateSubmission = z.output<typeof zipUpdateSchema>
export type ApplicantSubmission = z.output<typeof applicantSchema>
