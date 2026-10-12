import { createClient } from '@supabase/supabase-js'
import type { ApplicantSubmission, WaitlistSubmission } from './validation'
import { createZipToken } from './zipToken'

export interface SupabaseConfig {
  url: string
  secretKey: string
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim()
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
  if (!url || !secretKey) return null
  try {
    if (new URL(url).protocol !== 'https:') return null
  } catch {
    return null
  }
  return { url, secretKey }
}

export type CreateResult =
  | { kind: 'created'; id: string; createdAt: string; zipToken?: string }
  | { kind: 'duplicate' }
  | { kind: 'unavailable' }

export type ZipUpdateResult =
  | { kind: 'updated'; zipCode: string }
  | { kind: 'not_found' }
  | { kind: 'unavailable' }

export interface SubmissionStore {
  createWaitlist(input: WaitlistSubmission): Promise<CreateResult>
  createApplicant(input: ApplicantSubmission): Promise<CreateResult>
  updateWaitlistZip(id: string, zipCode: string): Promise<ZipUpdateResult>
}

export function createSubmissionStore(config: SupabaseConfig): SubmissionStore | null {
  const client = createClient(config.url, config.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return {
    async createWaitlist(input) {
      const { data, error } = await client
        .schema('public')
        .from('waitlist_subscribers')
        .insert({ email: input.email, source: 'landing_page' })
        .select('id, created_at')
        .single()

      if (error?.code === '23505') return { kind: 'duplicate' }
      if (error || !data || typeof data.id !== 'string' || typeof data.created_at !== 'string') {
        return { kind: 'unavailable' }
      }
      return {
        kind: 'created',
        id: data.id,
        createdAt: data.created_at,
        zipToken: createZipToken(data.id, config.secretKey),
      }
    },
    async createApplicant(input: ApplicantSubmission) {
      const { data, error } = await client
        .schema('public')
        .from('cleaning_applicants')
        .insert({
          full_name: `${input.first_name} ${input.last_name}`,
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email,
          phone: input.phone,
          city: input.city,
          state: input.state,
          has_personal_vehicle: input.has_vehicle,
          cleaning_experience: input.cleaning_experience,
          languages: input.languages,
          other_language: input.other_language,
          travel_distance: input.travel_distance,
          preferred_availability: input.preferred_availability,
          status: 'new',
          source: 'landing_page',
        })
        .select('id, created_at')
        .single()

      if (error || !data || typeof data.id !== 'string' || typeof data.created_at !== 'string') {
        return { kind: 'unavailable' }
      }
      return { kind: 'created', id: data.id, createdAt: data.created_at }
    },
    async updateWaitlistZip(id, zipCode) {
      const { data, error } = await client
        .schema('public')
        .from('waitlist_subscribers')
        .update({ zip_code: zipCode })
        .eq('id', id)
        .select('zip_code')
        .maybeSingle()

      if (error) return { kind: 'unavailable' }
      if (!data || typeof data.zip_code !== 'string') return { kind: 'not_found' }
      return { kind: 'updated', zipCode: data.zip_code }
    },
  }
}
