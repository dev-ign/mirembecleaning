import { bookingLanguageStorageKey, languageStorageKey } from './config'
import { useLayoutEffect } from 'react'
import { i18n } from './index'
import { resolveSiteRoute } from './routes'
import { localizedStructuredData, pageMetadata } from './seo'

/** The route is authoritative; browser preferences never replace an explicit language URL. */
export function LocaleEffects({ route: pathname }: { route: string }) {
  useLayoutEffect(() => {
    const route = resolveSiteRoute(pathname)
    if (i18n.resolvedLanguage !== route.locale) void i18n.changeLanguage(route.locale)
    const metadata = pageMetadata(route)
    if (route.found) {
      try { localStorage.setItem(languageStorageKey, route.locale) } catch { /* URL remains usable without storage. */ }
      if (route.kind === 'booking' || route.kind === 'confirmation') {
        try { sessionStorage.setItem(bookingLanguageStorageKey, route.locale) } catch { /* Global language preference remains a fallback. */ }
      }
    }
    document.documentElement.lang = metadata.htmlLang
    document.title = metadata.title
    const setMeta = (selector: string, value: string) => document.querySelectorAll(selector).forEach(element => element.setAttribute('content', value))
    setMeta('meta[property="og:title"], meta[name="twitter:title"]', metadata.title)
    setMeta('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', metadata.description)
    setMeta('meta[property="og:url"]', metadata.socialUrl)
    setMeta('meta[property="og:image:alt"], meta[name="twitter:image:alt"]', metadata.imageAlt)
    // Preserve a preview build's stronger noindex directive during client transitions.
    const preview = document.documentElement.dataset.indexing === 'noindex'
    setMeta('meta[name="robots"]', preview ? 'noindex,follow' : metadata.robots)
    const canonicals = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'))
    const canonical = canonicals[0]
    canonicals.slice(1).forEach(element => element.remove())
    if (metadata.canonicalUrl) {
      const element = canonical ?? document.createElement('link')
      element.rel = 'canonical'; element.href = metadata.canonicalUrl
      if (!canonical) document.head.appendChild(element)
    } else canonical?.remove()
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(element => element.remove())
    for (const alternate of metadata.alternates) {
      const element = document.createElement('link')
      element.rel = 'alternate'; element.hreflang = alternate.hreflang; element.href = alternate.href
      document.head.appendChild(element)
    }
    const schema = document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]')
    if (schema) schema.textContent = JSON.stringify(localizedStructuredData(route)).replace(/</g, '\\u003c')
  }, [pathname])
  return null
}
