import { describe, expect, it } from 'vitest'
import { basePaths, canonicalRedirect, documentFile, indexablePages, localizeHref, localizedPath, resolveSiteRoute, routeRedirects, sitePages } from '../i18n/routes'
import { localeCodes, locales } from '../i18n/config'
import { alternatesFor, localizedStructuredData, pageMetadata } from '../i18n/seo'
import { business } from '../config/business'
import { allowsPromotionalOverlays } from '../config/campaigns'

describe('canonical locale route inventory', () => {
  it('has twenty actual documents and exactly six indexable URLs', () => {
    expect(sitePages).toHaveLength(20)
    expect(new Set(sitePages.map(documentFile)).size).toBe(20)
    expect(indexablePages.map(page => page.path)).toEqual(['/', '/terms', '/privacy', '/es/', '/ht/', '/pt/'])
    expect(sitePages.some(page => page.path.startsWith('/en'))).toBe(false)
  })
  it.each(localeCodes)('recognizes every %s page, preserving page context and language semantics', code => {
    for (const base of basePaths) {
      const path = localizedPath(base, code)
      const route = resolveSiteRoute(path)
      expect(route).toMatchObject({ found: true, locale: code, basePath: base, path })
      expect(pageMetadata(route).htmlLang).toBe(locales[code].htmlLang)
      expect(allowsPromotionalOverlays(path)).toBe(base === '/')
      expect(canonicalRedirect(path)).toBeNull()
      expect(canonicalRedirect('/' + documentFile(route))).toBe(path)
    }
  })
  it.each(['/fr/', '/es/missing', '/ht/api/waitlist', '/es/es/', '/api/waitlist', '/assets/app.js', '/PT/', '/pt//', '//es/'])('rejects unknown/system route %s instead of returning a homepage alias', path => {
    expect(resolveSiteRoute(path).found).toBe(false)
    expect(canonicalRedirect(path)).toBeNull()
  })
  it('normalizes explicit aliases with one hop and no loops', () => {
    for (const { source, destination } of routeRedirects) {
      expect(source).not.toBe(destination)
      expect(canonicalRedirect(source)).toBe(destination)
      expect(canonicalRedirect(destination)).toBeNull()
      expect(resolveSiteRoute(destination).found).toBe(true)
    }
    expect(canonicalRedirect('/en/')).toBe('/')
    expect(canonicalRedirect('/es')).toBe('/es/')
    expect(canonicalRedirect('/booking/thank-you/')).toBe('/booking/thankyou')
    expect(canonicalRedirect('/ht/booking/thank-you')).toBe('/ht/booking/thankyou')
  })
  it('localizes only site-owned page URLs and retains queries and anchors', () => {
    expect(localizeHref('/booking?embed=basic&utm_source=holiday#top', 'ht')).toBe('/ht/booking?embed=basic&utm_source=holiday#top')
    expect(localizeHref('/es/booking', 'pt')).toBe('/pt/booking')
    for (const href of ['/api/waitlist', '/landing/v2/hero.webp', 'mailto:hello@mirembecleaning.com', 'tel:+16179174137', 'https://app.zenmaid.com/book/mirembe-cleaning-company-holiday', '//example.com/', '#services']) expect(localizeHref(href, 'es')).toBe(href)
  })
})

describe('locale SEO helpers', () => {
  it.each(localeCodes)('provides a complete reciprocal homepage cluster for %s', locale => {
    const route = resolveSiteRoute(localizedPath('/', locale))
    const metadata = pageMetadata(route)
    expect(metadata.canonicalUrl).toBe(new URL(route.path, business.websiteUrl).href)
    expect(metadata.robots).toBe('index,follow,max-image-preview:large')
    expect(metadata.alternates).toEqual([
      { hreflang: 'en', href: business.websiteUrl },
      { hreflang: 'es', href: business.websiteUrl + 'es/' },
      { hreflang: 'ht', href: business.websiteUrl + 'ht/' },
      { hreflang: 'pt-BR', href: business.websiteUrl + 'pt/' },
      { hreflang: 'x-default', href: business.websiteUrl },
    ])
    expect(metadata.title).not.toBe('')
    expect(metadata.description).not.toBe('')
  })
  it('excludes transactional and unapproved legal equivalents from hreflang and indexing', () => {
    for (const page of sitePages.filter(route => route.kind !== 'home')) {
      expect(alternatesFor(page)).toEqual([])
      if (page.kind !== 'legal' || page.locale !== 'en') expect(pageMetadata(page).robots).toBe('noindex,follow')
      if (page.kind === 'legal') expect(pageMetadata(page).canonicalUrl).toBe(new URL(page.basePath, business.websiteUrl).href)
    }
  })
  it('forces noindex in preview builds while retaining production canonicals', () => {
    for (const route of sitePages) {
      expect(pageMetadata(route, true).robots).toBe('noindex,follow')
      expect(pageMetadata(route, true).canonicalUrl).toBe(pageMetadata(route).canonicalUrl)
    }
  })
  it.each(localeCodes)('preserves one real-world business identity and U.S. geography for %s', locale => {
    const route = resolveSiteRoute(localizedPath('/', locale))
    const schema = localizedStructuredData(route)
    expect(schema['@graph']).toHaveLength(2)
    expect(schema['@graph'][0]).toMatchObject({ '@id': business.websiteUrl + '#business', name: business.name, url: business.websiteUrl, email: business.publicEmail, telephone: business.publicPhone })
    expect(schema['@graph'][1]).toMatchObject({ '@id': business.websiteUrl + '#website', inLanguage: locales[locale].htmlLang, url: new URL(route.path, business.websiteUrl).href })
    expect(schema['@graph'][0]).not.toHaveProperty('aggregateRating')
    expect(schema['@graph'][0]).not.toHaveProperty('address')
  })
})
