import type { CreateWaitlistInput, UpdateWaitlistZipInput, WaitlistRecord } from '../types/waitlist'

export class WaitlistRequestError extends Error {
  constructor(public readonly kind: 'invalid' | 'unavailable' | 'invalid_token' | 'verification') {
    super('Waitlist request failed')
  }
}

async function readResponse(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown
  } catch {
    throw new WaitlistRequestError('unavailable')
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function createWaitlistEntry(input: CreateWaitlistInput, turnstileToken: string): Promise<WaitlistRecord> {
  const email = input.email.trim().toLowerCase()
  let response: Response
  try {
    response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, turnstileToken }),
    })
  } catch {
    throw new WaitlistRequestError('unavailable')
  }

  const payload = await readResponse(response)
  if (response.status === 400 && isObject(payload) && isObject(payload.error) && payload.error.code === 'VERIFICATION_FAILED') {
    throw new WaitlistRequestError('verification')
  }
  if (response.status === 400) throw new WaitlistRequestError('invalid')
  if (!isObject(payload) || payload.ok !== true || !isObject(payload.data)) {
    throw new WaitlistRequestError('unavailable')
  }

  if (response.status === 201 && typeof payload.data.id === 'string'
    && typeof payload.data.created_at === 'string' && typeof payload.data.zip_token === 'string') {
    return {
      id: payload.data.id,
      email,
      zip_code: null,
      zip_token: payload.data.zip_token,
      source: 'landing_page',
      created_at: payload.data.created_at,
    }
  }
  if (response.status === 200 && payload.data.acknowledged === true) {
    return { id: null, email, zip_code: null, zip_token: null, source: 'landing_page', created_at: null }
  }
  throw new WaitlistRequestError('unavailable')
}

export async function updateWaitlistZip({ record, zip_code }: UpdateWaitlistZipInput): Promise<WaitlistRecord> {
  if (!record.zip_token) throw new WaitlistRequestError('invalid_token')

  let response: Response
  try {
    response = await fetch('/api/waitlist/zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_token: record.zip_token, zip_code }),
    })
  } catch {
    throw new WaitlistRequestError('unavailable')
  }

  const payload = await readResponse(response)
  if (response.status === 400) throw new WaitlistRequestError('invalid_token')
  if (response.status === 200 && isObject(payload) && payload.ok === true
    && isObject(payload.data) && typeof payload.data.zip_code === 'string') {
    return { ...record, zip_code: payload.data.zip_code }
  }
  throw new WaitlistRequestError('unavailable')
}
