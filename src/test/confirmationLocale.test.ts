import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { bookingLanguageStorageKey, languageStorageKey } from '../i18n/config'

const html = readFileSync('booking/thankyou/index.html', 'utf8')
const page = new DOMParser().parseFromString(html, 'text/html')
const bootstrap = Array.from(page.querySelectorAll('script:not([src])')).find(element => element.textContent?.includes(languageStorageKey))!.textContent!
const run = new Function('sessionStorage', 'localStorage', 'location', 'document', bootstrap)

describe('unchanged ZenMaid confirmation return', () => {
  it.each(['es', 'ht', 'pt'])('restores the %s booking presentation before hydration, retaining campaign query and hash', locale => {
    const session = { getItem: vi.fn().mockReturnValue(locale) }
    const local = { getItem: vi.fn().mockReturnValue('en') }
    const target = { search: '?utm_source=holiday', hash: '#top', replace: vi.fn() }
    const document = { documentElement: { setAttribute: vi.fn() } }
    run(session, local, target, document)
    expect(session.getItem).toHaveBeenCalledWith(bookingLanguageStorageKey)
    expect(local.getItem).not.toHaveBeenCalled()
    expect(target.replace).toHaveBeenCalledWith('/' + locale + '/booking/thankyou?utm_source=holiday#top')
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-locale-redirect', '')
  })
  it('honors the current tab’s English booking even if another tab last selected Spanish', () => {
    const target = { search: '', hash: '', replace: vi.fn() }
    const local = { getItem: vi.fn().mockReturnValue('es') }
    run({ getItem: () => 'en' }, local, target, { documentElement: { setAttribute: vi.fn() } })
    expect(local.getItem).not.toHaveBeenCalled()
    expect(target.replace).not.toHaveBeenCalled()
  })
  it('falls back to the functional preference if session storage is blocked', () => {
    const target = { search: '', hash: '', replace: vi.fn() }
    run({ getItem: () => { throw new Error('blocked') } }, { getItem: () => 'ht' }, target, { documentElement: { setAttribute: vi.fn() } })
    expect(target.replace).toHaveBeenCalledWith('/ht/booking/thankyou')
  })
  it.each(['fr', '__proto__', '', null])('ignores invalid/missing language %s without redirecting or hiding the document', value => {
    const target = { search: '', hash: '', replace: vi.fn() }
    const document = { documentElement: { setAttribute: vi.fn() } }
    run({ getItem: () => value }, { getItem: () => value }, target, document)
    expect(target.replace).not.toHaveBeenCalled()
    expect(document.documentElement.setAttribute).not.toHaveBeenCalled()
  })
  it('adds no preference redirect to explicit locale confirmation URLs or indexable homepages', () => {
    for (const file of ['index.html', 'es/index.html', 'ht/index.html', 'pt/index.html', 'es/booking/thankyou/index.html', 'ht/booking/thankyou/index.html', 'pt/booking/thankyou/index.html']) expect(readFileSync(file, 'utf8')).not.toContain('data-locale-redirect')
  })
})
