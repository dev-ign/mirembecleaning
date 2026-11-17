import { handleNewsletterSubscription } from '../../server/newsletter.js'

export default {
  fetch(request: Request): Promise<Response> {
    return handleNewsletterSubscription(request)
  },
}
