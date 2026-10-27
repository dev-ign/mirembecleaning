import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const publication = vi.hoisted(() => ({ approved: true }))
vi.mock('../config/legal', () => ({ privacyConfig: publication }))
beforeEach(() => { publication.approved = true })

afterEach(() => vi.unstubAllEnvs())

it('keeps tracking disabled while the policy is unapproved even with a valid production URL and IDs', async () => {
  vi.resetModules()
  publication.approved = false
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_META_PIXEL_ID', '39772457375733047')
  vi.stubEnv('VITE_GA4_MEASUREMENT_ID', 'G-TEST123')
  vi.stubEnv('VITE_PRIVACY_POLICY_URL', 'https://www.mirembecleaning.com/privacy')
  const { marketing } = await import('../config/marketing')
  expect(marketing.metaPixelId).toBe('')
  expect(marketing.ga4Id).toBe('')
})

it('uses the public Pixel ID in production only with a valid published-policy URL', async () => {
  vi.resetModules()
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_META_PIXEL_ID', '39772457375733047')
  vi.stubEnv('VITE_PRIVACY_POLICY_URL', 'https://www.mirembecleaning.com/privacy')
  expect((await import('../config/marketing')).marketing.metaPixelId).toBe('39772457375733047')
})

it('keeps providers disabled with a placeholder policy', async () => {
  vi.resetModules()
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_META_PIXEL_ID', '39772457375733047')
  vi.stubEnv('VITE_PRIVACY_POLICY_URL', 'https://example.com/privacy')
  expect((await import('../config/marketing')).marketing.metaPixelId).toBe('')
})

it('requires explicit development opt-in even with valid provider configuration', async () => {
  vi.resetModules()
  vi.stubEnv('PROD', false)
  vi.stubEnv('VITE_META_PIXEL_ID', '39772457375733047')
  vi.stubEnv('VITE_PRIVACY_POLICY_URL', 'https://www.mirembecleaning.com/privacy')
  vi.stubEnv('VITE_ENABLE_MARKETING_IN_DEVELOPMENT', 'false')
  expect((await import('../config/marketing')).marketing.metaPixelId).toBe('')
  vi.resetModules()
  vi.stubEnv('VITE_ENABLE_MARKETING_IN_DEVELOPMENT', 'true')
  expect((await import('../config/marketing')).marketing.metaPixelId).toBe('39772457375733047')
})
