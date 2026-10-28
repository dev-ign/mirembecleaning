import { resolveSiteRoute } from '../../i18n/routes'
import { bookingConfig } from '../../config/booking'

export type CampaignField = 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term'
export type Campaign = Partial<Record<CampaignField, string>>

const fields: readonly CampaignField[] = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
const firstTouchKey = 'mirembe:first-touch:v1'
const lastTouchKey = 'mirembe:last-touch:v1'
const clickIdKey = 'mirembe:fbclid:v1'

// Review new campaign labels here; patterns alone cannot exclude personal data.
const approved: Record<CampaignField, readonly string[]> = {
  utm_source: ['facebook', 'instagram', 'meta', 'google', 'bing', 'newsletter', 'holiday'],
  utm_medium: ['paid_social', 'paid-social', 'social', 'cpc', 'email', 'organic', 'referral'],
  utm_campaign: ['holiday_2026', 'holiday-2026', 'launch_2027', 'autumn'],
  utm_content: ['hero', 'holiday_modal', 'holiday_floating', 'video', 'image', 'carousel'],
  utm_term: ['house_cleaning', 'holiday_cleaning', 'boston', 'newington'],
}

function safeCampaign(value: unknown): Campaign {
  if (!value || typeof value !== 'object') return {}
  const result: Campaign = {}
  for (const field of fields) {
    const candidate = (value as Record<string, unknown>)[field]
    if (typeof candidate === 'string' && approved[field].includes(candidate)) {
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
  // Call only after consent. Never forward click IDs in custom payloads/links.
  const fbclid = new URLSearchParams(search).get('fbclid')
  try { if (fbclid && /^[A-Za-z0-9_-]{10,500}$/.test(fbclid)) sessionStorage.setItem(clickIdKey, fbclid) } catch { /* Optional storage. */ }
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

export function clearAttribution(): void {
  try { for (const key of [firstTouchKey, lastTouchKey, clickIdKey]) sessionStorage.removeItem(key) } catch { /* Optional storage. */ }
}

export function safePagePath(): string {
  const route = resolveSiteRoute(window.location.pathname)
  return route.found ? route.path : '/'
}

export function safePageLocation(search: string): string {
  const url = new URL(safePagePath(), window.location.origin)
  const current = readCurrentCampaign(search)
  for (const field of fields) if (current[field]) url.searchParams.set(field, current[field])
  return url.href
}

// Meta reads the real URL/referrer independently of custom payloads. Fail closed
// on unknown paths, unreviewed parameters and freeform fragments. No temporary
// history changes or unsupported URL override APIs are used.
export function isSafeMetaContext(): boolean {
  const current = new URL(window.location.href)
  const path = current.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/'
  const route = resolveSiteRoute(path)
  if (!route.found) return false
  if (current.hash && !['#top', '#story', '#services', '#how-it-works', '#why-mirembe', '#areas', '#about', '#faq'].includes(current.hash)) return false
  const campaign = readCurrentCampaign(current.search)
  for (const [key, value] of current.searchParams) {
    if (current.searchParams.getAll(key).length !== 1) return false
    if (key === 'embed' && value === 'basic' && route.basePath === bookingConfig.path) continue
    if (key === 'fbclid' && /^[A-Za-z0-9_-]{10,500}$/.test(value)) continue
    if (campaign[key as CampaignField] !== value) return false
  }
  if (document.referrer) {
    try {
      const referrer = new URL(document.referrer)
      if (referrer.username || referrer.password) return false
      if (referrer.search || referrer.hash) return false
      if (referrer.origin !== current.origin && referrer.protocol !== 'https:') return false
      if ((route.basePath === bookingConfig.thankYouPath)
        && referrer.origin === 'https://app.zenmaid.com'
        && bookingConfig.holiday.publicReferrerPaths.some(publicPath => publicPath === referrer.pathname)) return true
      if (referrer.origin !== current.origin && referrer.pathname !== '/') return false
      if (referrer.origin === current.origin && !resolveSiteRoute(referrer.pathname).found) return false
    } catch { return false }
  }
  return true
}
