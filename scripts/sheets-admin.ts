import { readFile } from 'node:fs/promises'
import { createServiceClient, getSupabaseConfig } from '../server/database.js'
import { planBackfill, enqueueBackfill } from '../server/sheets/backfill.js'
import { SheetsClient } from '../server/sheets/client.js'
import { getSheetsConfig } from '../server/sheets/config.js'
import { processSheetJobs } from '../server/sheets/worker.js'

async function main() {
  const args = process.argv.slice(2)
  const mode = args[0] ?? '--dry-run'
  if (!['--dry-run', '--apply', '--format'].includes(mode)) throw new Error('Use --dry-run, --apply, or --format')
  const sheetsConfig = getSheetsConfig()
  if (!sheetsConfig) throw new Error('Sheets configuration is incomplete')
  const sheets = new SheetsClient(sheetsConfig)
  if (mode === '--format') {
    await sheets.prepareTabs()
    console.info('Spreadsheet headers and presentation prepared')
    return
  }
  const dbConfig = getSupabaseConfig()
  if (!dbConfig) throw new Error('Supabase configuration is incomplete')
  const exclusionFlag = args.indexOf('--exclude-file')
  if (mode === '--apply' && (exclusionFlag === -1 || !args.includes('--approved-backfill'))) {
    throw new Error('Applying backfill requires --approved-backfill and --exclude-file')
  }
  let excludedIds: string[] = []
  if (exclusionFlag !== -1) {
    const file = args[exclusionFlag + 1]
    if (!file) throw new Error('Missing exclusion file path')
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id))) {
      throw new Error('Exclusion file must be a JSON array of submission UUIDs')
    }
    excludedIds = parsed
  }
  const db = createServiceClient(dbConfig)
  const plan = await planBackfill(db, sheets, new Set(excludedIds))
  console.table(plan.counts)
  if (mode === '--dry-run') {
    console.info('Dry run only. Review unidentified test records before approving an apply run.')
    return
  }
  if (plan.counts.some((count) => !count.headerReady)) throw new Error('Run approved spreadsheet formatting before applying backfill')
  await enqueueBackfill(db, plan.jobs)
  console.info(`Enqueued ${plan.jobs.length} backfill jobs`)
  let processed = 0
  let failed = 0
  for (let batch = 0; batch < 100; batch += 1) {
    const result = await processSheetJobs(2)
    processed += result.processed
    failed += result.failed
    if (result.processed < 2) break
  }
  console.info(`Processed ${processed} due jobs; ${failed} attempt(s) failed. The cron recovers remaining or retriable jobs.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Sheets administration failed')
  process.exitCode = 1
})
