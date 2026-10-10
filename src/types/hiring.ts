export type ApplicantState = 'CT' | 'MA'
export type CleaningExperience = 'none' | 'under_1_year' | '1_to_3_years' | '3_plus_years'
export type TravelDistance = 'under_5_miles' | '10_miles' | '20_miles' | 'over_25_miles'
export type PreferredAvailability = 'full_time' | 'part_time' | 'both'
export type SpokenLanguage = 'english' | 'spanish' | 'haitian_creole' | 'portuguese' | 'other'

export interface HiringApplicationInput {
  first_name: string
  last_name: string
  email: string
  phone: string
  city: string
  state: ApplicantState | null
  has_vehicle: boolean | null
  cleaning_experience: CleaningExperience | null
  languages: SpokenLanguage[]
  other_language: string | null
  travel_distance: TravelDistance | null
  preferred_availability: PreferredAvailability | null
}

export interface HiringApplicationRecord extends HiringApplicationInput {
  id: string
  source: 'landing_page'
  created_at: string
}

export type HiringField = keyof HiringApplicationInput
export type HiringErrors = Partial<Record<HiringField, string>>

export const experienceOptions: ReadonlyArray<{ value: CleaningExperience; label: string }> = [
  { value: 'none', label: 'No professional experience' },
  { value: 'under_1_year', label: 'Under 1 year' },
  { value: '1_to_3_years', label: '1–3 years' },
  { value: '3_plus_years', label: '3+ years' },
]

export const languageOptions: ReadonlyArray<{ value: SpokenLanguage; label: string }> = [
  { value: 'english', label: 'English' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'haitian_creole', label: 'Haitian Creole' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'other', label: 'Other' },
]

export const travelOptions: ReadonlyArray<{ value: TravelDistance; label: string }> = [
  { value: 'under_5_miles', label: 'Less than 5 miles' },
  { value: '10_miles', label: '10 miles' },
  { value: '20_miles', label: '20 miles' },
  { value: 'over_25_miles', label: 'More than 25 miles' },
]

export const availabilityOptions: ReadonlyArray<{ value: PreferredAvailability; label: string }> = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'both', label: 'Open to both' },
]

export const initialHiringApplication: HiringApplicationInput = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  city: '',
  state: null,
  has_vehicle: null,
  cleaning_experience: null,
  languages: [],
  other_language: null,
  travel_distance: null,
  preferred_availability: null,
}
