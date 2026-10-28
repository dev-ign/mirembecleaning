import { resources, type TranslationKey } from './index'
import { locales } from './config'
import { localizedPath, sitePages, type SiteRoute } from './routes'
import { business } from '../config/business'
import { pageTitle, seo, structuredData } from '../config/seo'
import { privacyConfig } from '../config/legal'

export const absoluteUrl = (path: string) => new URL(path, business.websiteUrl).href
export function alternatesFor(route: SiteRoute) {
  if (!route.indexable || route.kind !== 'home') return []
  const alternatives = sitePages.filter(page => page.kind === route.kind && page.indexable).map(page => ({ hreflang: locales[page.locale].hreflang as string, href: absoluteUrl(page.path) }))
  return [...alternatives, { hreflang: 'x-default', href: business.websiteUrl }]
}
export function pageMetadata(route: SiteRoute, preview = false) {
  const text = (key: TranslationKey) => resources[route.locale][key]
  const english = route.locale === 'en'
  const title = route.kind === 'not-found' ? text('seo.notFound.title')
    : english || route.kind === 'legal' ? pageTitle(route.basePath)
    : text(route.kind === 'home' ? 'seo.home.title' : route.kind === 'booking' ? 'seo.booking.title' : 'seo.thankYou.title')
  const description = route.kind === 'home' ? english ? seo.description : text('seo.home.description')
    : route.kind === 'booking' ? english ? 'Request your holiday cleaning with Mirembe Cleaning Company. Our team will follow up to confirm availability.' : text('booking.intro')
    : route.kind === 'confirmation' ? english ? 'Thank you for requesting a cleaning. Our team will review your request and contact you to confirm availability.' : text('booking.thankYou.message')
    : route.basePath === '/terms' ? english ? 'Read the Mirembe Cleaning Company Terms of Service for residential and rental property cleaning services. Last updated October 25, 2026.' : text('seo.terms.description')
    : route.basePath === '/privacy' ? english ? 'Read the Mirembe Cleaning Company Privacy Policy, effective October 26, 2026, covering service requests, applications, communications, and optional tracking.' : text('seo.privacy.description')
    : text('notFound.description')
  const indexable = route.indexable && (route.basePath !== privacyConfig.path || privacyConfig.approved) && !preview
  return {
    title, description,
    canonicalUrl: route.canonicalPath ? absoluteUrl(route.canonicalPath) : null,
    socialUrl: absoluteUrl(route.path),
    htmlLang: locales[route.locale].htmlLang,
    imageAlt: english ? 'A bright, peaceful home interior' : text('home.hero.photoAlt'),
    robots: indexable ? route.kind === 'home' ? 'index,follow,max-image-preview:large' : 'index,follow' : 'noindex,follow',
    alternates: alternatesFor(route),
  }
}
export function localizedStructuredData(route: SiteRoute) {
  const schema = structuredData()
  return {
    ...schema,
    '@graph': schema['@graph'].map(entity => entity['@id'] === `${business.websiteUrl}#business` ? { ...entity, description: resources[route.locale]['seo.description'] } : entity['@type'] === 'WebSite' ? {
      ...entity, url: absoluteUrl(localizedPath('/', route.locale)), inLanguage: locales[route.locale].htmlLang,
    } : entity),
  }
}
