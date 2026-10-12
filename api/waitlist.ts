import { handleSubmission } from '../server/handler.js'
import { MAX_WAITLIST_BYTES } from '../server/http.js'
import { waitlistSchema } from '../server/validation.js'

export default {
  fetch(request: Request): Promise<Response> {
    return handleSubmission(request, waitlistSchema, MAX_WAITLIST_BYTES, 'waitlist', (store, input) => store.createWaitlist(input))
  },
}
