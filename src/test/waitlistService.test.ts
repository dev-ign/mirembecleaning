import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWaitlistEntry, failNextWaitlistOperation, updateWaitlistZip } from '../services/waitlistService'

async function settle<T>(operation: Promise<T>) {
  await vi.advanceTimersByTimeAsync(300)
  return operation
}

async function rejects(operation: Promise<unknown>, message: string) {
  const assertion = expect(operation).rejects.toThrow(message)
  await vi.advanceTimersByTimeAsync(300)
  await assertion
}

describe('mock waitlist service', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('creates a typed record with a UUID, normalized email, timestamp, and empty ZIP', async () => {
    const record = await settle(createWaitlistEntry({ email: '  Person@Example.com  ', source: 'landing_page' }))

    expect(record).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
      email: 'person@example.com',
      zip_code: null,
      source: 'landing_page',
      created_at: expect.any(String),
    })
    expect(new Date(record.created_at).toISOString()).toBe(record.created_at)
  })

  it('updates that record by ID while preserving its original fields and leading zeros', async () => {
    const created = await settle(createWaitlistEntry({ email: 'owner@example.com', source: 'landing_page' }))
    const updated = await settle(updateWaitlistZip({ id: created.id, zip_code: '02108' }))
    const edited = await settle(updateWaitlistZip({ id: created.id, zip_code: '06001' }))

    expect(updated).toEqual({ ...created, zip_code: '02108' })
    expect(updated.id).toBe(created.id)
    expect(edited).toEqual({ ...created, zip_code: '06001' })
  })

  it('rejects invalid input and missing record IDs', async () => {
    await rejects(createWaitlistEntry({ email: 'invalid', source: 'landing_page' }), 'valid email')
    await rejects(updateWaitlistZip({ id: 'missing', zip_code: '02108' }), 'not found')
    await rejects(updateWaitlistZip({ id: 'missing', zip_code: '1234' }), 'five-digit')
  })

  it('supports one-shot create and update failures without corrupting the record', async () => {
    failNextWaitlistOperation('create')
    await rejects(createWaitlistEntry({ email: 'owner@example.com', source: 'landing_page' }), 'creation failed')

    const created = await settle(createWaitlistEntry({ email: 'owner@example.com', source: 'landing_page' }))
    failNextWaitlistOperation('update')
    await rejects(updateWaitlistZip({ id: created.id, zip_code: '02108' }), 'ZIP update failed')
    const updated = await settle(updateWaitlistZip({ id: created.id, zip_code: '02108' }))
    expect(updated).toEqual({ ...created, zip_code: '02108' })
  })
})
