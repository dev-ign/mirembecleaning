// Explicit local preview only, including during production prerendering.
// Phase 1 has no subscription endpoint; production builds always hide the UI.
export const newsletterPreviewEnabled = import.meta.env.DEV
  && import.meta.env.MODE === 'development'
  && import.meta.env.VITE_ENABLE_NEWSLETTER_PREVIEW === 'true'
