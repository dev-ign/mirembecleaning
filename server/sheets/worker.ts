import { z } from 'zod'
import { createServiceClient, getSupabaseConfig } from '../database.js'
import { SheetsApiError, SheetsClient } from './client.js'
import { getSheetsConfig } from './config.js'
import { mapSubmission, SHEET_TABS, type SheetKind, type SubmissionRow } from './mapping.js'

export const sheetJobSchema = z.object({
  id: z.uuid(),
  submission_id: z.uuid(),
  kind: z.enum(['waitlist', 'hiring']),
  lease_token: z.uuid(),
})

type Database = ReturnType<typeof createServiceClient>

export async function syncSheetSubmission(
  kind: SheetKind, submissionId: string, db: Database, sheets: SheetsClient,
): Promise<'appended' | 'existing'> {
  const inspection = await sheets.inspect(kind)
  if (!SHEET_TABS[kind].headers.every((value, index) => inspection.header[index] === value)) {
    throw new SheetsApiError('sheet_header_missing', false)
  }
  if (inspection.ids.has(submissionId)) return 'existing'

  const table = kind === 'waitlist' ? 'waitlist_subscribers' : 'cleaning_applicants'
  const fields = kind === 'waitlist' ? 'id,email,created_at' : 'id,first_name,last_name,email,phone,city,state,created_at'
  const { data, error } = await db.schema('public').from(table).select(fields)
    .eq('id', submissionId).eq('source', 'landing_page').maybeSingle()
  if (error) throw new SheetsApiError('submission_read_failed', true)
  if (!data) throw new SheetsApiError('submission_missing', false)
  const row = data as unknown as SubmissionRow
  if (row.id !== submissionId || typeof row.email !== 'string' || typeof row.created_at !== 'string') {
    throw new SheetsApiError('submission_invalid', false)
  }
  const values = mapSubmission(kind, row)
  await sheets.append(kind, values)
  return 'appended'
}

export async function processSheetJobs(limit = 2, submissionId?: string): Promise<{ processed: number; failed: number }> {
  const dbConfig = getSupabaseConfig()
  const sheetsConfig = getSheetsConfig()
  if (!dbConfig || !sheetsConfig) throw new Error('Sheets worker configuration is incomplete')
  const db = createServiceClient(dbConfig)
  const sheets = new SheetsClient(sheetsConfig)
  const { data, error } = await db.rpc('claim_sheet_jobs', { p_limit: limit, p_submission_id: submissionId ?? null })
  if (error || !Array.isArray(data)) throw new Error('Sheets job claim failed')

  let failed = 0
  for (const raw of data) {
    const parsed = sheetJobSchema.safeParse(raw)
    if (!parsed.success) {
      console.error('Sheets job has invalid shape')
      failed += 1
      continue
    }
    const job = parsed.data
    let result: { synced: boolean; code: string | null; retryable: boolean }
    try {
      await syncSheetSubmission(job.kind, job.submission_id, db, sheets)
      result = { synced: true, code: null, retryable: false }
    } catch (cause) {
      result = cause instanceof SheetsApiError
        ? { synced: false, code: cause.code, retryable: cause.retryable }
        : { synced: false, code: 'sheet_sync_failed', retryable: true }
    }
    const { data: completed, error: completionError } = await db.rpc('complete_sheet_job', {
      p_id: job.id,
      p_lease_token: job.lease_token,
      p_synced: result.synced,
      p_error_code: result.code,
      p_retryable: result.retryable,
    })
    if (completionError || completed !== true) {
      console.error('Sheets job completion failed', { jobId: job.id })
      failed += 1
    } else if (!result.synced) {
      console.warn('Sheets job sync failed', { jobId: job.id, code: result.code })
      failed += 1
    }
  }
  return { processed: data.length, failed }
}
