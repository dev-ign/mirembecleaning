import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { business } from '../src/config/business.js'
import { publicRoutes } from '../src/config/seo.js'
import { locales } from '../src/i18n/config.js'
import { documentFile, sitePages } from '../src/i18n/routes.js'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom') as { JSDOM: new (html: string, options?: { contentType: string }) => { window: { document: Document } } }
const expectedCluster = ['en', 'es', 'ht', 'pt'].map(code => ({ code: code === 'pt' ? 'pt-BR' : code, href: business.websiteUrl + (code === 'en' ? '' : code + '/') })).concat({ code: 'x-default', href: business.websiteUrl })
const preview = process.argv.includes('--preview')
const results = []
const bundles = new Set<string>()
for (const route of sitePages) {
  const html = readFileSync('dist/' + documentFile(route), 'utf8')
  const document = new JSDOM(html).window.document
  const resource = JSON.parse(readFileSync(`src/i18n/locales/${route.locale}.json`, 'utf8')) as Record<string, string>
  const canonical = new URL(route.canonicalPath!, business.websiteUrl).href
  assert.equal(document.documentElement.lang, locales[route.locale].htmlLang, route.path)
  assert.equal(document.querySelectorAll('link[rel="canonical"]').length, 1, route.path)
  assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute('href'), canonical, route.path)
  assert.equal(document.querySelectorAll('#root h1').length, 1, route.path)
  assert.ok(document.title.length > 5, route.path)
  assert.equal(document.querySelector('meta[property="og:title"]')?.getAttribute('content'), document.title, route.path)
  assert.equal(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'), document.title, route.path)
  const description = document.querySelector('meta[name="description"]')?.getAttribute('content')
  assert.ok(description && description.length > 20, route.path)
  assert.equal(document.querySelector('meta[property="og:description"]')?.getAttribute('content'), description, route.path)
  assert.equal(document.querySelector('meta[name="twitter:description"]')?.getAttribute('content'), description, route.path)
  assert.equal(document.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex'), preview || !route.indexable, route.path)
  const cluster = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')).map(link => ({ code: link.getAttribute('hreflang'), href: link.getAttribute('href') }))
  assert.deepEqual(cluster, route.kind === 'home' ? expectedCluster : [], route.path)
  if (route.kind === 'home') {
    assert.equal(document.querySelector('h1')?.textContent, resource['home.hero.title'].replace(/<[^>]*>/g, ''), route.path)
    assert.ok(document.querySelector('main')?.textContent?.includes(resource['home.hero.lede']), route.path)
    for (const key of ['services.standard.title', 'services.deep.title', 'services.rental.title', 'faq.opening.question', 'home.founders.eyebrow']) assert.ok(document.querySelector('main')?.textContent?.includes(resource[key]), route.path + ' ' + key)
  }
  if (route.kind === 'legal') assert.equal(document.querySelector('article')?.lang, 'en', route.path)
  const schema = JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!)
  assert.equal(schema['@graph'].length, 2, route.path)
  assert.equal(schema['@graph'][0]['@id'], business.websiteUrl + '#business', route.path)
  assert.equal(schema['@graph'][0].url, business.websiteUrl, route.path)
  assert.equal(schema['@graph'][0].email, business.publicEmail, route.path)
  assert.equal(schema['@graph'][0].telephone, business.publicPhone, route.path)
  assert.equal(schema['@graph'][1].inLanguage, locales[route.locale].htmlLang, route.path)
  assert.deepEqual(schema['@graph'][0].areaServed.map((area: { name: string }) => area.name), ['Boston', 'Newington'], route.path)
  for (const script of Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'))) bundles.add(script.getAttribute('src')!)
  assert.equal(document.querySelector('script[src*="fbevents"],script[src*="gtag"],noscript img'), null, route.path)
  results.push({ path: route.path, language: document.documentElement.lang, canonical, title: document.title, description, indexable: !preview && route.indexable, alternates: cluster })
}
assert.equal(bundles.size, 1, 'All pages must share one application bundle')
const sitemap = new JSDOM(readFileSync('dist/sitemap.xml', 'utf8'), { contentType: 'application/xml' }).window.document
const locations = Array.from(sitemap.querySelectorAll('loc')).map(node => node.textContent)
assert.deepEqual(locations, publicRoutes.map(path => new URL(path, business.websiteUrl).href))
assert.equal(sitemap.querySelector('lastmod'), null, 'No fabricated modification dates')
const missing = new JSDOM(readFileSync('dist/404.html', 'utf8')).window.document
assert.equal(missing.querySelector('link[rel="canonical"]'), null)
assert.equal(missing.querySelector('meta[name="robots"]')?.getAttribute('content'), 'noindex,follow')
console.log(JSON.stringify({ documents: results.length, indexable: results.filter(result => result.indexable).length, sharedBundles: bundles.size, sitemap: locations, pages: results }, null, 2))
