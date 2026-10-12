import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWaitlistEntry, updateWaitlistZip, WaitlistRequestError } from '../services/waitlistService'
import type { WaitlistRecord } from '../types/waitlist'

const record: WaitlistRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'person@example.com',
  zip_code: null,
  zip_token: 'signed-token',
  source: 'landing_page',
  created_at: '2026-10-11T00:00:00Z',
}

function mockResponse(status: number, data: unknown) {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json(data, { status }))
}

describe('waitlist API service', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('sends only normalized email and returns a stored record on 201', async () => {
    mockResponse(201, { ok: true, data: { id: record.id, created_at: record.created_at, zip_token: record.zip_token } })
    const created = await createWaitlistEntry({ email: '  PERSON@Example.com  ', source: 'landing_page' })
    expect(created).toEqual(record)
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'person@example.com' }),
    })
  })

  it('accepts a duplicate acknowledgment without inventing a row ID or ZIP token', async () => {
    mockResponse(200, { ok: true, data: { acknowledged: true } })
    const acknowledged = await createWaitlistEntry({ email: 'person@example.com', source: 'landing_page' })
    expect(acknowledged).toEqual({ ...record, id: null, zip_token: null, created_at: null })
    await expect(updateWaitlistZip({ record: acknowledged, zip_code: '02108' }))
      .rejects.toMatchObject({ kind: 'invalid_token' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects validation errors, outages, malformed success responses, and network failures', async () => {
    mockResponse(400, { ok: false, error: { code: 'INVALID_REQUEST' } })
    await expect(createWaitlistEntry({ email: 'bad', source: 'landing_page' }))
      .rejects.toMatchObject({ kind: 'invalid' })

    mockResponse(503, { ok: false, error: { code: 'SERVICE_UNAVAILABLE' } })
    await expect(createWaitlistEntry({ email: record.email, source: 'landing_page' }))
      .rejects.toBeInstanceOf(WaitlistRequestError)

    mockResponse(201, { ok: true, data: { id: record.id } })
    await expect(createWaitlistEntry({ email: record.email, source: 'landing_page' }))
      .rejects.toMatchObject({ kind: 'unavailable' })

    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
    await expect(createWaitlistEntry({ email: record.email, source: 'landing_page' }))
      .rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('uses the signed registration token to save ZIP and accepts ZIP+4', async () => {
    mockResponse(200, { ok: true, data: { zip_code: '02108-1234' } })
    const updated = await updateWaitlistZip({ record, zip_code: '021081234' })
    expect(updated).toEqual({ ...record, zip_code: '02108-1234' })
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/waitlist/zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_token: 'signed-token', zip_code: '021081234' }),
    })
  })

  it('keeps ZIP errors separate from the accepted registration', async () => {
    mockResponse(400, { ok: false, error: { code: 'INVALID_REQUEST' } })
    await expect(updateWaitlistZip({ record, zip_code: '02108' }))
      .rejects.toMatchObject({ kind: 'invalid_token' })
    mockResponse(503, { ok: false, error: { code: 'SERVICE_UNAVAILABLE' } })
    await expect(updateWaitlistZip({ record, zip_code: '02108' }))
      .rejects.toMatchObject({ kind: 'unavailable' })
  })
})
