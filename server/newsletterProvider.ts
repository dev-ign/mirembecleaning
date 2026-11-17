import { z } from 'zod'
import { newsletterConsent, normalizeNewsletterEmail, type NewsletterSubscriptionRequest } from '../src/shared/newsletter.js'

const idSchema = z.string().uuid()
const propertySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('string'), value: z.string() }),
  z.object({ type: z.literal('number'), value: z.number() }),
])
const contactSchema = z.object({
  object: z.literal('contact'), id: idSchema, email: z.string(), unsubscribed: z.boolean(),
  properties: z.record(z.string(), propertySchema),
})
const segmentsSchema = z.object({
  object: z.literal('list'), data: z.array(z.object({ id: idSchema, name: z.string() })), has_more: z.boolean(),
})
const suppressionSchema = z.object({
  object: z.literal('suppression'), id: idSchema, email: z.string(),
  origin: z.string().min(1), source_id: idSchema.nullable(), created_at: z.string().min(1),
})
const missingSchema = z.object({ name: z.literal('not_found'), message: z.string().min(1) })
const importIdentitySchema = z.object({ object: z.literal('contact_import'), id: idSchema })
const importProgressSchema = importIdentitySchema.extend({ status: z.string().min(1) }).passthrough()
const importCountsSchema = z.object({
  total: z.literal(1), created: z.number().int().min(0).max(1),
  updated: z.literal(0), skipped: z.number().int().min(0).max(1), failed: z.literal(0),
}).refine(counts => counts.created + counts.skipped === 1)
type Contact = z.infer<typeof contactSchema>
type ConsentProperties = Record<`newsletter_consent_${'at' | 'source' | 'version' | 'locale'}`, string>

export class NewsletterProviderError extends Error {
  constructor(public readonly kind: 'unavailable' | 'rate_limited' = 'unavailable') {
    super('Newsletter provider unavailable')
  }
}

function consentProperties(locale: NewsletterSubscriptionRequest['locale']): ConsentProperties {
  return {
    newsletter_consent_at: new Date().toISOString(),
    newsletter_consent_source: newsletterConsent.source,
    newsletter_consent_version: newsletterConsent.version,
    newsletter_consent_locale: locale,
  }
}

function evidence(contact: Contact): 'absent' | 'present' {
  const values = Object.entries(contact.properties).filter(([key]) => key.startsWith('newsletter_consent_'))
  if (!values.length) return 'absent'
  const get = (key: string) => {
    const property = contact.properties[`newsletter_consent_${key}`]
    return property?.type === 'string' ? property.value : ''
  }
  if (!z.iso.datetime().safeParse(get('at')).success || get('source') !== newsletterConsent.source
    || !get('version') || !['en', 'es', 'ht', 'pt'].includes(get('locale'))) throw new NewsletterProviderError()
  return 'present'
}

// SDK 6.12.4 lacks imports/suppression helpers and request cancellation. Use
// abortable fetch for the documented global API; never retry a mutation.
export async function subscribeNewsletter(input: NewsletterSubscriptionRequest): Promise<void> {
  const key = process.env.RESEND_NEWSLETTER_API_KEY?.trim()
  const segmentId = process.env.RESEND_NEWSLETTER_SEGMENT_ID?.trim()
  if (!key || !idSchema.safeParse(segmentId).success) throw new NewsletterProviderError()
  const segment = segmentId!
  const deadline = AbortSignal.timeout(20_000)
  let mutation: 'import' | 'segment' | undefined
  let importId: string | undefined

  function requireWritePermission() {
    // Explicit server-only opt-in in every environment; missing/malformed values fail closed.
    if (process.env.RESEND_NEWSLETTER_WRITES_ENABLED !== 'true') throw new NewsletterProviderError()
  }

  async function call(path: string, method = 'GET', body?: FormData, allowMissing = false): Promise<unknown> {
    if (method !== 'GET') requireWritePermission()
    try {
      const response = await fetch(`https://api.resend.com${path}`, {
        method, redirect: 'error', cache: 'no-store',
        // Let fetch supply the multipart boundary. No subscription-status column
        // or Segment/Topic assignment is sent with an import.
        headers: { Authorization: `Bearer ${key}` },
        ...(body === undefined ? {} : { body }),
        signal: AbortSignal.any([deadline, AbortSignal.timeout(5_000)]),
      })
      if (response.status === 429) throw new NewsletterProviderError('rate_limited')
      const data: unknown = await response.json()
      if (allowMissing && response.status === 404 && missingSchema.safeParse(data).success) return null
      if (!response.ok) throw new NewsletterProviderError()
      return data
    } catch (error) {
      throw error instanceof NewsletterProviderError ? error : new NewsletterProviderError()
    }
  }

  function parse<T>(schema: z.ZodType<T>, data: unknown): T {
    const result = schema.safeParse(data)
    if (!result.success) throw new NewsletterProviderError()
    return result.data
  }

  async function getContact(identifier: string): Promise<Contact | null> {
    const data = await call(`/contacts/${encodeURIComponent(identifier)}`, 'GET', undefined, true)
    if (data === null) return null
    const contact = parse(contactSchema, data)
    if (normalizeNewsletterEmail(contact.email) !== input.email) throw new NewsletterProviderError()
    return contact
  }

  async function isSuppressed(): Promise<boolean> {
    const data = await call(`/suppressions/${encodeURIComponent(input.email)}`, 'GET', undefined, true)
    if (data === null) return false
    const suppression = parse(suppressionSchema, data)
    if (normalizeNewsletterEmail(suppression.email) !== input.email) throw new NewsletterProviderError()
    return true
  }

  async function inSegment(id: string): Promise<boolean> {
    const list = parse(segmentsSchema, await call(`/contacts/${id}/segments?limit=100`))
    if (list.data.some(item => item.id === segment)) return true
    // A truncated list is not evidence of absence. No speculative writes.
    if (list.has_more) throw new NewsletterProviderError()
    return false
  }

  async function createWithoutOverwrite(expected: ConsentProperties): Promise<boolean> {
    requireWritePermission()
    const columns = ['email', ...Object.keys(expected)]
    const csvRow = (values: string[]) => values.map(value => `"${value.replaceAll('"', '""')}"`).join(',')
    const form = new FormData()
    form.set('file', new Blob([csvRow(columns) + '\r\n'
      + csvRow([input.email, ...Object.values(expected)]) + '\r\n'], { type: 'text/csv' }), 'newsletter.csv')
    form.set('column_map', JSON.stringify({
      email: 'email',
      properties: Object.fromEntries(Object.keys(expected).map(key => [key, { column: key, type: 'string' }])),
    }))
    // Unlike POST /contacts, the provider's documented conflict policy leaves
    // existing Contacts untouched at processing time, including a racing opt-out.
    form.set('on_conflict', 'skip')
    mutation = 'import'
    const started = parse(importIdentitySchema, await call('/contacts/imports', 'POST', form))
    const jobId = started.id
    importId = jobId
    // Imports are asynchronous. Poll only reads, at most four times, within
    // the existing provider deadline. No worker or background continuation.
    for (const delay of [0, 250, 750, 1_500]) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay))
      deadline.throwIfAborted()
      const progress = parse(importProgressSchema, await call(`/contacts/imports/${jobId}`))
      if (progress.id !== jobId || progress.status === 'failed') throw new NewsletterProviderError()
      if (progress.status !== 'completed') continue
      const counts = parse(importCountsSchema, progress.counts)
      return counts.created === 1
    }
    throw new NewsletterProviderError()
  }

  try {
    let contact = await getContact(input.email)
    if (await isSuppressed() || contact?.unsubscribed) return
    let created = false
    if (!contact) {
      const expected = consentProperties(input.locale)
      created = await createWithoutOverwrite(expected)
      const importedContact = await getContact(input.email)
      if (!importedContact) throw new NewsletterProviderError()
      if (importedContact.unsubscribed || await isSuppressed()) return
      if (created && Object.entries(expected).some(([key, value]) => importedContact.properties[key]?.value !== value)) throw new NewsletterProviderError()
      contact = importedContact
    }
    // No PATCH of consent or subscription status, even for a previously unrelated
    // Contact. Absent/partial evidence cannot be initialized conditionally by API.
    if (evidence(contact) !== 'present') throw new NewsletterProviderError()
    if (!created && await inSegment(contact.id)) return
    const firstEvidence = Object.fromEntries(Object.entries(contact.properties)
      .filter(([key]) => key.startsWith('newsletter_consent_')).map(([key, property]) => [key, property.value]))
    requireWritePermission()
    mutation = 'segment'
    const added = parse(z.object({ id: idSchema, audienceId: idSchema.optional() }), await call(`/contacts/${contact.id}/segments/${segment}`, 'POST'))
    // The global endpoint currently returns { id: contactId, audienceId: segmentId };
    // the reference documents { id: segmentId }. Validate either complete shape,
    // then independently verify persisted membership before acknowledging.
    const validAddition = added.audienceId === undefined ? added.id === segment
      : added.id === contact.id && added.audienceId === segment
    if (!validAddition) throw new NewsletterProviderError()
    const confirmed = await getContact(contact.id)
    if (!confirmed || confirmed.id !== contact.id) throw new NewsletterProviderError()
    // Segment assignment never sets global status; Resend excludes global opt-outs
    // and suppressions even when membership exists. Recheck before acknowledgment.
    if (confirmed.unsubscribed || await isSuppressed()) return
    if (Object.entries(firstEvidence).some(([key, value]) => confirmed.properties[key]?.value !== value)
      || !await inSegment(contact.id)) throw new NewsletterProviderError()
  } catch (error) {
    if (mutation) {
      // Fixed codes and an opaque provider job ID permit diagnosis without PII.
      console.error('Newsletter operation not confirmed', {
        code: 'NEWSLETTER_OPERATION_UNCONFIRMED', mutation, ...(importId ? { importId } : {}),
      })
    }
    throw error
  }
}
