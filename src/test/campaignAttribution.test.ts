// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { campaignAllowlist, parseWaitlistAttribution, readCurrentCampaign, sanitizeCampaign } from '../shared/campaignAttribution.js'
import { privacyConfig } from '../config/legal'

const snapshot = () => ({ version: 1, consent: { analytics: true, globalPrivacyControl: false, policyVersion: privacyConfig.effectiveAt },
  firstTouch: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'holiday_2026' },
  lastTouch: { utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'launch_2027' } })

describe('pure, shared campaign contracts in Node', () => {
  it('retains the existing catalog and filters unreviewed labels and identifiers', () => {
    expect(campaignAllowlist).toEqual({
      utm_source: ['facebook', 'instagram', 'meta', 'google', 'bing', 'newsletter', 'holiday'],
      utm_medium: ['paid_social', 'paid-social', 'social', 'cpc', 'email', 'organic', 'referral'],
      utm_campaign: ['holiday_2026', 'holiday-2026', 'launch_2027', 'autumn'],
      utm_content: ['hero', 'holiday_modal', 'holiday_floating', 'video', 'image', 'carousel'],
      utm_term: ['house_cleaning', 'holiday_cleaning', 'boston', 'newington'],
    })
    expect(readCurrentCampaign('?utm_source=google&utm_medium=cpc&utm_campaign=unreviewed&utm_term=private%40example.test&gclid=secret&gbraid=secret&wbraid=secret'))
      .toEqual({ utm_source: 'google', utm_medium: 'cpc' })
    expect(sanitizeCampaign({ utm_content: 'hero', fbclid: 'opaque', email: 'private@example.test' })).toEqual({ utm_content: 'hero' })
  })

  it('returns a fresh bounded versioned envelope, not the input object', () => {
    const input = snapshot()
    const parsed = parseWaitlistAttribution(input, privacyConfig.effectiveAt)
    expect(parsed).toEqual(input)
    expect(parsed).not.toBe(input)
    expect(parsed?.firstTouch).not.toBe(input.firstTouch)
    expect(typeof window).toBe('undefined')
  })

  it.each([
    undefined, null, [], 'private@example.test',
    { ...snapshot(), version: 2 },
    { ...snapshot(), source: 'google' },
    { ...snapshot(), received_at: '2026-11-05T00:00:00Z' },
    { ...snapshot(), consent: { ...snapshot().consent, analytics: false } },
    { ...snapshot(), consent: { ...snapshot().consent, globalPrivacyControl: true } },
    { ...snapshot(), consent: { ...snapshot().consent, policyVersion: 'unapproved' } },
    { ...snapshot(), consent: { ...snapshot().consent, ad_user_data: 'granted' } },
    { ...snapshot(), firstTouch: { ...snapshot().firstTouch, gclid: 'opaque' } },
    { ...snapshot(), lastTouch: { utm_campaign: 'x'.repeat(1000) } },
    { ...snapshot(), lastTouch: { utm_source: ['google'] } },
    { ...snapshot(), firstTouch: [], lastTouch: {} },
    { ...snapshot(), firstTouch: {}, lastTouch: {} },
    { ...snapshot(), firstTouch: Object.create({ utm_source: 'google' }) },
    JSON.parse('{"version":1,"__proto__":{"qualified":true}}'),
  ])('discards malformed optional data without throwing (%#)', input => {
    expect(parseWaitlistAttribution(input, privacyConfig.effectiveAt)).toBeUndefined()
  })
})
