import { privacyConfig } from '../config/legal'
import { waitlistAttributionPreviewEnabled } from '../config/waitlistAttribution'
import { parseWaitlistAttribution, type WaitlistAttributionInput } from '../shared/campaignAttribution.js'
import { getAttribution } from './campaignAttribution'
import { getConsent, getConsentRevision } from './consent'

export function getWaitlistAttributionPreview(): WaitlistAttributionInput | undefined {
  if (!waitlistAttributionPreviewEnabled || getConsent() !== 'accepted') return
  const revision = getConsentRevision()
  try {
    const snapshot = parseWaitlistAttribution({ version: 1,
      consent: { analytics: true, globalPrivacyControl: false, policyVersion: privacyConfig.effectiveAt },
      ...getAttribution() }, privacyConfig.effectiveAt)
    // A synchronous storage shim may change consent while reading the snapshot.
    return revision === getConsentRevision() && getConsent() === 'accepted' ? snapshot : undefined
  } catch { return undefined /* Optional measurement never blocks signup. */ }
}
