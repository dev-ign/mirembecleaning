import { indexablePages } from '../i18n/routes.js'
import { business } from './business.js'
import { privacyConfig, termsConfig } from './legal.js'

export const seo = {
  title: 'Mirembe Cleaning Company | House Cleaning in CT & MA',
  description: business.description,
  canonicalUrl: business.websiteUrl,
  shareImageUrl: new URL('hero.png', business.websiteUrl).href,
  themeColor: '#ffffff',
} as const

export const publicRoutes = indexablePages.filter(route => route.basePath !== privacyConfig.path || privacyConfig.approved).map(route => route.path)

export function pageTitle(path: string): string {
  if (path === '/booking') return 'Book Your Holiday Cleaning | Mirembe Cleaning Company'
  if (path === '/booking/thankyou' || path === '/booking/thank-you') return 'Cleaning Request Received | Mirembe Cleaning Company'
  if (path === termsConfig.path) return termsConfig.title
  if (path === privacyConfig.path) return privacyConfig.title
  return seo.title
}

export function structuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${business.websiteUrl}#business`,
        name: business.name,
        url: business.websiteUrl,
        description: business.description,
        logo: business.logoUrl,
        sameAs: [business.googleBusinessProfileUrl, ...Object.values(business.socialProfiles)],
        ...(business.publicPhone ? { telephone: business.publicPhone } : {}),
        email: business.publicEmail,
        areaServed: business.serviceAreas.map(({ city, state, stateCode }) => ({
          '@type': 'City',
          name: city,
          containedInPlace: { '@type': 'AdministrativeArea', name: state, alternateName: stateCode },
        })),
      },
      {
        '@type': 'WebSite',
        '@id': `${business.websiteUrl}#website`,
        name: business.name,
        url: business.websiteUrl,
        publisher: { '@id': `${business.websiteUrl}#business` },
      },
    ],
  }
}
