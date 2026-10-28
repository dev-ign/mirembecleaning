import { privacyConfig } from './legal'

const ga4Id = import.meta.env.VITE_GA4_MEASUREMENT_ID?.trim() ?? ''
const metaPixelId = import.meta.env.VITE_META_PIXEL_ID?.trim() ?? ''
const policyCandidate = import.meta.env.VITE_PRIVACY_POLICY_URL?.trim() ?? ''

function validPolicyUrl(value: string): string {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !['example.com', 'www.example.com'].includes(url.hostname) ? url.href : ''
  } catch { return '' }
}

const privacyPolicyUrl = validPolicyUrl(policyCandidate)
const enabled = privacyConfig.approved && (import.meta.env.PROD || import.meta.env.VITE_ENABLE_MARKETING_IN_DEVELOPMENT === 'true')

export const marketing = {
  debug: import.meta.env.DEV && import.meta.env.VITE_ANALYTICS_DEBUG === 'true',
  privacyPolicyUrl,
  ga4Id: enabled && privacyPolicyUrl && /^G-[A-Z0-9]+$/.test(ga4Id) ? ga4Id : '',
  metaPixelId: enabled && privacyPolicyUrl && /^\d{5,20}$/.test(metaPixelId) ? metaPixelId : '',
} as const
