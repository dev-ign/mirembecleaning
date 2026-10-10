import type { CreateWaitlistInput, UpdateWaitlistZipInput, WaitlistRecord } from '../types/waitlist'

// Development-only storage. Refreshing the page clears these records.
const mockRecords = new Map<string, WaitlistRecord>()
const failNext = { create: false, update: false }
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ZIP_REGEX = /^\d{5}$/

function simulateLatency() {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, 300))
}

/** Allows a test to exercise either error path without changing UI code. */
export function failNextWaitlistOperation(operation: 'create' | 'update') {
  failNext[operation] = true
}

export async function createWaitlistEntry(input: CreateWaitlistInput): Promise<WaitlistRecord> {
  await simulateLatency()

  if (failNext.create) {
    failNext.create = false
    throw new Error('Mock waitlist creation failed')
  }

  const email = input.email.trim().toLowerCase()
  if (!EMAIL_REGEX.test(email)) {
    throw new Error('A valid email address is required')
  }

  const record: WaitlistRecord = {
    id: crypto.randomUUID(),
    email,
    zip_code: null,
    source: input.source,
    created_at: new Date().toISOString(),
  }

  mockRecords.set(record.id, record)
  return { ...record }
}

export async function updateWaitlistZip(input: UpdateWaitlistZipInput): Promise<WaitlistRecord> {
  await simulateLatency()

  if (failNext.update) {
    failNext.update = false
    throw new Error('Mock ZIP update failed')
  }

  if (!ZIP_REGEX.test(input.zip_code)) {
    throw new Error('A five-digit ZIP code is required')
  }

  const existing = mockRecords.get(input.id)
  if (!existing) {
    throw new Error('Waitlist entry was not found')
  }

  const updated = { ...existing, zip_code: input.zip_code }
  mockRecords.set(input.id, updated)
  return { ...updated }
}
