import { createServiceClient, getSupabaseConfig } from '../database.js'
import { getEmailConfig } from './config.js'
import { jobSchema, sendEmailJob } from './send.js'

export async function processEmailJobs(limit = 10, submissionId?: string): Promise<{ processed: number; failed: number }> {
  const dbConfig = getSupabaseConfig()
  const emailConfig = getEmailConfig()
  if (!dbConfig || !emailConfig) throw new Error('Email worker configuration is incomplete')

  const client = createServiceClient(dbConfig)
  const { data, error } = await client.rpc('claim_email_jobs', {
    p_limit: limit,
    p_submission_id: submissionId ?? null,
  })
  if (error || !Array.isArray(data)) throw new Error('Email job claim failed')

  let failed = 0
  for (const raw of data) {
    const parsed = jobSchema.safeParse(raw)
    if (!parsed.success) {
      // Invalid rows need manual inspection; do not log payload or recipients.
      console.error('Email job has invalid shape')
      failed += 1
      continue
    }
    const job = parsed.data
    const result = await sendEmailJob(job, emailConfig)
    const errorCode = 'code' in result ? result.code : null
    const retryable = 'retryable' in result ? result.retryable : false
    const { data: completed, error: completionError } = await client.rpc('complete_email_job', {
      p_id: job.id,
      p_lease_token: job.lease_token,
      p_delivered: result.delivered,
      p_resend_id: result.delivered ? result.resendId : null,
      p_error_code: errorCode,
      p_retryable: retryable,
    })
    if (completionError || completed !== true) {
      console.error('Email job completion failed', { jobId: job.id })
      failed += 1
    } else if (!result.delivered) {
      console.warn('Email job delivery failed', { jobId: job.id, code: errorCode })
      failed += 1
    }
  }
  return { processed: data.length, failed }
}
