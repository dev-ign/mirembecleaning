// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Resend } from 'resend'
import { getEmailConfig } from './config.js'
import { hasStableKey, sendEmailJob, type EmailJob } from './send.js'
import { renderTemplate } from './templates.js'

const config = {
  apiKey: 'test-only',
  from: 'Mirembe Cleaning <no-reply@mirembecleaning.com>',
  careersFrom: 'Mirembe Cleaning Careers <no-reply@mirembecleaning.com>',
  notificationEmail: 'mirembecleaning@gmail.com',
}
const submissionId = '00000000-0000-4000-8000-000000000001'
const id = '00000000-0000-4000-8000-000000000002'
const leaseToken = '00000000-0000-4000-8000-000000000003'
const keys = {
  waitlist_confirmation: `waitlist:${submissionId}:customer-confirmation`,
  waitlist_notification: `waitlist:${submissionId}:admin-notification`,
  hiring_confirmation: `hiring:${submissionId}:applicant-confirmation`,
  hiring_notification: `hiring:${submissionId}:admin-notification`,
}

function job(kind: EmailJob['kind']): EmailJob {
  return { id, submission_id: submissionId, lease_token: leaseToken, kind,
    idempotency_key: keys[kind], payload: {
      email: 'ari@example.com', created_at: '2026-10-12T10:00:00Z',
      first_name: 'Ari', last_name: 'Rivera', phone: '8605550134', city: 'Hartford', state: 'CT',
    } }
}

function mockResend(result: unknown) {
  const send = vi.fn().mockResolvedValue(result)
  return { send, client: { emails: { send } } as unknown as Resend }
}

afterEach(() => vi.unstubAllEnvs())

describe('email configuration', () => {
  it('requires valid server-only credentials, senders, and notification recipient', () => {
    vi.stubEnv('RESEND_API_KEY', 'test-only')
    vi.stubEnv('RESEND_FROM_EMAIL', config.from)
    vi.stubEnv('RESEND_CAREERS_EMAIL', config.careersFrom)
    vi.stubEnv('MIREMBE_NOTIFICATION_EMAIL', config.notificationEmail)
    expect(getEmailConfig()).toEqual(config)
    vi.stubEnv('RESEND_FROM_EMAIL', 'Injected\nBcc: victim@example.com')
    expect(getEmailConfig()).toBeNull()
  })
})

describe('transactional messages', () => {
  it('renders all four templates as safe HTML and readable plain text', async () => {
    for (const kind of Object.keys(keys) as EmailJob['kind'][]) {
      const { html, text } = await renderTemplate(kind, job(kind).payload)
      expect(html).toContain('Mirembe')
      expect(text).toContain('Mirembe')
      expect(html).toContain('mailto:hello@mirembecleaning.com')
      expect(html).not.toContain('<script')
      if (kind.startsWith('hiring')) expect(html).not.toContain('PRIORITY BOOKING')
    }
  })

  it('uses approved waitlist benefits and never claims the discount code was sent', async () => {
    const { html, text } = await renderTemplate('waitlist_confirmation', job('waitlist_confirmation').payload)
    expect(html).toContain('PRIORITY BOOKING')
    expect(html).toContain('$50 OFF')
    expect(text).toContain('January 2027')
    expect(text).toContain("We'll send you your discount code")
  })

  it('personalizes a verified applicant first name and escapes untrusted strings', async () => {
    const { html, text } = await renderTemplate('hiring_confirmation', { email: 'ari@example.com', first_name: '<Ari>' })
    expect(html).toContain('&lt;Ari&gt;')
    expect(html).not.toContain('<Ari>')
    expect(text).toContain('Hi <Ari>,')
    const generic = await renderTemplate('hiring_confirmation', { email: 'ari@example.com' })
    expect(generic.text).toContain('Hi there,')
  })

  it('uses fixed senders and the configured internal recipient for all four workflows', async () => {
    const { send, client } = mockResend({ data: { id: 'resend-id' }, error: null })
    for (const kind of Object.keys(keys) as EmailJob['kind'][]) {
      expect(hasStableKey(job(kind))).toBe(true)
      expect(await sendEmailJob(job(kind), config, client)).toEqual({ delivered: true, resendId: 'resend-id' })
      const [message, options] = send.mock.lastCall!
      expect(message.from).toBe(kind.startsWith('hiring') ? config.careersFrom : config.from)
      expect(message.to).toEqual([kind.endsWith('notification') ? config.notificationEmail : 'ari@example.com'])
      expect(message.subject).not.toContain('ari@example.com')
      expect(message.html).toContain('Mirembe')
      expect(message.text).toContain('Mirembe')
      expect(message).not.toHaveProperty('replyTo')
      expect(options).toEqual({ idempotencyKey: keys[kind] })
    }
  })

  it('maps only minimal validated hiring fields into the internal notice', async () => {
    const { text } = await renderTemplate('hiring_notification', job('hiring_notification').payload)
    expect(text).toContain('Ari Rivera')
    expect(text).toContain('ari@example.com')
    expect(text).toContain('8605550134')
    expect(text).toContain('Hartford, CT')
    expect(text).not.toContain('cleaning_experience')
  })

  it('stops permanent authorization failures and retries temporary failures', async () => {
    const denied = mockResend({ data: null, error: { name: 'invalid_api_key', statusCode: 401, message: 'secret detail' } })
    expect(await sendEmailJob(job('waitlist_confirmation'), config, denied.client)).toEqual({ delivered: false, code: 'invalid_api_key', retryable: false })
    const limited = mockResend({ data: null, error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'retry' } })
    expect(await sendEmailJob(job('waitlist_confirmation'), config, limited.client)).toEqual({ delivered: false, code: 'rate_limit_exceeded', retryable: true })
  })

  it('rejects an altered idempotency key before sending', async () => {
    const altered = { ...job('waitlist_confirmation'), idempotency_key: 'wrong' }
    const { send, client } = mockResend({ data: { id: 'unexpected' }, error: null })
    expect(await sendEmailJob(altered, config, client)).toEqual({ delivered: false, code: 'invalid_job_key', retryable: false })
    expect(send).not.toHaveBeenCalled()
  })
})
