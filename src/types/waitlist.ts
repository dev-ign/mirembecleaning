export type WaitlistSource = 'landing_page'

export interface WaitlistRecord {
  id: string | null
  email: string
  zip_code: string | null
  zip_token: string | null
  source: WaitlistSource
  created_at: string | null
}

export interface CreateWaitlistInput {
  email: string
  source: WaitlistSource
}

export interface UpdateWaitlistZipInput {
  record: WaitlistRecord
  zip_code: string
}
