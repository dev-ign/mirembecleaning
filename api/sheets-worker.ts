import { timingSafeEqual } from 'node:crypto'
import { processSheetJobs } from '../server/sheets/worker.js'

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization')
  if (!secret || secret.length < 16 || !header?.startsWith('Bearer ')) return false
  const received = Buffer.from(header.slice(7))
  const expected = Buffer.from(secret)
  return received.length === expected.length && timingSafeEqual(received, expected)
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (!authorized(request)) return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } })
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET' } })
    try {
      const started = Date.now()
      let processed = 0
      let failed = 0
      for (let batch = 0; batch < 5 && Date.now() - started < 40_000; batch += 1) {
        const result = await processSheetJobs(2)
        processed += result.processed
        failed += result.failed
        if (result.processed < 2) break
      }
      return Response.json({ ok: true, processed, failed }, { headers: { 'Cache-Control': 'no-store' } })
    } catch {
      return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
  },
}
