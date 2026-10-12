import type { ZodType } from 'zod'
import { createSubmissionStore, getSupabaseConfig, type CreateResult, type SubmissionStore } from './database.js'
import { acknowledgedResponse, createdResponse, errorResponse, readLimitedJson, validationFields } from './http.js'
import { verifyTurnstileToken } from './turnstile.js'

export async function handleSubmission<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes: number,
  action: string,
  save: (store: SubmissionStore, input: T) => Promise<CreateResult>,
): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST for this endpoint.')
  }

  try {
    const body = await readLimitedJson(request, maxBytes)
    if (body.ok === false) return body.response

    if (typeof body.value !== 'object' || body.value === null || Array.isArray(body.value)) {
      return errorResponse(400, 'INVALID_REQUEST', 'Invalid submission.')
    }
    const { turnstileToken, ...input } = body.value as Record<string, unknown>
    if (typeof turnstileToken !== 'string' || turnstileToken.length === 0 || turnstileToken.length > 2_048) {
      return errorResponse(400, 'VERIFICATION_FAILED', 'Verification failed. Please try again.')
    }
    const verification = await verifyTurnstileToken(turnstileToken, action)
    if (verification === 'invalid') {
      return errorResponse(400, 'VERIFICATION_FAILED', 'Verification failed. Please try again.')
    }
    if (verification === 'unavailable') {
      return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Verification is temporarily unavailable. Please try again.')
    }

    const parsed = schema.safeParse(input)
    if (!parsed.success) {
      return errorResponse(400, 'INVALID_REQUEST', 'Invalid submission.', validationFields(parsed.error.issues))
    }

    const config = getSupabaseConfig()
    const store = config ? createSubmissionStore(config) : null
    if (!store) {
      return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Submission service is not configured.')
    }

    const result = await save(store, parsed.data)
    if (result.kind === 'duplicate') {
      return acknowledgedResponse()
    }
    if (result.kind === 'unavailable') {
      return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Submission service is temporarily unavailable.')
    }
    return createdResponse(result.id, result.createdAt, result.zipToken)
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', 'Unable to process the submission.')
  }
}
