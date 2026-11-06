import { resolveSiteRoute } from '../../i18n/routes'
import { bookingConfig } from '../../config/booking'
import { campaignFields, readCurrentCampaign, type CampaignField } from '../../shared/campaignAttribution.js'

export type { Campaign, CampaignField } from '../../shared/campaignAttribution.js'
export { readCurrentCampaign } from '../../shared/campaignAttribution.js'
export { captureCampaign, clearAttribution, getAttribution } from '../campaignAttribution'

export function safePagePath(): string {
  const route = resolveSiteRoute(window.location.pathname)
  return route.found ? route.path : '/'
}

export function safePageLocation(search: string): string {
  const url = new URL(safePagePath(), window.location.origin)
  const current = readCurrentCampaign(search)
  for (const field of campaignFields) if (current[field]) url.searchParams.set(field, current[field])
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
