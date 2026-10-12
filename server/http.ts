import type { ZodIssue } from 'zod'

export const MAX_WAITLIST_BYTES = 2_048
export const MAX_APPLICANT_BYTES = 8_192

type ErrorCode = 'INVALID_REQUEST' | 'METHOD_NOT_ALLOWED' | 'DUPLICATE' | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED' | 'INTERNAL_ERROR' | 'SERVICE_UNAVAILABLE'

export function errorResponse(status: 400 | 405 | 409 | 413 | 429 | 500 | 503, code: ErrorCode, message: string, fields?: string[]): Response {
  return Response.json({ ok: false, error: { code, message, ...(fields ? { fields } : {}) } }, {
    status,
    headers: { 'Cache-Control': 'no-store', ...(status === 405 ? { Allow: 'POST' } : {}) },
  })
}

export function createdResponse(id: string, createdAt: string, zipToken?: string): Response {
  return Response.json({ ok: true, data: { id, created_at: createdAt, ...(zipToken ? { zip_token: zipToken } : {}) } }, {
    status: 201,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export function zipUpdatedResponse(zipCode: string): Response {
  return Response.json({ ok: true, data: { zip_code: zipCode } }, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export function acknowledgedResponse(): Response {
  return Response.json({ ok: true, data: { acknowledged: true } }, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export function validationFields(issues: ZodIssue[]): string[] {
  return [...new Set(issues.map((issue) => String(issue.path[0] ?? 'body')))]
}

type BodyResult = { ok: true; value: unknown } | { ok: false; response: Response }

export async function readLimitedJson(request: Request, maxBytes: number): Promise<BodyResult> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') {
    return { ok: false, response: errorResponse(400, 'INVALID_REQUEST', 'Expected a JSON request body.') }
  }

  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, response: errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.') }
  }
  if (!request.body) {
    return { ok: false, response: errorResponse(400, 'INVALID_REQUEST', 'Expected a JSON request body.') }
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let byteCount = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteCount += value.byteLength
      if (byteCount > maxBytes) {
        void reader.cancel()
        return { ok: false, response: errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.') }
      }
      chunks.push(value)
    }

    const bytes = new Uint8Array(byteCount)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { ok: true, value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown }
  } catch {
    return { ok: false, response: errorResponse(400, 'INVALID_REQUEST', 'Malformed JSON request body.') }
  }
}
