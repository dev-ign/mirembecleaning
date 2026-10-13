// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { enqueueBackfill, isKnownTestEmail, planBackfill } from './backfill.js'
import type { SheetsClient } from './client.js'
import { SHEET_TABS } from './mapping.js'

const sourceRows = {
  waitlist_subscribers: [
    { id: '00000000-0000-4000-8000-000000000001', email: 'person@example.org' },
    { id: '00000000-0000-4000-8000-000000000002', email: 'customer@mirembe.com' },
    { id: '00000000-0000-4000-8000-000000000003', email: 'second@mirembe.com' },
  ],
  cleaning_applicants: [
    { id: '00000000-0000-4000-8000-000000000004', email: 'applicant@mirembe.com' },
  ],
  sheets_sync_outbox: [
    { id: 'job-id', submission_id: '00000000-0000-4000-8000-000000000003', kind: 'waitlist' },
  ],
}

function fakeDb() {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const from = vi.fn((table: keyof typeof sourceRows) => ({
    upsert,
    select: () => {
      let kind: string | undefined
      let start = 0
      let end = 499
      const query = {
        order: () => query,
        range: (a: number, b: number) => { start = a; end = b; return query },
        eq: (field: string, value: string) => { if (field === 'kind') kind = value; return query },
        then: (resolve: (result: unknown) => void) => resolve({
          data: sourceRows[table].filter((row) => !kind || ('kind' in row && row.kind === kind)).slice(start, end + 1), error: null,
        }),
      }
      return query
    },
  }))
  return { db: { schema: () => ({ from }) } as unknown as SupabaseClient, upsert }
}

describe('backfill planning', () => {
  it('excludes identifiable tests, explicit IDs, sheet rows, and already queued records in a dry run', async () => {
    const { db, upsert } = fakeDb()
    const sheet = { inspect: vi.fn().mockImplementation(async (kind: 'waitlist' | 'hiring') => ({
      header: [...SHEET_TABS[kind].headers],
      ids: kind === 'waitlist' ? new Set(['00000000-0000-4000-8000-000000000002']) : new Set<string>(),
    })) } as unknown as SheetsClient
    const plan = await planBackfill(db, sheet, new Set(['00000000-0000-4000-8000-000000000004']))
    expect(plan.counts).toEqual([
      { kind: 'waitlist', sourceRows: 3, knownTests: 1, excluded: 0, alreadyInSheet: 1, alreadyQueued: 1, eligible: 0, headerReady: true },
      { kind: 'hiring', sourceRows: 1, knownTests: 0, excluded: 1, alreadyInSheet: 0, alreadyQueued: 0, eligible: 0, headerReady: true },
    ])
    expect(plan.jobs).toEqual([])
    expect(upsert).not.toHaveBeenCalled()
    expect(isKnownTestEmail('local@example.com')).toBe(true)
    expect(isKnownTestEmail('real@mirembe.com')).toBe(false)
  })

  it('enqueues only eligible IDs and uses the unique kind and ID key', async () => {
    const { db, upsert } = fakeDb()
    const jobs = [{ kind: 'hiring' as const, submission_id: '00000000-0000-4000-8000-000000000004' }]
    await enqueueBackfill(db, jobs)
    expect(upsert).toHaveBeenCalledWith(jobs, { onConflict: 'kind,submission_id', ignoreDuplicates: true })
  })

  it('reports eligibility against empty tabs without writing or requiring formatting first', async () => {
    const { db, upsert } = fakeDb()
    const sheet = { inspect: vi.fn().mockResolvedValue({ header: [], ids: new Set<string>() }) } as unknown as SheetsClient
    const plan = await planBackfill(db, sheet, new Set())
    expect(plan.counts.map((count) => count.headerReady)).toEqual([false, false])
    expect(plan.counts.map((count) => count.eligible)).toEqual([1, 1])
    expect(upsert).not.toHaveBeenCalled()
  })
})
