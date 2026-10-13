import { Resend } from 'resend'
import { z } from 'zod'
import { isValidEmail } from '../../src/shared/email.js'
import type { EmailConfig } from './config.js'
import { renderTemplate } from './templates.js'

const kindSchema = z.enum(['waitlist_confirmation', 'waitlist_notification', 'hiring_confirmation', 'hiring_notification'])
const payloadSchema = z.object({
  email: z.string().refine(isValidEmail),
  created_at: z.string().datetime({ offset: true }).optional(),
  first_name: z.string().max(80).nullable().optional(),
  last_name: z.string().max(80).nullable().optional(),
  phone: z.string().max(32).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(2).nullable().optional(),
})

export const jobSchema = z.object({
  id: z.uuid(),
  submission_id: z.uuid(),
  lease_token: z.uuid(),
  idempotency_key: z.string().max(256),
  kind: kindSchema,
  payload: payloadSchema,
})

export type EmailJob = z.output<typeof jobSchema>
export type SendResult = { delivered: true; resendId: string } | { delivered: false; code: string; retryable: boolean }

const suffix = {
  waitlist_confirmation: 'customer-confirmation',
  waitlist_notification: 'admin-notification',
  hiring_confirmation: 'applicant-confirmation',
  hiring_notification: 'admin-notification',
} as const

export function hasStableKey(job: EmailJob): boolean {
  const group = job.kind.startsWith('waitlist') ? 'waitlist' : 'hiring'
  return job.idempotency_key === `${group}:${job.submission_id}:${suffix[job.kind]}`
}

export async function sendEmailJob(job: EmailJob, config: EmailConfig, resend = new Resend(config.apiKey)): Promise<SendResult> {
  if (!hasStableKey(job)) return { delivered: false, code: 'invalid_job_key', retryable: false }
  const to = job.kind.endsWith('notification') ? config.notificationEmail : job.payload.email
  if (!isValidEmail(to)) return { delivered: false, code: 'invalid_recipient', retryable: false }
  const from = job.kind.startsWith('hiring') ? config.careersFrom : config.from
  const subject = {
    waitlist_confirmation: "You're on the list! | Mirembe Cleaning",
    waitlist_notification: 'New Waitlist Registration | Mirembe Cleaning',
    hiring_confirmation: 'Application Received | Mirembe Cleaning',
    hiring_notification: 'New Cleaning Team Application | Mirembe Cleaning',
  }[job.kind]

  try {
    const { html, text } = await renderTemplate(job.kind, {
      email: job.payload.email,
      created_at: job.payload.created_at,
      first_name: job.payload.first_name ?? undefined,
      last_name: job.payload.last_name ?? undefined,
      phone: job.payload.phone ?? undefined,
      city: job.payload.city ?? undefined,
      state: job.payload.state ?? undefined,
    })
    const result = await resend.emails.send({ from, to: [to], subject, html, text }, { idempotencyKey: job.idempotency_key })
    if (result.error) {
      const code = result.error.name
      const retryable = code === 'rate_limit_exceeded' || code === 'concurrent_idempotent_requests'
        || code === 'application_error' || code === 'internal_server_error'
        || (result.error.statusCode !== null && result.error.statusCode >= 500)
      return { delivered: false, code, retryable }
    }
    return result.data?.id
      ? { delivered: true, resendId: result.data.id }
      : { delivered: false, code: 'missing_message_id', retryable: true }
  } catch {
    return { delivered: false, code: 'transport_error', retryable: true }
  }
}
