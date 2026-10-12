import type { ZodType } from 'zod'
import { createSubmissionStore, getSupabaseConfig, type CreateResult, type SubmissionStore } from './database'
import { acknowledgedResponse, createdResponse, errorResponse, readLimitedJson, validationFields } from './http'

export async function handleSubmission<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes: number,
  save: (store: SubmissionStore, input: T) => Promise<CreateResult>,
): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST for this endpoint.')
  }

  try {
    const body = await readLimitedJson(request, maxBytes)
    if (!body.ok) return body.response

    const parsed = schema.safeParse(body.value)
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
