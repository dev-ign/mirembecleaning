export type TurnstileResult = 'valid' | 'invalid' | 'unavailable'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const LOCAL_TEST_SECRET = '1x0000000000000000000000000000000AA'

export async function verifyTurnstileToken(token: string, action: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) return 'unavailable'

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return 'unavailable'
    const result: unknown = await response.json()
    if (!result || typeof result !== 'object' || !('success' in result)) return 'unavailable'
    if (result.success !== true) {
      const codes = 'error-codes' in result && Array.isArray(result['error-codes']) ? result['error-codes'] : []
      if (codes.some((code) => ['internal-error', 'missing-input-secret', 'invalid-input-secret'].includes(String(code)))) return 'unavailable'
      return 'invalid'
    }
    // Cloudflare's dummy Siteverify response can omit the action (or return
    // "test") even when the widget was rendered with a specific action.
    // Limit this exception to the official test secret outside production.
    const localTestResponse = process.env.VERCEL_ENV !== 'production' && secret === LOCAL_TEST_SECRET
      && (!('action' in result) || result.action === 'test')
    if (!localTestResponse && (!('action' in result) || result.action !== action)) return 'invalid'
    if (process.env.VERCEL_ENV === 'production') {
      if (!('hostname' in result) || !['mirembecleaning.com', 'www.mirembecleaning.com'].includes(String(result.hostname))) return 'invalid'
    }
    return 'valid'
  } catch {
    return 'unavailable'
  }
}
