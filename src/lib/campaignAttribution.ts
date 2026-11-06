import { readCurrentCampaign, sanitizeCampaign, type Campaign } from '../shared/campaignAttribution.js'

const firstTouchKey = 'mirembe:first-touch:v1'
const lastTouchKey = 'mirembe:last-touch:v1'
const clickIdKey = 'mirembe:fbclid:v1'

function readStored(key: string): Campaign {
  try { return sanitizeCampaign(JSON.parse(sessionStorage.getItem(key) ?? '{}') as unknown) } catch { return {} }
}

export function captureCampaign(search: string): void {
  // Existing Meta behavior only; no Google click-ID capture or forwarding.
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
