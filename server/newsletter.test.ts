// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import endpoint from '../api/newsletter/subscribe.js'
import { newsletterConsent } from '../src/shared/newsletter.js'

const contactId = '11111111-1111-4111-8111-111111111111'
const segmentId = '22222222-2222-4222-8222-222222222222'
const email = 'Name.Tag+tips@example.test'
const originalEvidence = {
  newsletter_consent_at: '2026-10-28T12:00:00.000Z',
  newsletter_consent_source: newsletterConsent.source,
  newsletter_consent_version: newsletterConsent.version,
  newsletter_consent_locale: 'ht',
}
const body = () => ({ email: `  Name.Tag+tips@EXAMPLE.TEST  `, marketingConsent: true, consentVersion: newsletterConsent.version, locale: 'en', turnstileToken: 'fresh-token' })
const notFound = () => Response.json({ name: 'not_found', message: 'Not found' }, { status: 404 })
const properties = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { type: 'string', value }]))
type Contact = { object: string; id: string; email: string; unsubscribed: boolean; properties: ReturnType<typeof properties> }
let contact: Contact | null
let member: boolean
let suppressed: boolean
let providerOverride: ((path: string, init: RequestInit) => Response | Promise<Response> | undefined) | undefined
let verification: Record<string, unknown>
let calls: { path: string; init: RequestInit }[]
let importSequence: number
let imports: Map<string, { email: string; properties: Record<string, string>; counts?: { total: number; created: number; updated: number; skipped: number; failed: number } }>

async function importPayload(init: RequestInit) {
  const form = init.body as FormData
  expect(form).toBeInstanceOf(FormData)
  expect(form.get('on_conflict')).toBe('skip')
  const fields: string[] = []
  form.forEach((_value, key) => fields.push(key))
  expect(fields.sort()).toEqual(['column_map', 'file', 'on_conflict'])
  expect(init.headers).not.toHaveProperty('Content-Type')
  const file = form.get('file') as File
  expect(file.type).toBe('text/csv')
  const rows = (await file.text()).trimEnd().split('\r\n')
  expect(rows).toHaveLength(2)
  const columns = rows[0].split(',').map(value => JSON.parse(value) as string)
  const values = rows[1].split(',').map(value => JSON.parse(value) as string)
  expect(columns).toEqual(['email', ...Object.keys(originalEvidence)])
  const mapping = JSON.parse(String(form.get('column_map')))
  expect(mapping).toEqual({ email: 'email', properties: Object.fromEntries(Object.keys(originalEvidence).map(key => [key, { column: key, type: 'string' }])) })
  const record = Object.fromEntries(columns.map((key, i) => [key, values[i]]))
  const { email: address, ...consent } = record
  return { email: address, properties: consent }
}

function existing(values: Record<string, string> = originalEvidence): Contact {
  return { object: 'contact', id: contactId, email, unsubscribed: false, properties: properties(values) }
}
function request(value: unknown = body(), headers = { 'Content-Type': 'application/json' }) {
  return new Request('https://local.test/api/newsletter/subscribe', { method: 'POST', headers, body: JSON.stringify(value) })
}
async function result(value: unknown = body()) {
  const response = await endpoint.fetch(request(value))
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  return { response, payload: await response.json() }
}
const writes = () => calls.filter(({ init }) => init.method !== 'GET')

beforeEach(() => {
  vi.stubEnv('RESEND_NEWSLETTER_API_KEY', 'synthetic-newsletter-key')
  vi.stubEnv('RESEND_NEWSLETTER_SEGMENT_ID', segmentId)
  // Only the mocked provider below receives writes. Real configuration defaults off.
  vi.stubEnv('RESEND_NEWSLETTER_WRITES_ENABLED', 'true')
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'synthetic-turnstile-secret')
  vi.stubEnv('VERCEL_ENV', 'preview')
  verification = { success: true, action: 'newsletter', hostname: 'mirembecleaning.com' }
  contact = null; member = false; suppressed = false; providerOverride = undefined; calls = []
  imports = new Map(); importSequence = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      expect(init.body).toEqual(new URLSearchParams({ secret: 'synthetic-turnstile-secret', response: 'fresh-token' }))
      return Response.json(verification)
    }
    expect(url.startsWith('https://api.resend.com/')).toBe(true)
    expect(init.headers).toMatchObject({ Authorization: 'Bearer synthetic-newsletter-key' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.redirect).toBe('error')
    const path = url.slice('https://api.resend.com'.length)
    calls.push({ path, init })
    const overridden = providerOverride?.(path, init)
    if (overridden) return overridden
    if (path.startsWith('/suppressions/') && init.method === 'GET') return suppressed
      ? Response.json({ object: 'suppression', id: contactId, email, origin: 'bounce', source_id: null, created_at: '2026-11-17 12:00:00+00' }) : notFound()
    if (path.endsWith('/segments?limit=100')) return Response.json({ object: 'list', data: member ? [{ id: segmentId, name: 'Mirembe Newsletter' }] : [], has_more: false })
    if (path === `/contacts/${contactId}/segments/${segmentId}` && init.method === 'POST') { member = true; return Response.json({ id: segmentId }) }
    if (path === '/contacts/imports' && init.method === 'POST') {
      const data = await importPayload(init)
      const id = `00000000-0000-4000-8000-${String(++importSequence).padStart(12, '0')}`
      imports.set(id, data)
      return Response.json({ object: 'contact_import', id }, { status: 201 })
    }
    if (path.startsWith('/contacts/imports/') && init.method === 'GET') {
      const id = path.split('/').at(-1)!
      const job = imports.get(id)!
      if (!job.counts) {
        const created = contact === null ? 1 : 0
        if (created) { contact = existing(job.properties); contact.email = job.email }
        job.counts = { total: 1, created, updated: 0, skipped: 1 - created, failed: 0 }
      }
      return Response.json({ object: 'contact_import', id, status: 'completed', counts: job.counts })
    }
    if (init.method !== 'GET') throw new Error('Unsafe or unexpected mocked mutation')
    if (path.startsWith('/contacts/') && init.method === 'GET') return contact ? Response.json(contact) : notFound()
    throw new Error('Unexpected mocked request')
  }))
})
afterEach(() => {
  expect(calls.filter(({ path, init }) => init.method === 'PATCH' || init.method === 'DELETE' || (path === '/contacts' && init.method === 'POST'))).toEqual([])
  vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers()
})

describe('newsletter subscription boundary', () => {
  it('creates with server evidence, verifies it and Segment membership before generic acknowledgment', async () => {
    const { response, payload } = await result()
    expect(response.status).toBe(200)
    expect(payload).toEqual({ ok: true, data: { acknowledged: true } })
    expect(calls[0].path).toBe(`/contacts/${encodeURIComponent(email)}`)
    expect(calls[1].path).toBe(`/suppressions/${encodeURIComponent(email)}`)
    expect(writes().map(call => call.path)).toEqual(['/contacts/imports', `/contacts/${contactId}/segments/${segmentId}`])
    expect(contact!.properties.newsletter_consent_source.value).toBe(newsletterConsent.source)
    expect(contact!.properties.newsletter_consent_version.value).toBe(newsletterConsent.version)
    expect(contact!.properties.newsletter_consent_locale.value).toBe('en')
    expect(Date.parse(String(contact!.properties.newsletter_consent_at.value))).toBeGreaterThan(Date.now() - 10_000)
    expect(member).toBe(true)
  })

  it('encodes reserved local-part characters without changing spelling or aliases', async () => {
    const address = 'Name.Tag+Tips?box#folder/one@example.test'
    const response = await result({ ...body(), email: '  Name.Tag+Tips?box#folder/one@EXAMPLE.TEST  ' })
    expect(response.response.status).toBe(200)
    expect(calls[0].path).toBe(`/contacts/${encodeURIComponent(address)}`)
    expect(calls[1].path).toBe(`/suppressions/${encodeURIComponent(address)}`)
    expect((await importPayload(writes()[0].init)).email).toBe(address)
    expect(member).toBe(true)
  })

  it.each(['es', 'ht', 'pt'])('records the requested %s locale', async locale => {
    expect((await result({ ...body(), locale })).response.status).toBe(200)
    expect(contact!.properties.newsletter_consent_locale.value).toBe(locale)
  })

  it.each([
    { email: undefined }, { email: '' }, { email: 'bad-address' }, { email: 'a'.repeat(255) + '@example.test' },
    { email: 'a..b@example.test' }, { marketingConsent: false }, { marketingConsent: undefined },
    { consentVersion: 'unreviewed' }, { locale: 'fr' }, { turnstileToken: '' }, { turnstileToken: 'x'.repeat(2049) },
    { newsletter_consent_at: '2020-01-01' }, { source: 'other' }, { unsubscribed: false }, { segmentId }, { contactId },
  ])('rejects invalid/privileged request fields %j without upstream calls', async changes => {
    expect((await result({ ...body(), ...changes })).response.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects non-POST, non-JSON, malformed JSON and streamed oversized bodies', async () => {
    expect((await endpoint.fetch(new Request('https://local.test', { method: 'GET' }))).status).toBe(405)
    expect((await endpoint.fetch(request(body(), { 'Content-Type': 'text/plain' }))).status).toBe(400)
    expect((await endpoint.fetch(new Request('https://local.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }))).status).toBe(400)
    expect((await result({ ...body(), extra: 'x'.repeat(4096) })).response.status).toBe(413)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    { success: false, 'error-codes': ['timeout-or-duplicate'] },
    { success: true, action: 'waitlist', hostname: 'mirembecleaning.com' },
    { success: true, action: 'newsletter', hostname: 'untrusted.example' },
  ])('rejects spent, wrong-action or cross-host Turnstile tokens %j', async data => {
    vi.stubEnv('VERCEL_ENV', 'production')
    verification = data
    expect((await result()).response.status).toBe(400)
    expect(calls).toEqual([])
  })

  it('fails closed when Turnstile verification is unavailable', async () => {
    verification = { success: false, 'error-codes': ['internal-error'] }
    expect((await result()).response.status).toBe(503)
    expect(calls).toEqual([])
  })

  it('preserves original evidence for eligible duplicates', async () => {
    contact = existing(); member = true
    const { response, payload } = await result()
    expect(response.status).toBe(200)
    expect(payload).toEqual({ ok: true, data: { acknowledged: true } })
    expect(contact.properties).toEqual(properties(originalEvidence))
    expect(writes()).toEqual([])
  })

  it('fails closed for another source because first consent cannot be written conditionally', async () => {
    contact = existing({})
    expect((await result()).response.status).toBe(503)
    expect(writes()).toEqual([])
    expect(contact.properties).toEqual({})
    expect(contact.unsubscribed).toBe(false)
  })

  it('preserves complete earlier evidence when adding a missing Segment', async () => {
    contact = existing()
    expect((await result()).response.status).toBe(200)
    expect(writes()).toHaveLength(1)
    expect(contact.properties).toEqual(properties(originalEvidence))
  })

  it.each(['unsubscribed', 'suppressed'])('acknowledges %s without writes or status disclosure', async status => {
    contact = existing(); contact.unsubscribed = status === 'unsubscribed'; suppressed = status === 'suppressed'
    expect((await result()).payload).toEqual({ ok: true, data: { acknowledged: true } })
    expect(writes()).toEqual([])
  })

  it('does not create a contact for a suppressed address absent from Contacts', async () => {
    suppressed = true
    expect((await result()).response.status).toBe(200)
    expect(writes()).toEqual([])
  })

  it.each([{}, { newsletter_consent_at: originalEvidence.newsletter_consent_at }] as Record<string, string>[])('fails closed for newsletter membership without complete evidence %j', async values => {
    contact = existing(values); member = true
    expect((await result()).response.status).toBe(503)
    expect(writes()).toEqual([])
  })

  it.each(['RESEND_NEWSLETTER_API_KEY', 'RESEND_NEWSLETTER_SEGMENT_ID'])('does not fall back when %s is missing', async key => {
    vi.stubEnv(key, ''); vi.stubEnv('RESEND_API_KEY', 'must-not-use')
    expect((await result()).response.status).toBe(503)
    expect(calls).toEqual([])
  })

  it.each(['false', ''])('blocks all contact mutations while the safety gate is %s', async enabled => {
    vi.stubEnv('RESEND_NEWSLETTER_WRITES_ENABLED', enabled)
    expect((await result()).response.status).toBe(503)
    expect(writes()).toEqual([])
    contact = existing({})
    expect((await result()).response.status).toBe(503)
    expect(writes()).toEqual([])
  })

  it('allows consent-safe production writes only with the exact opt-in flag', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect((await result()).response.status).toBe(200)
    expect(writes().map(call => call.path)).toEqual(['/contacts/imports', `/contacts/${contactId}/segments/${segmentId}`])
    expect(member).toBe(true)
  })

  it.each([undefined, 'false', 'TRUE', '1', ' true '])('blocks production mutations with write flag %s', async flag => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('RESEND_NEWSLETTER_WRITES_ENABLED', flag)
    expect((await result()).response.status).toBe(503)
    expect(writes()).toEqual([])
  })

  it.each([401, 403, 429, 500])('fails closed on suppression lookup HTTP %s', async status => {
    providerOverride = path => path.startsWith('/suppressions/') ? Response.json({ name: 'provider_error' }, { status }) : undefined
    expect((await result()).response.status).toBe(status === 429 ? 429 : 503)
    expect(writes()).toEqual([])
  })

  it.each([
    () => new Response('not JSON', { status: 404 }),
    () => Response.json({ message: 'not found' }, { status: 404 }),
    () => Response.json({ object: 'suppression' }),
    () => Promise.reject(new DOMException('Timed out', 'TimeoutError')),
  ])('requires a confirmed, trustworthy suppression absence', async response => {
    providerOverride = path => path.startsWith('/suppressions/') ? response() : undefined
    expect((await result()).response.status).toBe(503)
    expect(writes()).toEqual([])
  })

  it('aborts a stalled provider lookup without retries', async () => {
    vi.useFakeTimers()
    providerOverride = (_path, init) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(init.signal!.reason))
    })
    // Mock timeout using the same signal contract; Node native timeout is real-time.
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms)
      return controller.signal
    })
    const pending = result()
    await vi.advanceTimersByTimeAsync(5_001)
    expect((await pending).response.status).toBe(503)
    expect(calls).toHaveLength(1)
    expect(writes()).toEqual([])
  })

  it('does not retry a rejected import or turn it into an upsert', async () => {
    providerOverride = (path, init) => path === '/contacts/imports' && init.method === 'POST'
      ? Response.json({ name: 'validation_error', message: 'Already exists' }, { status: 409 }) : undefined
    expect((await result()).response.status).toBe(503)
    expect(writes()).toHaveLength(1)
    expect(member).toBe(false)
  })

  it('validates the observed global Segment-add response and confirms persisted membership', async () => {
    providerOverride = (path, init) => {
      if (path === `/contacts/${contactId}/segments/${segmentId}` && init.method === 'POST') {
        member = true
        return Response.json({ id: contactId, audienceId: segmentId }, { status: 201 })
      }
    }
    expect((await result()).response.status).toBe(200)
    expect(calls.at(-1)?.path).toBe(`/contacts/${contactId}/segments?limit=100`)
  })

  it('rejects a mismatched Segment in the observed provider response', async () => {
    providerOverride = path => path.endsWith(`/segments/${segmentId}`)
      ? Response.json({ id: contactId, audienceId: contactId }, { status: 201 }) : undefined
    expect((await result()).response.status).toBe(503)
  })

  it.each(['contact', 'evidence', 'segment', 'membership'])('does not acknowledge an unconfirmed %s write', async failure => {
    providerOverride = (path, init) => {
      if (path === '/contacts/imports' && init.method === 'POST' && failure === 'contact') return Response.json({ id: contactId })
      if (path === `/contacts/${encodeURIComponent(email)}` && contact && init.method === 'GET' && failure === 'evidence') return Response.json(existing({}))
      if (path.endsWith(`/segments/${segmentId}`) && failure === 'segment') return Response.json({ id: contactId })
      if (path.endsWith(`/segments/${segmentId}`) && failure === 'membership') return Response.json({ id: segmentId })
    }
    expect((await result()).response.status).toBe(503)
  })

  it('does not guess Contact absence or truncated Segment absence', async () => {
    providerOverride = path => path.startsWith('/contacts/') ? Response.json({ message: 'missing' }, { status: 404 }) : undefined
    expect((await result()).response.status).toBe(503)
    expect(writes()).toEqual([])
    contact = existing()
    providerOverride = path => path.endsWith('/segments?limit=100') ? Response.json({ object: 'list', data: [], has_more: true }) : undefined
    expect((await result()).response.status).toBe(503)
    expect(writes()).toEqual([])
  })
  it('skips a newsletter contact created between lookup and import without replacing first evidence', async () => {
    providerOverride = (path, init) => {
      if (path === '/contacts/imports' && init.method === 'POST') { contact = existing(); member = true }
      return undefined
    }
    expect((await result()).response.status).toBe(200)
    expect(contact!.properties).toEqual(properties(originalEvidence))
    expect(writes().map(call => call.path)).toEqual(['/contacts/imports'])
    expect([...imports.values()][0].counts).toMatchObject({ created: 0, skipped: 1, updated: 0 })
  })

  it('does not grant membership to a racing Contact from another source without consent', async () => {
    providerOverride = (path, init) => {
      if (path === '/contacts/imports' && init.method === 'POST') contact = existing({})
      return undefined
    }
    expect((await result()).response.status).toBe(503)
    expect(contact!.properties).toEqual({})
    expect(member).toBe(false)
    expect(writes()).toHaveLength(1)
  })

  it('preserves an opt-out created between lookup and import', async () => {
    providerOverride = (path, init) => {
      if (path === '/contacts/imports' && init.method === 'POST') {
        contact = existing(); contact.unsubscribed = true
      }
      return undefined
    }
    expect((await result()).payload).toEqual({ ok: true, data: { acknowledged: true } })
    expect(contact!.unsubscribed).toBe(true)
    expect(contact!.properties).toEqual(properties(originalEvidence))
    expect(member).toBe(false)
    expect(writes().map(call => call.path)).toEqual(['/contacts/imports'])
  })

  it('preserves a concurrent unsubscribe even when Segment assignment follows a stale eligible read', async () => {
    contact = existing()
    let read = false
    providerOverride = (path, init) => {
      if (!read && path === `/contacts/${encodeURIComponent(email)}` && init.method === 'GET') {
        read = true
        const snapshot = Response.json(contact)
        contact!.unsubscribed = true
        return snapshot
      }
    }
    expect((await result()).response.status).toBe(200)
    // Membership is only a relation: Resend excludes the global opt-out from
    // Broadcasts, and this request never changes status or consent properties.
    expect(contact.unsubscribed).toBe(true)
    expect(contact.properties).toEqual(properties(originalEvidence))
    expect(writes()).toHaveLength(1)
    expect(writes()[0].init.body).toBeUndefined()
  })

  it('does not clear suppression that appears during Segment assignment', async () => {
    contact = existing()
    providerOverride = (path, init) => {
      if (path.endsWith(`/segments/${segmentId}`) && init.method === 'POST') suppressed = true
      return undefined
    }
    expect((await result()).response.status).toBe(200)
    expect(suppressed).toBe(true)
    expect(contact.properties).toEqual(properties(originalEvidence))
    expect(writes()).toHaveLength(1)
  })

  it('processes two missing-contact signup attempts with one preserved first-consent record', async () => {
    let lookups = 0
    providerOverride = (path, init) => {
      if (path === `/contacts/${encodeURIComponent(email)}` && init.method === 'GET' && ++lookups <= 2) return notFound()
    }
    const responses = await Promise.all([result(), result({ ...body(), locale: 'es' })])
    expect(responses.map(item => item.response.status)).toEqual([200, 200])
    expect(imports.size).toBe(2)
    const jobs = [...imports.values()]
    expect(jobs.map(job => job.counts!.created).sort()).toEqual([0, 1])
    const winner = jobs.find(job => job.counts!.created === 1)!
    expect(contact!.properties).toEqual(properties(winner.properties))
    expect(contact!.unsubscribed).toBe(false)
    expect(member).toBe(true)
  })

  it('never replaces partial earlier evidence for an existing non-member', async () => {
    contact = existing({ newsletter_consent_at: originalEvidence.newsletter_consent_at })
    expect((await result()).response.status).toBe(503)
    expect(contact.properties).toEqual(properties({ newsletter_consent_at: originalEvidence.newsletter_consent_at }))
    expect(writes()).toEqual([])
  })

  it('waits for import completion using reads without retrying its mutation', async () => {
    vi.useFakeTimers()
    let polls = 0
    providerOverride = path => {
      if (path.startsWith('/contacts/imports/') && ++polls === 1) return Response.json({ object: 'contact_import', id: path.split('/').at(-1), status: 'pending' })
    }
    const pending = result()
    await vi.waitFor(() => expect(polls).toBe(1))
    await vi.advanceTimersByTimeAsync(250)
    expect((await pending).response.status).toBe(200)
    expect(polls).toBe(2)
    expect(writes().filter(call => call.path === '/contacts/imports')).toHaveLength(1)
  })

  it('bounds pending imports and logs only the opaque job ID and a fixed diagnostic', async () => {
    vi.useFakeTimers()
    let polls = 0
    providerOverride = path => {
      if (path.startsWith('/contacts/imports/')) {
        polls++
        return Response.json({ object: 'contact_import', id: path.split('/').at(-1), status: 'pending' })
      }
    }
    const pending = result()
    await vi.waitFor(() => expect(polls).toBe(1))
    await vi.advanceTimersByTimeAsync(2_500)
    expect((await pending).response.status).toBe(503)
    expect(polls).toBe(4)
    expect(writes()).toHaveLength(1)
    expect(member).toBe(false)
    expect(console.error).toHaveBeenCalledWith('Newsletter operation not confirmed', { code: 'NEWSLETTER_OPERATION_UNCONFIRMED', mutation: 'import', importId: [...imports.keys()][0] })
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(email)
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('synthetic-newsletter-key')
  })

  it.each([
    { status: 'failed' },
    { status: 'completed' },
    { status: 'completed', counts: { total: 1, created: 0, updated: 1, skipped: 0, failed: 0 } },
    { status: 'completed', counts: { total: 1, created: 0, updated: 0, skipped: 0, failed: 1 } },
  ])('does not acknowledge an unverified import outcome %j', async outcome => {
    providerOverride = path => path.startsWith('/contacts/imports/')
      ? Response.json({ object: 'contact_import', id: path.split('/').at(-1), ...outcome }) : undefined
    expect((await result()).response.status).toBe(503)
    expect(member).toBe(false)
    expect(writes()).toHaveLength(1)
  })

  it('requires a persisted Contact after an import reports completion', async () => {
    providerOverride = (path, init) => path === `/contacts/${encodeURIComponent(email)}` && init.method === 'GET' && imports.size > 0 ? notFound() : undefined
    expect((await result()).response.status).toBe(503)
    expect(member).toBe(false)
  })

  it('repairs membership after an ambiguous import without another creation or evidence overwrite', async () => {
    providerOverride = (path, init) => {
      if (path === '/contacts/imports' && init.method === 'POST') {
        contact = existing()
        return Promise.reject(new DOMException('Response lost after processing', 'TimeoutError'))
      }
    }
    expect((await result()).response.status).toBe(503)
    expect(member).toBe(false)
    providerOverride = undefined
    expect((await result()).response.status).toBe(200)
    expect(writes().filter(call => call.path === '/contacts/imports')).toHaveLength(1)
    expect(contact!.properties).toEqual(properties(originalEvidence))
    expect(member).toBe(true)
  })

})
