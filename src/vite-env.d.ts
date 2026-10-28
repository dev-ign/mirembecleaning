/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVACY_POLICY_URL?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_GA4_MEASUREMENT_ID?: string
  readonly VITE_META_PIXEL_ID?: string
  readonly VITE_ENABLE_MARKETING_IN_DEVELOPMENT?: string
  readonly VITE_ANALYTICS_DEBUG?: string
}
