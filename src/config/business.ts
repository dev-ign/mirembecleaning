export type ServiceArea =
  | { readonly city: string; readonly state: 'Massachusetts'; readonly stateCode: 'MA'; readonly countryCode: 'US' }
  | { readonly city: string; readonly state: 'Connecticut'; readonly stateCode: 'CT'; readonly countryCode: 'US' }

export type BusinessService =
  | { readonly name: 'Standard cleaning' | 'Deep cleaning' | 'Moving-related cleaning' | 'Office and workplace cleaning'; readonly source: 'google-service-list' }
  | { readonly name: 'Recurring home cleaning' | 'Rental turnover cleaning'; readonly source: 'google-business-description' }

export interface BusinessConfig {
  readonly name: string
  readonly websiteUrl: string
  readonly googleBusinessProfileUrl: string
  readonly category: 'House cleaning service'
  readonly description: string
  readonly status: 'prelaunch' | 'operating'
  readonly logoUrl: string
  readonly serviceAreas: readonly ServiceArea[]
  readonly services: readonly BusinessService[]
  readonly socialProfiles: {
    readonly instagram: string
    readonly facebook: string
  }
  readonly profileOpeningMonth: string
  readonly profileListedHours: string
  readonly servesCustomersAtTheirLocations: true
  readonly publicPhone: string
  readonly phoneDisplay: string
  readonly phoneHref: string
  readonly publicEmail: string
}

const websiteUrl = 'https://www.mirembecleaning.com/'

export const business: BusinessConfig = {
  name: 'Mirembe Cleaning Company',
  websiteUrl,
  googleBusinessProfileUrl: 'https://share.google/vjONTRZ7x52jKWPCA',
  category: 'House cleaning service',
  description: 'Mirembe Cleaning Company is a family-owned residential cleaning business preparing to serve Boston, MA, and Newington, CT. Join our waitlist for launch updates.',
  status: 'prelaunch',
  logoUrl: new URL('icon.png', websiteUrl).href,
  serviceAreas: [
    { city: 'Boston', state: 'Massachusetts', stateCode: 'MA', countryCode: 'US' },
    { city: 'Newington', state: 'Connecticut', stateCode: 'CT', countryCode: 'US' },
  ],
  services: [
    { name: 'Standard cleaning', source: 'google-service-list' },
    { name: 'Deep cleaning', source: 'google-service-list' },
    { name: 'Moving-related cleaning', source: 'google-service-list' },
    { name: 'Office and workplace cleaning', source: 'google-service-list' },
    { name: 'Recurring home cleaning', source: 'google-business-description' },
    { name: 'Rental turnover cleaning', source: 'google-business-description' },
  ],
  socialProfiles: {
    instagram: 'https://www.instagram.com/mirembecleaning',
    facebook: 'https://www.facebook.com/profile.php?id=61595277816336',
  },
  // These are current profile claims, not confirmed appointment availability.
  profileOpeningMonth: '2026-10',
  profileListedHours: '24/7',
  servesCustomersAtTheirLocations: true,
  publicPhone: '+16179174137',
  phoneDisplay: '(617) 917-4137',
  phoneHref: 'tel:+16179174137',
  publicEmail: 'hello@mirembecleaning.com',
}
