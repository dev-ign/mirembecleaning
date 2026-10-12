import { handleSubmission } from '../server/handler'
import { MAX_APPLICANT_BYTES } from '../server/http'
import { applicantSchema } from '../server/validation'

export default {
  fetch(request: Request): Promise<Response> {
    return handleSubmission(request, applicantSchema, MAX_APPLICANT_BYTES, (store, input) => store.createApplicant(input))
  },
}
