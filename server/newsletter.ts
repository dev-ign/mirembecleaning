import { z } from 'zod'
import { isValidEmail } from '../src/shared/email.js'
import { newsletterConsent, normalizeNewsletterEmail } from '../src/shared/newsletter.js'
import { acknowledgedResponse, errorResponse, readLimitedJson, validationFields } from './http.js'
import { NewsletterProviderError, subscribeNewsletter } from './newsletterProvider.js'
import { verifyTurnstileToken } from './turnstile.js'

const requestSchema = z.strictObject({
  email: z.string().trim().max(254).refine(isValidEmail).transform(normalizeNewsletterEmail),
  marketingConsent: z.literal(true),
  consentVersion: z.literal(newsletterConsent.version),
  locale: z.enum(['en', 'es', 'ht', 'pt']),
  turnstileToken: z.string().trim().min(1).max(2_048),
})

export async function handleNewsletterSubscription(request: Request): Promise<Response> {
  if (request.method !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST for this endpoint.')
  try {
    const body = await readLimitedJson(request, 4_096)
    if (!body.ok) return body.response
    const parsed = requestSchema.safeParse(body.value)
    if (!parsed.success) return errorResponse(400, 'INVALID_REQUEST', 'Invalid submission.', validationFields(parsed.error.issues))
    const verification = await verifyTurnstileToken(parsed.data.turnstileToken, 'newsletter')
    if (verification === 'invalid') return errorResponse(400, 'VERIFICATION_FAILED', 'Verification failed. Please try again.')
    if (verification === 'unavailable') return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Verification is temporarily unavailable. Please try again.')
    await subscribeNewsletter(parsed.data)
    return acknowledgedResponse()
  } catch (error) {
    if (error instanceof NewsletterProviderError && error.kind === 'rate_limited') {
      return errorResponse(429, 'RATE_LIMITED', 'Please wait before trying again.')
    }
    return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Submission service is temporarily unavailable. Please try again.')
  }
}
