import { createSubmissionStore, getSupabaseConfig } from '../../server/database.js'
import { errorResponse, MAX_WAITLIST_BYTES, readLimitedJson, validationFields, zipUpdatedResponse } from '../../server/http.js'
import { zipUpdateSchema } from '../../server/validation.js'
import { verifyZipToken } from '../../server/zipToken.js'

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST for this endpoint.')
    }

    try {
      const body = await readLimitedJson(request, MAX_WAITLIST_BYTES)
      if (body.ok === false) return body.response

      const parsed = zipUpdateSchema.safeParse(body.value)
      if (!parsed.success) {
        return errorResponse(400, 'INVALID_REQUEST', 'Invalid ZIP update.', validationFields(parsed.error.issues))
      }

      const config = getSupabaseConfig()
      if (!config) return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Submission service is not configured.')

      const id = verifyZipToken(parsed.data.registration_token, config.secretKey)
      if (!id) return errorResponse(400, 'INVALID_REQUEST', 'Invalid or expired ZIP update request.')

      const store = createSubmissionStore(config)
      if (!store) return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Submission service is not configured.')

      const result = await store.updateWaitlistZip(id, parsed.data.zip_code)
      if (result.kind === 'not_found') return errorResponse(400, 'INVALID_REQUEST', 'Invalid or expired ZIP update request.')
      if (result.kind === 'unavailable') return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Submission service is temporarily unavailable.')
      return zipUpdatedResponse(result.zipCode)
    } catch {
      return errorResponse(500, 'INTERNAL_ERROR', 'Unable to process the ZIP update.')
    }
  },
}
