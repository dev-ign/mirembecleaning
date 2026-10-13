import type { SupabaseClient } from '@supabase/supabase-js'
import { SheetsApiError, SheetsClient } from './client.js'
import { SHEET_TABS, type SheetKind } from './mapping.js'

const PAGE_SIZE = 500

// Reserved documentation domains are known synthetic addresses. Other test
// records need explicit UUID exclusions because names and free-text are ambiguous.
export function isKnownTestEmail(email: string): boolean {
  return /@(?:example\.(?:com|org|net)|[^@]+\.(?:test|invalid))$/i.test(email)
}

async function readIds(db: SupabaseClient, table: string, kind?: SheetKind): Promise<{ id: string; email?: string }[]> {
  const rows: { id: string; email?: string }[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = db.schema('public').from(table).select(kind ? 'id,submission_id' : 'id,email')
      .order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1)
    if (kind) query = query.eq('kind', kind)
    else query = query.eq('source', 'landing_page')
    const { data, error } = await query
    if (error || !data) throw new Error('Backfill database read failed')
    for (const row of data) {
      const value = row as { id: string; submission_id?: string; email?: string }
      rows.push({ id: kind ? value.submission_id ?? '' : value.id, email: value.email })
    }
    if (data.length < PAGE_SIZE) return rows
  }
}

export interface BackfillCount {
  kind: SheetKind
  sourceRows: number
  knownTests: number
  excluded: number
  alreadyInSheet: number
  alreadyQueued: number
  eligible: number
  headerReady: boolean
}

export async function planBackfill(
  db: SupabaseClient, sheets: SheetsClient, exclusions: Set<string>,
): Promise<{ counts: BackfillCount[]; jobs: { kind: SheetKind; submission_id: string }[] }> {
  const counts: BackfillCount[] = []
  const jobs: { kind: SheetKind; submission_id: string }[] = []
  for (const kind of ['waitlist', 'hiring'] as const) {
    const table = kind === 'waitlist' ? 'waitlist_subscribers' : 'cleaning_applicants'
    const [source, queued, sheet] = await Promise.all([
      readIds(db, table), readIds(db, 'sheets_sync_outbox', kind), sheets.inspect(kind),
    ])
    const headerReady = SHEET_TABS[kind].headers.every((value, index) => sheet.header[index] === value)
    if (sheet.header.length && !headerReady) {
      throw new SheetsApiError('sheet_header_missing', false)
    }
    const queuedIds = new Set(queued.map((row) => row.id))
    const count: BackfillCount = { kind, sourceRows: source.length, knownTests: 0, excluded: 0,
      alreadyInSheet: 0, alreadyQueued: 0, eligible: 0, headerReady }
    for (const row of source) {
      if (isKnownTestEmail(row.email ?? '')) count.knownTests += 1
      else if (exclusions.has(row.id)) count.excluded += 1
      else if (sheet.ids.has(row.id)) count.alreadyInSheet += 1
      else if (queuedIds.has(row.id)) count.alreadyQueued += 1
      else { count.eligible += 1; jobs.push({ kind, submission_id: row.id }) }
    }
    counts.push(count)
  }
  return { counts, jobs }
}

export async function enqueueBackfill(db: SupabaseClient, jobs: { kind: SheetKind; submission_id: string }[]): Promise<void> {
  for (let offset = 0; offset < jobs.length; offset += 100) {
    const { error } = await db.schema('public').from('sheets_sync_outbox')
      .upsert(jobs.slice(offset, offset + 100), { onConflict: 'kind,submission_id', ignoreDuplicates: true })
    if (error) throw new Error('Backfill enqueue failed')
  }
}
