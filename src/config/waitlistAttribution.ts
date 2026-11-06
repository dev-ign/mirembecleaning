// Local synthetic preview only. Production-style builds always omit metadata.
// Server persistence remains disabled until schema/retention/withdrawal approval.
export const waitlistAttributionPreviewEnabled = import.meta.env.DEV
  && import.meta.env.VITE_ENABLE_WAITLIST_ATTRIBUTION_PREVIEW === 'true'
