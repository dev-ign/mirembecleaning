export const termsConfig = {
  path: '/terms',
  title: 'Mirembe Cleaning Company Terms of Service',
  updatedAt: '2026-10-25',
} as const

// Founder-approved policy. Deployment and live-provider validation remain
// separate release steps; optional analytics still requires visitor consent.
export const privacyConfig = {
  path: '/privacy',
  title: 'Mirembe Cleaning Company Privacy Policy',
  approved: true,
  effectiveAt: '2026-10-26',
}
