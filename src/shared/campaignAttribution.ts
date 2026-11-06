// Keep this module pure: browser and Node consumers share the reviewed labels,
// without importing storage, provider initialization, or application UI.
export const campaignAllowlist = {
  utm_source: ['facebook', 'instagram', 'meta', 'google', 'bing', 'newsletter', 'holiday'],
  utm_medium: ['paid_social', 'paid-social', 'social', 'cpc', 'email', 'organic', 'referral'],
  utm_campaign: ['holiday_2026', 'holiday-2026', 'launch_2027', 'autumn'],
  utm_content: ['hero', 'holiday_modal', 'holiday_floating', 'video', 'image', 'carousel'],
  utm_term: ['house_cleaning', 'holiday_cleaning', 'boston', 'newington'],
} as const

export type CampaignField = keyof typeof campaignAllowlist
export type Campaign = { [Field in CampaignField]?: (typeof campaignAllowlist)[Field][number] }
export const campaignFields: readonly CampaignField[] = Object.keys(campaignAllowlist) as CampaignField[]

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value))
}

function approved(field: CampaignField, value: unknown): boolean {
  return typeof value === 'string' && (campaignAllowlist[field] as readonly string[]).includes(value)
}

/** Project only reviewed labels, preserving existing analytics filtering. */
export function sanitizeCampaign(value: unknown): Campaign {
  if (!record(value)) return {}
  return Object.fromEntries(campaignFields.flatMap(field =>
    approved(field, value[field]) ? [[field, value[field]]] : [])) as Campaign
}

export function readCurrentCampaign(search: string): Campaign {
  const params = new URLSearchParams(search)
  return sanitizeCampaign(Object.fromEntries(campaignFields.map(field => [field, params.get(field)])))
}

export interface CampaignAttribution {
  firstTouch: Campaign
  lastTouch: Campaign
}

/** An untrusted assertion, never authorization for storage or advertising. */
export interface WaitlistAttributionInput extends CampaignAttribution {
  version: 1
  consent: { analytics: true; globalPrivacyControl: false; policyVersion: string }
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every(key => keys.includes(key))
}

function validCampaign(value: unknown): value is Campaign {
  return record(value) && Object.entries(value).every(([field, label]) =>
    Object.hasOwn(campaignAllowlist, field) && approved(field as CampaignField, label))
}

/** Strict envelope validation: malformed optional data is discarded as a unit. */
export function parseWaitlistAttribution(value: unknown, policyVersion: string): WaitlistAttributionInput | undefined {
  if (!record(value) || !exactKeys(value, ['version', 'consent', 'firstTouch', 'lastTouch']) || value.version !== 1) return
  const choice = value.consent
  if (!record(choice) || !exactKeys(choice, ['analytics', 'globalPrivacyControl', 'policyVersion'])
    || choice.analytics !== true || choice.globalPrivacyControl !== false || !policyVersion
    || choice.policyVersion !== policyVersion) return
  if (!validCampaign(value.firstTouch) || !validCampaign(value.lastTouch)
    || (!Object.keys(value.firstTouch).length && !Object.keys(value.lastTouch).length)) return
  // Construct a fresh projection; never forward arbitrary properties/prototypes.
  return { version: 1, consent: { analytics: true, globalPrivacyControl: false, policyVersion },
    firstTouch: sanitizeCampaign(value.firstTouch), lastTouch: sanitizeCampaign(value.lastTouch) }
}
