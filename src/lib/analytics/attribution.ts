import { bookingConfig } from '../../config/booking'

export type CampaignField = 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term'
export type Campaign = Partial<Record<CampaignField, string>>

const fields: readonly CampaignField[] = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
const firstTouchKey = 'mirembe:first-touch:v1'
const lastTouchKey = 'mirembe:last-touch:v1'

function safeCampaign(value: unknown): Campaign {
  if (!value || typeof value !== 'object') return {}
  const result: Campaign = {}
  for (const field of fields) {
    const candidate = (value as Record<string, unknown>)[field]
    // Reject values that could be email addresses, URLs, or arbitrary visitor data.
    if (typeof candidate === 'string' && candidate.length <= 80
      && /^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(candidate) && !/\d{7,}/.test(candidate)) {
      result[field] = candidate
    }
  }
  return result
}

export function readCurrentCampaign(search: string): Campaign {
  const params = new URLSearchParams(search)
  return safeCampaign(Object.fromEntries(fields.map((field) => [field, params.get(field)])))
}

function readStored(key: string): Campaign {
  try { return safeCampaign(JSON.parse(sessionStorage.getItem(key) ?? '{}') as unknown) } catch { return {} }
}

export function captureCampaign(search: string): void {
  const current = readCurrentCampaign(search)
  if (!Object.keys(current).length) return
  try {
    if (!sessionStorage.getItem(firstTouchKey)) sessionStorage.setItem(firstTouchKey, JSON.stringify(current))
    sessionStorage.setItem(lastTouchKey, JSON.stringify(current))
  } catch { /* Private browsing can disallow storage. */ }
}

export function getAttribution() {
  return { firstTouch: readStored(firstTouchKey), lastTouch: readStored(lastTouchKey) }
}

export function safePagePath(): string {
  const path = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '')
  return path === bookingConfig.path || path === bookingConfig.thankYouPath ? path : '/'
}

export function safePageLocation(search: string): string {
  const url = new URL(safePagePath(), window.location.origin)
  const current = readCurrentCampaign(search)
  for (const field of fields) if (current[field]) url.searchParams.set(field, current[field])
  return url.href
}
