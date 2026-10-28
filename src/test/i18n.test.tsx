import { initializeRouteLocale } from '../i18n/navigation'
import { act, fireEvent, render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import App from '../App'
import { i18n, t, resources, formatDateRange } from '../i18n'
import { bookingLanguageStorageKey, languageStorageKey, locales, localeCodes, readSavedLocale } from '../i18n/config'
import { setConsent, trackLanguageChange } from '../lib/optionalEvents'
import { getServices, getFaqs } from '../components/landing/content'
import { WaitlistExperience } from '../components/WaitlistExperience'
import { HiringApplicationForm } from '../components/hiring/HiringApplicationForm'
import { HolidayPromoModal } from '../components/landing/HolidayCampaign'
import { createWaitlistEntry, updateWaitlistZip } from '../services/waitlistService'
import { saveConsent, getConsent } from '../lib/consent'
import type { WaitlistRecord } from '../types/waitlist'

vi.mock('../lib/optionalEvents', () => ({ trackLanguageChange: vi.fn(), trackEvent: vi.fn(), trackBookingCTA: vi.fn(), trackServiceView: vi.fn(), prepareOptionalEvents: vi.fn(), startAnalytics: vi.fn(), stopAnalytics: vi.fn(), setBookingFormVisible: vi.fn(), setConsent: vi.fn() }))
vi.mock('../lib/zenmaid', () => ({ loadZenMaid: vi.fn().mockResolvedValue(undefined) }))
const marketing = vi.hoisted(() => ({ ga4Id: '', metaPixelId: '', privacyPolicyUrl: '' }))
vi.mock('../config/marketing', () => ({ marketing }))
vi.mock('../components/TurnstileWidget', async () => {
  const { useEffect } = await import('react')
  return { TurnstileWidget: ({ onStatusChange }: { onStatusChange: (value: string, token?: string) => void }) => {
    useEffect(() => { onStatusChange('verified', 'test-token') }, [onStatusChange])
    return null
  } }
})
vi.mock('../services/waitlistService', async original => ({ ...await original<typeof import('../services/waitlistService')>(), createWaitlistEntry: vi.fn(), updateWaitlistZip: vi.fn() }))

beforeEach(async () => {
  vi.clearAllMocks()
  localStorage.clear()
  marketing.ga4Id = ''; marketing.metaPixelId = ''
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false })
  history.replaceState(null, '', '/')
  await i18n.changeLanguage('en')
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } })
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(async () => { cleanup(); await i18n.changeLanguage('en') })

async function choose(code: keyof typeof locales) {
  await userEvent.click(screen.getByRole('button', { name: t('language.current', { language: locales[i18n.language as keyof typeof locales].label }) }))
  await userEvent.click(screen.getByRole('menuitemradio', { name: locales[code].label }))
}

describe('language selection and persistence', () => {
  it('defaults to English, ignores browser language, and rejects invalid saved values', () => {
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'pt-BR' })
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A Cleaner Home, More Peace.')
    expect(document.documentElement.lang).toBe('en')
    for (const value of ['fr', '__proto__', 'pt-BR', '', 'toString']) { localStorage.setItem(languageStorageKey, value); expect(readSavedLocale()).toBe('en') }
  })
  it.each(['es', 'ht', 'pt'] as const)('switches the whole homepage to %s, reloads, and returns to English', async code => {
    const view = render(<App />)
    await choose(code)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(resources[code]['home.hero.title'].replace(/<[^>]*>/g, ''))
    expect(screen.getByRole('heading', { name: t('services.title') })).toBeVisible()
    expect(screen.getByRole('button', { name: t('faq.opening.question') })).toBeVisible()
    expect(localStorage.getItem(languageStorageKey)).toBe(code)
    expect(location.pathname).toBe(locales[code].pathPrefix + '/')
    expect(document.documentElement.lang).toBe(locales[code].htmlLang)
    expect(trackLanguageChange).toHaveBeenCalledWith('en', code)
    const trigger = screen.getByRole('button', { name: t('language.current', { language: locales[code].label }) })
    expect(trigger.querySelector('.language-active-code')).toHaveTextContent(locales[code].shortLabel)
    view.unmount()
    await act(() => i18n.changeLanguage('en'))
    render(<App />)
    expect(document.documentElement.lang).toBe(locales[code].htmlLang)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(resources[code]['home.hero.title'].replace(/<[^>]*>/g, ''))
    await choose('en')
    expect(document.documentElement.lang).toBe('en')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A Cleaner Home, More Peace.')
  })
  it('hydrates the URL locale without letting a conflicting saved preference replace it', async () => {
    history.replaceState(null, '', '/ht/')
    initializeRouteLocale('/ht/')
    const markup = renderToString(<App path="/ht/" />)
    const container = document.createElement('div'); container.innerHTML = markup; document.body.appendChild(container)
    localStorage.setItem(languageStorageKey, 'es')
    const errors = vi.fn()
    let root!: ReturnType<typeof hydrateRoot>
    await act(async () => { root = hydrateRoot(container, <App />, { onRecoverableError: errors }); await Promise.resolve() })
    expect(errors).not.toHaveBeenCalled()
    expect(container.querySelector('h1')).toHaveTextContent('Yon kay pi pwòp, plis lapè.')
    expect(document.documentElement.lang).toBe('ht')
    await act(() => root.unmount()); container.remove()
  })
  it('keeps language switching usable when storage throws', async () => {
    render(<App />)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    await choose('pt')
    expect(document.documentElement.lang).toBe('pt-BR')
    expect(screen.getByRole('status')).toHaveTextContent(t('language.saveFailed'))
  })
  it('does not override an explicit language URL when another tab changes or clears its preference', async () => {
    render(<App />)
    await choose('ht')
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: languageStorageKey, newValue: 'es' })))
    expect(document.documentElement.lang).toBe('ht')
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: languageStorageKey, newValue: null })))
    expect(document.documentElement.lang).toBe('ht')
    expect(location.pathname).toBe('/ht/')
  })
})

describe('accessible language menu', () => {
  it.each(localeCodes)('keeps the %s header utility immediately before the final primary waitlist action', async code => {
    history.replaceState(null, '', locales[code].pathPrefix + '/')
    render(<App />)
    const actions = document.querySelector('.landing-header-actions')!
    const trigger = within(actions as HTMLElement).getByRole('button', { name: t('language.current', { language: locales[code].label }) })
    expect(trigger.querySelector('.language-active-code')).toHaveTextContent(locales[code].shortLabel)
    expect(trigger.parentElement?.nextElementSibling).toBe(actions.lastElementChild)
    expect(actions.lastElementChild).toHaveClass('landing-button', 'is-primary')
    expect(actions.lastElementChild).toHaveTextContent(t('waitlist.join'))
    await userEvent.click(actions.lastElementChild as HTMLElement)
    expect(screen.getByRole('dialog', { name: t('waitlist.title') })).toBeVisible()
  })
  it('supports keyboard arrows, selected state, Home/End, Escape and focus restoration', async () => {
    const user = userEvent.setup(); render(<App />)
    const trigger = screen.getByRole('button', { name: 'Change language, current language: English' }); trigger.focus()
    await user.keyboard('{Enter}')
    const english = screen.getByRole('menuitemradio', { name: 'English' })
    expect(english).toHaveAttribute('aria-checked', 'true'); expect(english).toHaveFocus()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(trigger).toHaveFocus(); expect(trigger).toHaveAttribute('aria-label', 'Cambiar idioma, idioma actual: Español')
    await user.keyboard('{ArrowDown}{End}')
    expect(screen.getByRole('menuitemradio', { name: 'Português' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('menuitemradio', { name: 'English' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument(); expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
  it('closes on outside click and on Tab leaving the menu', async () => {
    const user = userEvent.setup(); render(<App />)
    await user.click(screen.getByRole('button', { name: 'Change language, current language: English' }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Change language, current language: English' }))
    await user.tab()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
  it('coordinates with the mobile navigation instead of opening both menus', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(document.querySelector('#landing-nav')).toHaveClass('is-open')
    await choose('ht')
    expect(document.querySelector('#landing-nav')).not.toHaveClass('is-open')
    expect(screen.getByRole('button', { name: 'Ouvri meni an' })).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('translated journeys and content integrity', () => {
  it.each(localeCodes)('%s has complete keys, interpolation tokens, rich markup and service/FAQ content', async code => {
    const canonical = Object.keys(resources.en).sort()
    expect(Object.keys(resources[code]).sort()).toEqual(canonical)
    for (const key of canonical as (keyof typeof resources.en)[]) {
      expect(resources[code][key].trim(), key).not.toBe('')
      expect([...resources[code][key].matchAll(/{{(.*?)}}/g)].map(m => m[1]).sort(), key).toEqual([...resources.en[key].matchAll(/{{(.*?)}}/g)].map(m => m[1]).sort())
      expect([...resources[code][key].matchAll(/<\/?([a-zA-Z]+)\s*\/?\s*>/g)].map(m => m[1]).sort(), key).toEqual([...resources.en[key].matchAll(/<\/?([a-zA-Z]+)\s*\/?\s*>/g)].map(m => m[1]).sort())
    }
    await i18n.changeLanguage(code)
    expect(getServices()).toHaveLength(3); expect(getFaqs()).toHaveLength(11)
    expect(getServices()[0].title).toBe(resources[code]['services.standard.title'])
    expect(formatDateRange('2026-11-20', '2026-11-23')).toContain(code === 'ht' ? 'novanm' : code === 'es' ? 'noviembre' : code === 'pt' ? 'novembro' : 'November')
  })
  it.each(['es', 'ht', 'pt'] as const)('localizes %s booking, thank-you and surrounding legal UI with official English documents', async code => {
    localStorage.setItem(languageStorageKey, code)
    const view = render(<App path={locales[code].pathPrefix + "/booking"} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(resources[code]['booking.title'].replace(/<[^>]*>/g, ''))
    expect(screen.getByRole('link', { name: new RegExp(t('booking.secure')) })).toHaveAttribute('href', 'https://app.zenmaid.com/book/mirembe-cleaning-company-holiday')
    expect(screen.getByText(t('booking.vendorNotice'))).toBeInTheDocument()
    view.rerender(<App path={locales[code].pathPrefix + "/booking/thankyou"} />)
    expect(document.title).toBe(t('seo.thankYou.title'))
    expect(screen.getByRole('link', { name: t('booking.home') })).toHaveAttribute('href', locales[code].pathPrefix + '/')
    for (const path of ['/terms', '/privacy']) {
      view.rerender(<App path={locales[code].pathPrefix + path} />)
      expect(screen.getByText(t('legal.englishNotice'))).toBeVisible()
      expect(document.querySelector('article[lang="en"]')).toBeInTheDocument()
      expect(document.querySelector('h1')).toHaveTextContent(path === '/terms' ? 'Terms of Service' : 'Privacy Policy')
    }
  })
  it('preserves an open service drawer and updates its content on language change', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'What’s included in Standard Clean' }))
    const dialog = screen.getByRole('dialog', { name: 'Standard Clean' })
    await act(() => i18n.changeLanguage('pt'))
    expect(dialog).toHaveAttribute('open')
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent('Limpeza de manutenção')
    expect(dialog).toHaveTextContent('Limpeza de bancadas e fogão')
  })
  it('localizes an existing validation error and preserves the entered form value', async () => {
    render(<WaitlistExperience />)
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'invalid' } })
    fireEvent.submit(document.querySelector('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent(resources.en['errors.waitlistEmail'])
    await act(() => i18n.changeLanguage('ht'))
    expect(screen.getByRole('alert')).toHaveTextContent(resources.ht['errors.waitlistEmail'])
    expect(screen.getByLabelText('Adrès imèl')).toHaveValue('invalid')
  })
  it.each(['es', 'ht', 'pt'] as const)('keeps the waitlist and ZIP submission contract in %s', async code => {
    const record: WaitlistRecord = { id: 'test', email: 'person@example.com', zip_code: null, zip_token: 'signed-test', source: 'landing_page', created_at: '2026-10-28' }
    vi.mocked(createWaitlistEntry).mockResolvedValue(record)
    vi.mocked(updateWaitlistZip).mockResolvedValue({ ...record, zip_code: '02134' })
    await i18n.changeLanguage(code)
    const user = userEvent.setup(); render(<WaitlistExperience />)
    await user.type(screen.getByLabelText(t('waitlist.emailLabel')), 'person@example.com')
    await user.click(screen.getByRole('button', { name: t('waitlist.join') }))
    expect(await screen.findByRole('heading', { name: t('waitlist.successTitle') })).toBeVisible()
    expect(createWaitlistEntry).toHaveBeenCalledWith({ email: 'person@example.com', source: 'landing_page' }, 'test-token')
    await user.type(screen.getByLabelText(t('zip.optionalLabel')), '02134')
    await user.click(screen.getByRole('button', { name: t('common.save') }))
    expect(await screen.findByText(t('zip.saved'))).toBeVisible()
    expect(updateWaitlistZip).toHaveBeenCalledWith({ record, zip_code: '02134' })
  })
  it('localizes hiring options and field validation without changing input values', async () => {
    await i18n.changeLanguage('ht')
    render(<HiringApplicationForm active onAccepted={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'Wi' })).toHaveAttribute('value', 'yes')
    expect(screen.getByRole('checkbox', { name: 'Kreyòl ayisyen' })).toHaveAttribute('value', 'haitian_creole')
    fireEvent.blur(screen.getByLabelText(/Siyati/))
    expect(screen.getByText('Antre siyati ou.')).toBeVisible()
    await act(() => i18n.changeLanguage('es'))
    expect(screen.getByText('Ingresa tu apellido.')).toBeVisible()
  })
  it('localizes the holiday modal and keeps dates, discount and booking target', async () => {
    await i18n.changeLanguage('ht')
    render(<HolidayPromoModal open onDismiss={vi.fn()} onBooking={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('10% rabè sou netwayaj pou fèt yo')
    expect(dialog).toHaveTextContent('20–23 novanm 2026')
    expect(within(dialog).getByRole('link')).toHaveAttribute('href', '/ht/booking')
  })
})

it.each(['es', 'ht', 'pt'] as const)('submits the hiring journey in %s with unchanged API option values', async code => {
  await i18n.changeLanguage(code)
  const response = { ok: true, data: { id: 'application-test', created_at: '2026-10-28T12:00:00Z' } }
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), { status: 201 }))
  const onAccepted = vi.fn()
  render(<HiringApplicationForm active onAccepted={onAccepted} />)
  const fields = { first_name: 'Test', last_name: 'Applicant', email: 'applicant@example.com', phone: '6175550100', city: 'Boston' }
  for (const [name, value] of Object.entries(fields)) fireEvent.change(document.querySelector(`[name="${name}"]`)!, { target: { value } })
  fireEvent.change(document.querySelector('[name="state"]')!, { target: { value: 'MA' } })
  for (const [name, value] of Object.entries({ has_vehicle: 'yes', cleaning_experience: '1_to_3_years', languages: 'haitian_creole', travel_distance: '10_miles', preferred_availability: 'part_time' })) fireEvent.click(document.querySelector(`[name="${name}"][value="${value}"]`)!)
  await userEvent.click(screen.getByRole('button', { name: t('hiring.submit') }))
  expect(onAccepted).toHaveBeenCalledOnce()
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/applicants')
  expect(JSON.parse(String(options?.body))).toMatchObject({ ...fields, state: 'MA', has_vehicle: true, cleaning_experience: '1_to_3_years', languages: ['haitian_creole'], travel_distance: '10_miles', preferred_availability: 'part_time', turnstileToken: 'test-token' })
})

it('localizes browser metadata and self-referencing canonicals, restoring English on return', async () => {
  const meta = document.createElement('meta'); meta.name = 'description'; meta.content = resources.en['seo.description']; document.head.appendChild(meta)
  document.querySelectorAll('link[rel="canonical"]').forEach(element => element.remove())
  const canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.href = 'https://www.mirembecleaning.com/'; document.head.appendChild(canonical)
  const schema = document.createElement('script'); schema.type = 'application/ld+json'; schema.textContent = JSON.stringify({ '@graph': [{ '@type': 'Organization', description: resources.en['seo.description'] }] }); document.head.appendChild(schema)
  const view = render(<App />)
  await choose('es')
  expect(document.title).toBe(resources.es['seo.home.title'])
  expect(meta.content).toBe(resources.es['seo.home.description'])
  expect(canonical.href).toBe('https://www.mirembecleaning.com/es/')
  expect(JSON.parse(schema.textContent!)['@graph'][0].description).toBe(resources.es['seo.description'])
  await choose('en')
  expect(meta.content).toBe(resources.en['seo.description'])
  expect(canonical.href).toBe('https://www.mirembecleaning.com/')
  view.unmount(); meta.remove(); canonical.remove(); schema.remove()
})


it.each(['es', 'ht', 'pt'] as const)('translates consent and preserves declined tracking while switching to %s', async code => {
  marketing.ga4Id = 'G-LOCALTEST'; marketing.metaPixelId = '39772457375733047'
  vi.mocked(setConsent).mockImplementation(saveConsent)
  saveConsent('declined')
  render(<App />)
  await choose(code)
  expect(getConsent()).toBe('declined')
  await userEvent.click(screen.getByRole('button', { name: t('consent.preferences') }))
  const dialog = screen.getByRole('dialog', { name: t('consent.preferences') })
  expect(dialog).toHaveTextContent(t('consent.declined'))
  expect(dialog).toHaveTextContent(t('consent.askAdvertising'))
  await userEvent.click(within(dialog).getByRole('button', { name: t('consent.decline') }))
  expect(getConsent()).toBe('declined')
  expect(localStorage.getItem(languageStorageKey)).toBe(code)
})

it('keeps GPC effective when the language changes and localizes the privacy explanation', async () => {
  marketing.ga4Id = 'G-LOCALTEST'
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
  render(<App />)
  await choose('ht')
  await userEvent.click(screen.getByRole('button', { name: t('consent.preferences') }))
  expect(screen.getByRole('dialog')).toHaveTextContent(resources.ht['consent.browserBlocked'])
  expect(screen.queryByRole('button', { name: t('consent.allow') })).not.toBeInTheDocument()
  expect(getConsent()).toBe('declined')
})

it.each(localeCodes)('hydrates a directly loaded %s URL with matching localized HTML and no preference override', async code => {
  const path = locales[code].pathPrefix + '/'
  history.replaceState(null, '', path)
  localStorage.setItem(languageStorageKey, code === 'ht' ? 'es' : 'ht')
  initializeRouteLocale(path)
  const container = document.createElement('div')
  container.innerHTML = renderToString(<App path={path} />)
  document.body.appendChild(container)
  const error = vi.fn()
  let root!: ReturnType<typeof hydrateRoot>
  await act(async () => { root = hydrateRoot(container, <App />, { onRecoverableError: error }); await Promise.resolve() })
  expect(error).not.toHaveBeenCalled()
  expect(document.documentElement.lang).toBe(locales[code].htmlLang)
  expect(container.querySelector('h1')).toHaveTextContent(resources[code]['home.hero.title'].replace(/<[^>]*>/g, ''))
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.mirembecleaning.com' + path)
  await act(() => root.unmount()); container.remove()
})

it('follows browser back/forward through language URLs and updates content, canonical and menu state', async () => {
  render(<App />)
  await choose('es'); await choose('ht')
  act(() => history.back())
  await vi.waitFor(() => expect(location.pathname).toBe('/es/'))
  expect(document.documentElement.lang).toBe('es')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Un hogar más limpio, más tranquilidad.')
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.mirembecleaning.com/es/')
  act(() => history.forward())
  await vi.waitFor(() => expect(location.pathname).toBe('/ht/'))
  expect(document.documentElement.lang).toBe('ht')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Yon kay pi pwòp, plis lapè.')
})

it('retains campaign queries, booking mode and section anchors on language selection', async () => {
  history.replaceState(null, '', '/booking?embed=basic&utm_source=holiday&utm_campaign=holiday_2026#top')
  initializeRouteLocale('/booking')
  render(<App />)
  await choose('pt')
  expect(location.pathname + location.search + location.hash).toBe('/pt/booking?embed=basic&utm_source=holiday&utm_campaign=holiday_2026#top')
  expect(screen.getByTitle(t('booking.frameTitle'))).toHaveAttribute('src', 'https://app.zenmaid.com/booking-forms/V4Q5E/book')
  expect(screen.getByRole('link', { name: t('booking.full') })).toHaveAttribute('href', '/pt/booking')
})

it('keeps the same mounted vendor form during a booking language transition', async () => {
  const { loadZenMaid } = await import('../lib/zenmaid')
  history.replaceState(null, '', '/es/booking')
  initializeRouteLocale('/es/booking')
  render(<App />)
  const container = document.querySelector('.zenmaid-container')!
  const input = document.createElement('input'); input.value = 'Unsubmitted test draft'
  const form = document.createElement('form'); form.appendChild(input)
  await act(async () => { container.appendChild(form); await Promise.resolve() })
  const calls = vi.mocked(loadZenMaid).mock.calls.length
  await choose('ht')
  expect(location.pathname).toBe('/ht/booking')
  expect(document.querySelector('.zenmaid-container')).toBe(container)
  expect(container.querySelector('input')).toBe(input)
  expect(input.value).toBe('Unsubmitted test draft')
  expect(loadZenMaid).toHaveBeenCalledTimes(calls)
})


it('keeps an explicit switch back to English on confirmation from restoring the prior booking language', async () => {
  history.replaceState(null, '', '/ht/booking/thankyou')
  initializeRouteLocale('/ht/booking/thankyou')
  render(<App />)
  expect(sessionStorage.getItem(bookingLanguageStorageKey)).toBe('ht')
  await choose('en')
  expect(location.pathname).toBe('/booking/thankyou')
  expect(sessionStorage.getItem(bookingLanguageStorageKey)).toBe('en')
  expect(localStorage.getItem(languageStorageKey)).toBe('en')
})

it('keeps preview noindex protection when switching language in the browser', async () => {
  const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex,follow'; document.head.appendChild(robots)
  document.documentElement.dataset.indexing = 'noindex'
  try {
    render(<App />)
    await choose('es')
    expect(robots.content).toBe('noindex,follow')
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.mirembecleaning.com/es/')
  } finally { delete document.documentElement.dataset.indexing; robots.remove() }
})
