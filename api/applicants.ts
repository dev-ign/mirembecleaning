import { handleSubmission } from '../server/handler.js'
import { MAX_APPLICANT_BYTES } from '../server/http.js'
import { applicantSchema } from '../server/validation.js'

export default {
  fetch(request: Request): Promise<Response> {
    return handleSubmission(request, applicantSchema, MAX_APPLICANT_BYTES, (store, input) => store.createApplicant(input))
  },
}
