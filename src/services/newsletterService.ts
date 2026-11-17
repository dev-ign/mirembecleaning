import type { SupportedLocale } from '../i18n/config'
import { newsletterConsent, normalizeNewsletterEmail, type NewsletterSubscriptionRequest } from '../shared/newsletter'

export class NewsletterRequestError extends Error {
  constructor(public readonly kind: 'invalid' | 'verification' | 'rate_limited' | 'unavailable') {
    super('Newsletter request failed')
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function subscribeToNewsletter(email: string, locale: SupportedLocale, turnstileToken: string): Promise<void> {
  const body: NewsletterSubscriptionRequest = {
    email: normalizeNewsletterEmail(email), locale, turnstileToken,
    marketingConsent: true, consentVersion: newsletterConsent.version,
  }
  try {
    const response = await fetch('/api/newsletter/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(35_000),
    })
    const payload: unknown = await response.json()
    if (response.status === 429) throw new NewsletterRequestError('rate_limited')
    if (response.status === 400) {
      throw new NewsletterRequestError(isObject(payload) && isObject(payload.error)
        && payload.error.code === 'VERIFICATION_FAILED' ? 'verification' : 'invalid')
    }
    if (response.status !== 200 || !isObject(payload) || payload.ok !== true
      || !isObject(payload.data) || payload.data.acknowledged !== true) throw new NewsletterRequestError('unavailable')
  } catch (error) {
    throw error instanceof NewsletterRequestError ? error : new NewsletterRequestError('unavailable')
  }
}
