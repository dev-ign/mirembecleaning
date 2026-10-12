import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_LIFETIME_SECONDS = 24 * 60 * 60
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function signature(id: string, expiresAt: number, secretKey: string): Buffer {
  return createHmac('sha256', secretKey)
    .update(`mirembe-waitlist-zip-v1:${id}:${expiresAt}`)
    .digest()
}

export function createZipToken(id: string, secretKey: string, now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + TOKEN_LIFETIME_SECONDS
  return `${id}.${expiresAt}.${signature(id, expiresAt, secretKey).toString('base64url')}`
}

export function verifyZipToken(token: string, secretKey: string, now = Date.now()): string | null {
  const [id, expiry, encodedSignature, extra] = token.split('.')
  if (extra !== undefined || !id || !UUID_PATTERN.test(id) || !expiry || !/^\d{10}$/.test(expiry) || !encodedSignature || !/^[A-Za-z0-9_-]{43}$/.test(encodedSignature)) {
    return null
  }

  const expiresAt = Number(expiry)
  const currentTime = Math.floor(now / 1000)
  if (expiresAt <= currentTime || expiresAt > currentTime + TOKEN_LIFETIME_SECONDS) return null

  const actual = Buffer.from(encodedSignature, 'base64url')
  const expected = signature(id, expiresAt, secretKey)
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? id : null
}
