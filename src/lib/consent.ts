import { marketing } from '../config/marketing'
import type { Consent } from './analytics/types'

export const consentChanged = 'mirembe:consent-changed'
export const consentKey = `mirembe:marketing-consent:v2:${marketing.ga4Id}:${marketing.metaPixelId}`
let memoryChoice: Consent = null
let volatileChoice = false

export function browserOptedOut(): boolean {
  return typeof navigator !== 'undefined'
    && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
}

export function hasConfiguredProvider(): boolean {
  return Boolean(marketing.ga4Id || marketing.metaPixelId)
}

export function getConsent(): Consent {
  if (browserOptedOut()) return 'declined'
  if (volatileChoice) return memoryChoice
  try {
    const value = localStorage.getItem(consentKey)
    return value === 'accepted' || value === 'declined' ? value : null
  } catch { return memoryChoice }
}

export function consentPersistenceFailed(): boolean { return volatileChoice }

export function saveConsent(value: Exclude<Consent, null>): void {
  memoryChoice = browserOptedOut() ? 'declined' : value
  try { localStorage.setItem(consentKey, memoryChoice); volatileChoice = false } catch { volatileChoice = true }
  window.dispatchEvent(new Event(consentChanged))
}
