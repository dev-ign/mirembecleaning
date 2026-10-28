import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import baseline from './fixtures/phase1-seo-baseline.json'

it('preserves every existing English page’s canonical, metadata, H1 and complete main copy', () => {
  for (const expected of Object.values(baseline.pages)) {
    const page = new DOMParser().parseFromString(readFileSync(expected.file, 'utf8'), 'text/html')
    expect(page.title).toBe(expected.title)
    expect(page.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(expected.description)
    expect(page.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(expected.robots)
    expect(page.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(expected.canonical)
    expect(page.querySelectorAll('h1')).toHaveLength(1)
    expect(page.querySelector('h1')?.textContent).toBe(expected.h1)
    expect(page.querySelector('main')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(expected.mainText)
    const schema = JSON.parse(page.querySelector('script[type="application/ld+json"]')!.textContent!)
    expect(schema['@graph']).toHaveLength(expected.schema['@graph'].length)
    expect(schema).toMatchObject(expected.schema)
  }
})

it('preserves protected booking, vendor-loader, privacy, business and legal source files byte for byte', () => {
  for (const [file, hash] of Object.entries(baseline.protectedFiles)) expect(createHash('sha256').update(readFileSync(file)).digest('hex'), file).toBe(hash)
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
  for (const key of ['crons', 'functions', 'headers'] as const) expect(config[key]).toEqual(baseline.vercel[key])
})

it('reuses Phase 1 translations without changing marketing, form, service or approved legal copy', () => {
  for (const [locale, hash] of Object.entries(baseline.translationHashes)) {
    const dictionary = JSON.parse(readFileSync(`src/i18n/locales/${locale}.json`, 'utf8')) as Record<string, string>
    const entries = baseline.translationKeys.map(key => [key, dictionary[key]])
    expect(createHash('sha256').update(JSON.stringify(entries)).digest('hex'), locale).toBe(hash)
  }
})
