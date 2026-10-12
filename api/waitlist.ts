import { handleSubmission } from '../server/handler'
import { MAX_WAITLIST_BYTES } from '../server/http'
import { waitlistSchema } from '../server/validation'

export default {
  fetch(request: Request): Promise<Response> {
    return handleSubmission(request, waitlistSchema, MAX_WAITLIST_BYTES, (store, input) => store.createWaitlist(input))
  },
}
