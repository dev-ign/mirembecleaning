import { localeCodes, locales, type SupportedLocale } from './config.js'

export const basePaths = ['/', '/booking', '/booking/thankyou', '/terms', '/privacy'] as const
export type BasePath = (typeof basePaths)[number]
export type SiteRoute = {
  found: boolean
  locale: SupportedLocale
  basePath: BasePath | '/404'
  path: string
  canonicalPath: string | null
  kind: 'home' | 'booking' | 'confirmation' | 'legal' | 'not-found'
  indexable: boolean
}

export function localizedPath(base: BasePath, locale: SupportedLocale): string {
  const prefix = locales[locale].pathPrefix
  return base === '/' ? prefix + '/' : prefix + base
}

/** Recognize only actual site pages. APIs, assets and unknown prefixes are never localized. */
export function resolveSiteRoute(pathname: string): SiteRoute {
  if (pathname.includes('//')) return { found: false, locale: 'en', basePath: '/404', path: pathname, canonicalPath: null, kind: 'not-found', indexable: false }
  const normalized = pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/'
  let locale: SupportedLocale = 'en'
  let base = normalized
  for (const code of localeCodes) {
    const prefix = locales[code].pathPrefix
    if (prefix && (normalized === prefix || normalized.startsWith(prefix + '/'))) {
      locale = code
      base = normalized.slice(prefix.length) || '/'
      break
    }
  }
  if (base === '/booking/thank-you') base = '/booking/thankyou'
  if (!basePaths.some(path => path === base)) return { found: false, locale: 'en', basePath: '/404', path: pathname, canonicalPath: null, kind: 'not-found', indexable: false }
  const basePath = base as BasePath
  const kind = basePath === '/' ? 'home' : basePath === '/booking' ? 'booking' : basePath === '/booking/thankyou' ? 'confirmation' : 'legal'
  const path = localizedPath(basePath, locale)
  return { found: true, locale, basePath, path, kind, canonicalPath: kind === 'legal' ? basePath : path, indexable: kind === 'home' || (kind === 'legal' && locale === 'en') }
}

export const sitePages = localeCodes.flatMap(locale => basePaths.map(base => resolveSiteRoute(localizedPath(base, locale))))
export const indexablePages = sitePages.filter(route => route.indexable)
export function documentFile(route: SiteRoute): string {
  return route.kind === 'not-found' ? '404.html' : route.path === '/' ? 'index.html' : route.path.replace(/^\//, '').replace(/\/$/, '') + '/index.html'
}

/** Explicit aliases only. Keep unknown paths as genuine 404s. */
export const routeRedirects = sitePages.flatMap(route => {
  const directory = route.path.replace(/\/$/, '')
  const aliases = [directory + '/index.html', route.path.endsWith('/') ? directory : route.path + '/']
  if (route.locale === 'en') aliases.push('/en' + (route.basePath === '/' ? '/' : route.basePath), '/en' + (route.basePath === '/' ? '' : route.basePath + '/'))
  if (route.kind === 'confirmation' && route.locale !== 'en') aliases.push(locales[route.locale].pathPrefix + '/booking/thank-you', locales[route.locale].pathPrefix + '/booking/thank-you/')
  return aliases.filter(alias => alias && alias !== route.path).map(source => ({ source, destination: route.path, permanent: true as const }))
})

export function canonicalRedirect(pathname: string): string | null {
  // Preserve the existing legacy English thank-you prefix redirect.
  if (/^\/booking\/thank-you(?:\/|$)/.test(pathname)) return '/booking/thankyou'
  return routeRedirects.find(redirect => redirect.source === pathname)?.destination ?? null
}

/** Same-page links may stay fragments; all other supported site links retain the locale. */
export function localizeHref(href: string, locale: SupportedLocale): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href
  const split = href.search(/[?#]/)
  const pathname = split === -1 ? href : href.slice(0, split)
  const suffix = split === -1 ? '' : href.slice(split)
  const route = resolveSiteRoute(pathname)
  return route.found ? localizedPath(route.basePath as BasePath, locale) + suffix : href
}
