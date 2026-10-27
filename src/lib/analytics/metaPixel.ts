import { marketing } from '../../config/marketing'
import { getConsent } from './consent'
import { isSafeMetaContext } from './attribution'
import type { Fbq, MetaEvent } from './types'

let initialized = false
let failed = false
const scriptId = 'mirembe-meta-pixel'

export function revokeMetaConsent(): void {
  try {
    const queue = window.fbq?.queue
    // Drop unsent events without discarding initialization if the script has
    // not loaded yet. Reacceptance can then work with the same single loader.
    const setup = queue?.filter(entry => entry[0] === 'init' || entry[0] === 'set') ?? []
    if (queue) queue.length = 0
    window.fbq?.('consent', 'revoke')
    queue?.push(...setup)
  } catch { /* A blocked provider must never affect booking. */ }
}

function initialize(): boolean {
  if (!marketing.metaPixelId || failed || getConsent() !== 'accepted' || !isSafeMetaContext()) return false
  if (initialized) return true
  // Use the official queue contract; do not install a second copy via HTML/GTM.
  if (!window.fbq) {
    const fbq: Fbq = (...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args)
      else fbq.queue!.push(args)
    }
    fbq.push = fbq
    fbq.queue = []
    fbq.loaded = true
    fbq.version = '2.0'
    window.fbq = fbq
    window._fbq = fbq
  }
  window.fbq('consent', 'grant')
  window.fbq('set', 'autoConfig', false, marketing.metaPixelId)
  // No advanced matching data. Automatic events must also be disabled in Meta.
  window.fbq('init', marketing.metaPixelId)
  initialized = true
  if (!document.getElementById(scriptId)) {
    const script = document.createElement('script')
    script.id = scriptId
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    script.referrerPolicy = 'origin'
    script.onerror = () => { failed = true; if (window.fbq?.queue) window.fbq.queue.length = 0 }
    document.head.appendChild(script)
  }
  return true
}

export function sendMetaEvent(event: MetaEvent): boolean {
  try {
    if (getConsent() !== 'accepted' || !isSafeMetaContext()) { if (initialized) revokeMetaConsent(); return false }
    if (!initialize()) return false
    window.fbq?.('consent', 'grant')
    const method = event.name === 'BookingCTA_Click' || event.name === 'BookingFormView' ? 'trackSingleCustom' : 'trackSingle'
    if ('eventId' in event) window.fbq?.(method, marketing.metaPixelId, event.name, event.data, { eventID: event.eventId })
    else window.fbq?.(method, marketing.metaPixelId, event.name, event.data)
    return true
  } catch { return false }
}
