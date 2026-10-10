export type WaitlistSource = 'landing_page'

export interface WaitlistRecord {
  id: string
  email: string
  zip_code: string | null
  source: WaitlistSource
  created_at: string
}

export interface CreateWaitlistInput {
  email: string
  source: WaitlistSource
}

export interface UpdateWaitlistZipInput {
  id: string
  zip_code: string
}
