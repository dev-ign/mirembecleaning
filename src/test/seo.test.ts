import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { business } from '../config/business'

describe('generated search files', () => {
  it('ships one crawlable canonical homepage with matching entity data', () => {
    const page = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html')
    expect(page.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(business.websiteUrl)
    expect(page.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('index')
    expect(page.querySelector('meta[property="og:image"]')?.getAttribute('content')).toMatch(/^https:\/\//)
    expect(page.querySelector('h1')?.textContent).toContain('A Cleaner Home.')
    expect(page.querySelector('main')?.textContent).toContain('Greater Boston')
    expect(page.querySelector('main')?.textContent).toContain('Newington')
    expect(page.querySelectorAll('#root h1')).toHaveLength(1)
    expect(page.querySelector('#root button[aria-haspopup="dialog"]')).not.toBeNull()
    expect(page.querySelector('#root #founders-heading')).not.toBeNull()
    expect(page.querySelector('#root img[src="/landing/Hero%20Image.webp"]')).not.toBeNull()
    expect(page.querySelector('head link[rel="stylesheet"]')?.getAttribute('href')).toBe('/src/index.css')
    expect(page.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe('/favicon.png')
    expect(page.querySelector('#root img.brand-symbol')?.getAttribute('src')).toBe('/icon.png')

    const schema = JSON.parse(page.querySelector('script[type="application/ld+json"]')!.textContent!) as { '@graph': Array<Record<string, unknown>> }
    expect(schema['@graph']).toHaveLength(2)
    expect(schema['@graph'][0]).toMatchObject({ '@id': `${business.websiteUrl}#business`, name: business.name, email: business.publicEmail, logo: `${business.websiteUrl}icon.png` })
    expect(schema['@graph'][0]).not.toHaveProperty('address')
    expect(schema['@graph'][0]).not.toHaveProperty('openingHoursSpecification')
    expect(schema['@graph'][0]).toMatchObject({
      '@type': 'Organization',
      areaServed: [
        { '@type': 'City', name: 'Boston', containedInPlace: { name: 'Massachusetts', alternateName: 'MA' } },
        { '@type': 'City', name: 'Newington', containedInPlace: { name: 'Connecticut', alternateName: 'CT' } },
      ],
      sameAs: [business.googleBusinessProfileUrl, business.socialProfiles.instagram, business.socialProfiles.facebook],
    })
    expect(schema['@graph'][0]).not.toHaveProperty('hasOfferCatalog')
  })

  it('lists only the canonical homepage in sitemap and robots', () => {
    const sitemap = readFileSync('public/sitemap.xml', 'utf8')
    const robots = readFileSync('public/robots.txt', 'utf8')
    expect(sitemap.match(/<loc>/g)).toHaveLength(1)
    expect(sitemap).toContain(`<loc>${business.websiteUrl}</loc>`)
    expect(robots).toContain(`Sitemap: ${business.websiteUrl}sitemap.xml`)
  })
})
